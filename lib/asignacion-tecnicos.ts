import { supabase } from './supabase'

export interface TecnicoDisponible {
  id: string
  nombre: string
  telefono: string
  email?: string
  especialidad?: string
  rol: string
  tickets_activos: number
  prioridad_asignacion: number
  acepta_emergencias: boolean
  turno_actual?: string
  score: number // Score calculado para asignación
}

/**
 * Asigna automáticamente un técnico al ticket basado en:
 * - Especialidad del técnico
 * - Carga actual de trabajo
 * - Prioridad de asignación
 * - Disponibilidad
 * - Si es emergencia, solo técnicos que aceptan emergencias
 */
export async function asignarTecnicoAutomatico(
  ticketId: string,
  esEmergencia: boolean = false
): Promise<TecnicoDisponible | null> {
  
  // Obtener información del ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*, tipo_incidente:tipos_incidente(*)')
    .eq('id', ticketId)
    .single()

  if (ticketError || !ticket) {
    console.error('Error obteniendo ticket:', ticketError)
    return null
  }

  // Determinar especialidad requerida según tipo de incidente
  const especialidadRequerida = determinarEspecialidad(ticket.tipo_incidente?.categoria)

  // Buscar técnicos disponibles
  const tecnicos = await buscarTecnicosDisponibles(
    especialidadRequerida,
    esEmergencia,
    ticket.turno
  )

  if (!tecnicos || tecnicos.length === 0) {
    console.warn('⚠️ No hay técnicos disponibles')
    return null
  }

  // Calcular score para cada técnico y ordenar
  const tecnicosConScore = tecnicos.map(t => ({
    ...t,
    score: calcularScoreAsignacion(t, especialidadRequerida, esEmergencia)
  })).sort((a, b) => b.score - a.score) // Mayor score = mejor candidato

  // Seleccionar el mejor técnico
  const tecnicoSeleccionado = tecnicosConScore[0]

  // Asignar el ticket
  await asignarTicketATecnico(ticketId, tecnicoSeleccionado.id)

  return tecnicoSeleccionado
}

/**
 * Busca técnicos disponibles según criterios
 */
async function buscarTecnicosDisponibles(
  especialidad?: string,
  soloEmergencias: boolean = false,
  turno?: string
): Promise<any[]> {
  
  let query = supabase
    .from('usuarios_autorizados')
    .select('*')
    .eq('activo', true)
    .eq('disponible', true)
    .in('rol', ['tecnico', 'supervisor'])

  // Si es emergencia, solo técnicos que aceptan emergencias
  if (soloEmergencias) {
    query = query.eq('acepta_emergencias', true)
  }

  // Filtrar por especialidad si se especifica
  if (especialidad) {
    query = query.or(`especialidad.ilike.%${especialidad}%,especialidad.is.null`)
  }

  // Filtrar por turno si se especifica
  if (turno) {
    query = query.or(`turno_actual.eq.${turno},turno_actual.is.null`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error buscando técnicos:', error)
    return []
  }

  return data || []
}

/**
 * Calcula score de asignación para un técnico
 * Mayor score = mejor candidato
 */
function calcularScoreAsignacion(
  tecnico: any,
  especialidadRequerida?: string,
  esEmergencia: boolean = false
): number {
  let score = 100

  // 1. Prioridad base del técnico (1-10, donde 1 es más prioritario)
  score += (11 - tecnico.prioridad_asignacion) * 10

  // 2. Carga de trabajo (penalizar por tickets activos)
  score -= tecnico.tickets_activos * 15

  // 3. Especialidad coincidente (bonus)
  if (especialidadRequerida && tecnico.especialidad) {
    if (tecnico.especialidad.toLowerCase().includes(especialidadRequerida.toLowerCase())) {
      score += 30 // Gran bonus por especialidad exacta
    }
  }

  // 4. Supervisor tiene bonus (puede coordinar mejor)
  if (tecnico.rol === 'supervisor') {
    score += 10
  }

  // 5. Si es emergencia y acepta emergencias, gran bonus
  if (esEmergencia && tecnico.acepta_emergencias) {
    score += 50
  }

  // 6. Penalizar si se le asignó muy recientemente
  if (tecnico.ultima_asignacion) {
    const minutosDesdeUltimaAsignacion = 
      (Date.now() - new Date(tecnico.ultima_asignacion).getTime()) / 1000 / 60
    
    if (minutosDesdeUltimaAsignacion < 30) {
      score -= 20 // Penalizar asignaciones muy seguidas
    }
  }

  return Math.max(0, score) // No permitir scores negativos
}

/**
 * Asigna el ticket al técnico y actualiza contadores
 */
async function asignarTicketATecnico(
  ticketId: string,
  tecnicoId: string
): Promise<void> {
  
  const ahora = new Date().toISOString()

  // 1. Actualizar ticket
  await supabase
    .from('tickets')
    .update({
      asignado_a: tecnicoId,
      estado: 'asignado',
      fecha_asignacion: ahora,
      updated_at: ahora
    })
    .eq('id', ticketId)

  // 2. Incrementar contador de tickets activos del técnico
  await supabase.rpc('incrementar_tickets_activos', {
    usuario_id: tecnicoId
  })

  // 3. Actualizar última asignación
  await supabase
    .from('usuarios_autorizados')
    .update({
      ultima_asignacion: ahora
    })
    .eq('id', tecnicoId)

  // 4. Registrar en historial
  await supabase
    .from('historial_estados')
    .insert({
      ticket_id: ticketId,
      estado_anterior: 'nuevo',
      estado_nuevo: 'asignado',
      usuario_id: tecnicoId,
      comentario: 'Asignación automática del sistema'
    })
}

/**
 * Libera un técnico cuando cierra un ticket
 */
export async function liberarTecnico(ticketId: string): Promise<void> {
  // Obtener el técnico asignado
  const { data: ticket } = await supabase
    .from('tickets')
    .select('asignado_a')
    .eq('id', ticketId)
    .single()

  if (ticket?.asignado_a) {
    // Decrementar contador
    await supabase.rpc('decrementar_tickets_activos', {
      usuario_id: ticket.asignado_a
    })
  }
}

/**
 * Determina la especialidad requerida según categoría del incidente
 */
function determinarEspecialidad(categoria?: string): string | undefined {
  if (!categoria) return undefined

  const mapeoEspecialidades: Record<string, string> = {
    'electrico': 'eléctrico',
    'mecanico': 'mecánico',
    'hidraulico': 'hidráulico',
    'neumaticos': 'neumáticos',
    'instrumentacion': 'instrumentación',
    'lubricacion': 'lubricación'
  }

  return mapeoEspecialidades[categoria.toLowerCase()]
}

/**
 * Reasignar ticket manualmente a otro técnico
 */
export async function reasignarTicket(
  ticketId: string,
  nuevoTecnicoId: string,
  usuarioQueReasigna: string,
  motivo?: string
): Promise<void> {
  
  // Obtener técnico actual
  const { data: ticket } = await supabase
    .from('tickets')
    .select('asignado_a')
    .eq('id', ticketId)
    .single()

  const tecnicoAnterior = ticket?.asignado_a

  // Decrementar contador del técnico anterior
  if (tecnicoAnterior) {
    await supabase.rpc('decrementar_tickets_activos', {
      usuario_id: tecnicoAnterior
    })
  }

  // Asignar al nuevo técnico
  const ahora = new Date().toISOString()

  await supabase
    .from('tickets')
    .update({
      asignado_a: nuevoTecnicoId,
      estado: 'asignado',
      fecha_asignacion: ahora,
      updated_at: ahora
    })
    .eq('id', ticketId)

  // Incrementar contador del nuevo técnico
  await supabase.rpc('incrementar_tickets_activos', {
    usuario_id: nuevoTecnicoId
  })

  await supabase
    .from('usuarios_autorizados')
    .update({ ultima_asignacion: ahora })
    .eq('id', nuevoTecnicoId)

  // Registrar en historial
  await supabase
    .from('historial_estados')
    .insert({
      ticket_id: ticketId,
      estado_anterior: 'asignado',
      estado_nuevo: 'asignado',
      usuario_id: usuarioQueReasigna,
      comentario: `Reasignado de técnico${motivo ? ': ' + motivo : ''}`
    })
}

/**
 * Obtener estadísticas de carga de técnicos
 */
export async function obtenerCargaTecnicos(): Promise<any[]> {
  const { data, error } = await supabase
    .from('usuarios_autorizados')
    .select('id, nombre, rol, especialidad, tickets_activos, disponible, acepta_emergencias')
    .in('rol', ['tecnico', 'supervisor'])
    .eq('activo', true)
    .order('tickets_activos', { ascending: false })

  if (error) {
    console.error('Error obteniendo carga de técnicos:', error)
    return []
  }

  return data || []
}
