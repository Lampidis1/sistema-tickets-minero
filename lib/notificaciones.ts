import { supabase } from './supabase'

export type TipoNotificacion = 
  | 'asignacion'           // Ticket asignado al técnico
  | 'cambio_estado'        // Estado del ticket cambió
  | 'emergencia'           // Ticket urgente/emergencia
  | 'recordatorio'         // Recordatorio de ticket pendiente
  | 'escalamiento'         // Ticket escalado a supervisor
  | 'cierre'               // Ticket cerrado
  | 'comentario'           // Nuevo comentario en ticket

export type CanalNotificacion = 'whatsapp' | 'email' | 'sms'

export interface NotificacionConfig {
  ticketId: string
  usuarioId: string
  tipo: TipoNotificacion
  prioridad: number // 1=crítico, 2=alto, 3=medio, 4=bajo
  canal?: CanalNotificacion[] // Por defecto usa preferencias del usuario
  mensaje?: string // Mensaje personalizado (opcional)
  metadata?: Record<string, any>
}

/**
 * Envía notificación a un técnico
 */
export async function enviarNotificacion(config: NotificacionConfig): Promise<void> {
  const { ticketId, usuarioId, tipo, prioridad, canal, mensaje, metadata } = config

  // Obtener información del usuario
  const { data: usuario, error: userError } = await supabase
    .from('usuarios_autorizados')
    .select('*')
    .eq('id', usuarioId)
    .single()

  if (userError || !usuario) {
    console.error('Error obteniendo usuario para notificación:', userError)
    return
  }

  // Verificar preferencias de notificación
  if (!usuario.activo) {
    console.log(`Usuario ${usuario.nombre} inactivo, no se envía notificación`)
    return
  }

  // Obtener información del ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select(`
      *,
      tipo_incidente:tipos_incidente(nombre),
      equipo:equipos(codigo, tipo_equipo)
    `)
    .eq('id', ticketId)
    .single()

  if (ticketError || !ticket) {
    console.error('Error obteniendo ticket:', ticketError)
    return
  }

  // Determinar canales de envío
  const canales = canal || determinarCanales(usuario, prioridad)

  // Generar mensaje si no se proporcionó uno
  const mensajeFinal = mensaje || generarMensajeNotificacion(tipo, ticket, usuario)

  // Enviar por cada canal
  for (const canalActual of canales) {
    await enviarPorCanal(
      canalActual,
      usuario,
      mensajeFinal,
      ticketId,
      tipo,
      prioridad,
      metadata
    )
  }
}

/**
 * Determina canales de notificación según preferencias y prioridad
 */
function determinarCanales(usuario: any, prioridad: number): CanalNotificacion[] {
  const canales: CanalNotificacion[] = []

  // WhatsApp siempre para emergencias críticas
  if (prioridad === 1) {
    canales.push('whatsapp')
  } else {
    // Usar preferencias del usuario
    if (usuario.notificaciones_push) {
      canales.push('whatsapp')
    }
    if (usuario.notificaciones_email && usuario.email) {
      canales.push('email')
    }
  }

  // Si no hay canales, por defecto WhatsApp
  if (canales.length === 0) {
    canales.push('whatsapp')
  }

  return canales
}

/**
 * Genera mensaje de notificación según el tipo
 */
function generarMensajeNotificacion(
  tipo: TipoNotificacion,
  ticket: any,
  usuario: any
): string {
  const prioridadEmoji = {
    1: '🔴',
    2: '🟠',
    3: '🟡',
    4: '🟢'
  }[ticket.prioridad] || '⚪'

  const equipoCodigo = ticket.equipo?.codigo || ticket.equipo_codigo
  const tipoIncidente = ticket.tipo_incidente?.nombre || 'No especificado'

  switch (tipo) {
    case 'asignacion':
      return `🔔 *Nuevo Ticket Asignado*\n\n` +
             `Hola *${usuario.nombre}*!\n\n` +
             `Se te ha asignado un nuevo ticket:\n\n` +
             `📋 Ticket: *${ticket.numero_ticket}*\n` +
             `${prioridadEmoji} Prioridad: ${obtenerNombrePrioridad(ticket.prioridad)}\n` +
             `🔧 Equipo: ${equipoCodigo}\n` +
             `⚠️ Problema: ${tipoIncidente}\n` +
             `📝 ${ticket.breve_descripcion}\n\n` +
             `Por favor atiende este ticket lo antes posible.\n\n` +
             `_Responde *OK* para confirmar recepción_`

    case 'emergencia':
      return `🚨 *EMERGENCIA - ATENCIÓN URGENTE*\n\n` +
             `${usuario.nombre}, se requiere tu atención INMEDIATA:\n\n` +
             `📋 Ticket: *${ticket.numero_ticket}*\n` +
             `🔴 PRIORIDAD CRÍTICA\n` +
             `🔧 Equipo: ${equipoCodigo}\n` +
             `⚠️ ${tipoIncidente}\n` +
             `📝 ${ticket.breve_descripcion}\n\n` +
             `⏰ Tiempo de respuesta: INMEDIATO\n\n` +
             `_Confirma con *OK* que estás en camino_`

    case 'cambio_estado':
      return `📊 *Actualización de Ticket*\n\n` +
             `Ticket: *${ticket.numero_ticket}*\n` +
             `Estado: *${ticket.estado}*\n` +
             `Equipo: ${equipoCodigo}\n\n` +
             `El estado del ticket ha sido actualizado.`

    case 'recordatorio':
      return `⏰ *Recordatorio*\n\n` +
             `${usuario.nombre}, tienes un ticket pendiente:\n\n` +
             `📋 *${ticket.numero_ticket}*\n` +
             `🔧 ${equipoCodigo}\n` +
             `Estado: ${ticket.estado}\n\n` +
             `Por favor actualiza el progreso del ticket.`

    case 'escalamiento':
      return `⬆️ *Ticket Escalado*\n\n` +
             `Se ha escalado el siguiente ticket a tu atención:\n\n` +
             `📋 *${ticket.numero_ticket}*\n` +
             `🔧 ${equipoCodigo}\n` +
             `⚠️ ${tipoIncidente}\n\n` +
             `Se requiere supervisión o apoyo adicional.`

    case 'cierre':
      return `✅ *Ticket Cerrado*\n\n` +
             `El ticket *${ticket.numero_ticket}* ha sido cerrado.\n\n` +
             `Equipo: ${equipoCodigo}\n` +
             `Gracias por tu trabajo!`

    case 'comentario':
      return `💬 *Nuevo Comentario*\n\n` +
             `Hay un nuevo comentario en el ticket *${ticket.numero_ticket}*\n\n` +
             `Revisa el ticket para más detalles.`

    default:
      return `🔔 Actualización del ticket *${ticket.numero_ticket}*`
  }
}

/**
 * Envía notificación por un canal específico
 */
async function enviarPorCanal(
  canal: CanalNotificacion,
  usuario: any,
  mensaje: string,
  ticketId: string,
  tipo: TipoNotificacion,
  prioridad: number,
  metadata?: Record<string, any>
): Promise<void> {
  
  // Registrar notificación en BD
  const { data: notificacion, error: notifError } = await supabase
    .from('notificaciones')
    .insert({
      ticket_id: ticketId,
      usuario_id: usuario.id,
      tipo,
      canal,
      mensaje,
      prioridad,
      estado: 'pendiente',
      metadata: metadata || {}
    })
    .select()
    .single()

  if (notifError) {
    console.error('Error registrando notificación:', notifError)
    return
  }

  // Enviar según el canal
  try {
    if (canal === 'whatsapp') {
      await enviarWhatsApp(usuario.telefono, mensaje, notificacion.id)
    } else if (canal === 'email') {
      await enviarEmail(usuario.email, `Ticket Notification - ${tipo}`, mensaje, notificacion.id)
    }
  } catch (error) {
    console.error(`Error enviando notificación por ${canal}:`, error)
    
    // Marcar como error
    await supabase
      .from('notificaciones')
      .update({
        estado: 'error',
        error_mensaje: String(error)
      })
      .eq('id', notificacion.id)
  }
}

/**
 * Envía mensaje por WhatsApp
 */
async function enviarWhatsApp(
  telefono: string,
  mensaje: string,
  notificacionId: string
): Promise<void> {
  
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️ Credenciales de WhatsApp no configuradas')
    return
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefono,
        type: 'text',
        text: { body: mensaje }
      })
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`)
  }

  // Actualizar estado de notificación
  await supabase
    .from('notificaciones')
    .update({
      estado: 'enviado',
      enviado_at: new Date().toISOString(),
      metadata: { message_id: data.messages?.[0]?.id }
    })
    .eq('id', notificacionId)

  console.log('✅ Notificación WhatsApp enviada:', data.messages?.[0]?.id)
}

/**
 * Envía email (requiere servicio de email configurado)
 */
async function enviarEmail(
  email: string,
  asunto: string,
  mensaje: string,
  notificacionId: string
): Promise<void> {
  
  // TODO: Integrar con servicio de email (SendGrid, Resend, etc.)
  console.log('📧 Email a enviar:', { email, asunto, mensaje })

  // Por ahora solo registramos como enviado
  await supabase
    .from('notificaciones')
    .update({
      estado: 'enviado',
      enviado_at: new Date().toISOString()
    })
    .eq('id', notificacionId)
}

/**
 * Notificar asignación de ticket a técnico
 */
export async function notificarAsignacion(
  ticketId: string,
  tecnicoId: string,
  esEmergencia: boolean = false
): Promise<void> {
  
  await enviarNotificacion({
    ticketId,
    usuarioId: tecnicoId,
    tipo: esEmergencia ? 'emergencia' : 'asignacion',
    prioridad: esEmergencia ? 1 : 2
  })
}

/**
 * Notificar cambio de estado
 */
export async function notificarCambioEstado(
  ticketId: string,
  usuarioId: string,
  nuevoEstado: string
): Promise<void> {
  
  await enviarNotificacion({
    ticketId,
    usuarioId,
    tipo: nuevoEstado === 'cerrado' ? 'cierre' : 'cambio_estado',
    prioridad: 3,
    metadata: { estado: nuevoEstado }
  })
}

/**
 * Enviar recordatorio de tickets pendientes
 */
export async function enviarRecordatoriosPendientes(): Promise<void> {
  // Buscar tickets asignados hace más de 2 horas sin actualización
  const dosHorasAtras = new Date()
  dosHorasAtras.setHours(dosHorasAtras.getHours() - 2)

  const { data: ticketsPendientes } = await supabase
    .from('tickets')
    .select('id, asignado_a')
    .eq('estado', 'asignado')
    .lt('updated_at', dosHorasAtras.toISOString())
    .not('asignado_a', 'is', null)

  if (!ticketsPendientes) return

  for (const ticket of ticketsPendientes) {
    await enviarNotificacion({
      ticketId: ticket.id,
      usuarioId: ticket.asignado_a,
      tipo: 'recordatorio',
      prioridad: 3
    })
  }
}

// Helpers
function obtenerNombrePrioridad(prioridad: number): string {
  const nombres: Record<number, string> = {
    1: 'CRÍTICA',
    2: 'Alta',
    3: 'Media',
    4: 'Baja'
  }
  return nombres[prioridad] || 'Media'
}
