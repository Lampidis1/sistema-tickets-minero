import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { enviarNotificacion } from './notificaciones';

const supabase = createClientComponentClient();

export interface Tecnico {
  id: string;
  nombre: string;
  telefono: string;
  especialidad: string | null;
  prioridad_asignacion: number;
  tickets_activos: number;
  acepta_emergencias: boolean;
  disponible: boolean;
  turno_actual: string | null;
  ultima_asignacion: string | null;
  rol: string;
}

export interface ScoringResult {
  tecnico_id: string;
  tecnico_nombre: string;
  score: number;
  razon: string;
}

/**
 * Calcula un score para cada técnico disponible
 * Score más alto = mejor candidato
 */
export function calcularScore(
  tecnico: Tecnico,
  tipo_incidente: string,
  es_emergencia: boolean
): ScoringResult {
  let score = 100;
  let razones: string[] = [];

  // Factor 1: Prioridad de asignación (1=máxima, 10=mínima)
  const prioridad_puntos = (11 - tecnico.prioridad_asignacion) * 10;
  score += prioridad_puntos;
  razones.push(`Prioridad ${tecnico.prioridad_asignacion}: +${prioridad_puntos}pts`);

  // Factor 2: Carga actual de trabajo (penalización por tickets activos)
  const carga_penalizacion = tecnico.tickets_activos * 15;
  score -= carga_penalizacion;
  razones.push(`${tecnico.tickets_activos} tickets activos: -${carga_penalizacion}pts`);

  // Factor 3: Especialidad coincide con tipo de incidente
  if (tecnico.especialidad) {
    const especialidades_map: Record<string, string[]> = {
      eléctrico: ['Falla eléctrica', 'Sistema eléctrico', 'Iluminación'],
      mecánico: ['Falla mecánica', 'Motor', 'Transmisión', 'Frenos'],
      hidráulico: ['Falla hidráulica', 'Sistema hidráulico', 'Cilindros'],
      neumático: ['Neumáticos', 'Sistema de aire', 'Suspensión neumática']
    };

    const tipos_relacionados = especialidades_map[tecnico.especialidad.toLowerCase()] || [];
    
    if (tipos_relacionados.some(tipo => 
      tipo_incidente.toLowerCase().includes(tipo.toLowerCase())
    )) {
      score += 30;
      razones.push(`Especialidad coincide: +30pts`);
    }
  }

  // Factor 4: Es supervisor (mayor capacidad de gestión)
  if (tecnico.rol === 'supervisor') {
    score += 10;
    razones.push('Es supervisor: +10pts');
  }

  // Factor 5: Emergencia y acepta emergencias
  if (es_emergencia) {
    if (tecnico.acepta_emergencias) {
      score += 50;
      razones.push('Acepta emergencias: +50pts');
    } else {
      score -= 100; // Penalización fuerte si no acepta emergencias
      razones.push('No acepta emergencias: -100pts');
    }
  }

  // Factor 6: Última asignación reciente (distribuir carga)
  if (tecnico.ultima_asignacion) {
    const ultima = new Date(tecnico.ultima_asignacion);
    const ahora = new Date();
    const minutos_desde_ultima = (ahora.getTime() - ultima.getTime()) / 60000;

    if (minutos_desde_ultima < 30) {
      score -= 20;
      razones.push('Asignado recientemente: -20pts');
    }
  }

  // Factor 7: No disponible
  if (!tecnico.disponible) {
    score -= 200; // Penalización muy fuerte
    razones.push('No disponible: -200pts');
  }

  return {
    tecnico_id: tecnico.id,
    tecnico_nombre: tecnico.nombre,
    score: Math.max(0, score), // No permitir scores negativos
    razon: razones.join(', ')
  };
}

/**
 * Asigna automáticamente un técnico a un ticket
 */
export async function asignarTecnicoAutomatico(
  ticket_id: string,
  tipo_incidente: string,
  es_emergencia: boolean = false
): Promise<{ success: boolean; tecnico?: Tecnico; error?: string }> {
  try {
    // 1. Obtener todos los técnicos disponibles
    const { data: tecnicos, error: errorTecnicos } = await supabase
      .from('usuarios_autorizados')
      .select('*')
      .in('rol', ['técnico', 'supervisor'])
      .eq('activo', true);

    if (errorTecnicos) {
      console.error('Error obteniendo técnicos:', errorTecnicos);
      return { success: false, error: 'Error obteniendo técnicos disponibles' };
    }

    if (!tecnicos || tecnicos.length === 0) {
      return { success: false, error: 'No hay técnicos disponibles' };
    }

    // 2. Calcular score para cada técnico
    const scores: ScoringResult[] = tecnicos.map(tec => 
      calcularScore(tec as Tecnico, tipo_incidente, es_emergencia)
    );

    // 3. Ordenar por score (mayor a menor)
    scores.sort((a, b) => b.score - a.score);

    // 4. Seleccionar el mejor candidato
    const mejor = scores[0];

    if (mejor.score <= 0) {
      return { 
        success: false, 
        error: 'Ningún técnico cumple con los criterios mínimos' 
      };
    }

    const tecnico_seleccionado = tecnicos.find(t => t.id === mejor.tecnico_id);

    if (!tecnico_seleccionado) {
      return { success: false, error: 'Error en selección de técnico' };
    }

    // 5. Asignar ticket al técnico
    const { error: errorUpdate } = await supabase
      .from('tickets')
      .update({
        asignado_a: tecnico_seleccionado.id,
        nombre_tecnico: tecnico_seleccionado.nombre,
        estado: 'asignado',
        fecha_asignacion: new Date().toISOString()
      })
      .eq('id', ticket_id);

    if (errorUpdate) {
      console.error('Error asignando ticket:', errorUpdate);
      return { success: false, error: 'Error al asignar ticket' };
    }

    // 6. Incrementar contador de tickets activos
    const { error: errorIncrement } = await supabase.rpc(
      'incrementar_tickets_activos',
      { usuario_id: tecnico_seleccionado.id }
    );

    if (errorIncrement) {
      console.error('Error incrementando contador:', errorIncrement);
    }

    // 7. Actualizar última asignación
    await supabase
      .from('usuarios_autorizados')
      .update({ ultima_asignacion: new Date().toISOString() })
      .eq('id', tecnico_seleccionado.id);

    // 8. Enviar notificación
    await enviarNotificacion({
      ticket_id,
      usuario_id: tecnico_seleccionado.id,
      tipo: es_emergencia ? 'emergencia' : 'asignacion',
      canal: 'whatsapp',
      prioridad: es_emergencia ? 1 : 3
    });

    // 9. Registrar en historial
    await supabase
      .from('historial_estados')
      .insert({
        ticket_id,
        estado_anterior: 'nuevo',
        estado_nuevo: 'asignado',
        usuario_id: tecnico_seleccionado.id,
        comentario: `Asignado automáticamente. Score: ${mejor.score}. ${mejor.razon}`
      });

    console.log(`✅ Ticket ${ticket_id} asignado a ${tecnico_seleccionado.nombre}`);
    console.log(`📊 Score: ${mejor.score} - ${mejor.razon}`);

    return { 
      success: true, 
      tecnico: tecnico_seleccionado as Tecnico 
    };

  } catch (error) {
    console.error('Error en asignación automática:', error);
    return { 
      success: false, 
      error: 'Error inesperado en asignación automática' 
    };
  }
}

/**
 * Reasigna un ticket a otro técnico
 */
export async function reasignarTicket(
  ticket_id: string,
  nuevo_tecnico_id: string,
  usuario_que_reasigna_id: string,
  motivo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obtener ticket actual
    const { data: ticket, error: errorTicket } = await supabase
      .from('tickets')
      .select('asignado_a, estado')
      .eq('id', ticket_id)
      .single();

    if (errorTicket || !ticket) {
      return { success: false, error: 'Ticket no encontrado' };
    }

    const tecnico_anterior_id = ticket.asignado_a;

    // 2. Obtener datos del nuevo técnico
    const { data: nuevoTecnico, error: errorNuevoTec } = await supabase
      .from('usuarios_autorizados')
      .select('nombre, disponible')
      .eq('id', nuevo_tecnico_id)
      .single();

    if (errorNuevoTec || !nuevoTecnico) {
      return { success: false, error: 'Técnico no encontrado' };
    }

    if (!nuevoTecnico.disponible) {
      return { success: false, error: 'Técnico no está disponible' };
    }

    // 3. Actualizar ticket
    const { error: errorUpdate } = await supabase
      .from('tickets')
      .update({
        asignado_a: nuevo_tecnico_id,
        nombre_tecnico: nuevoTecnico.nombre,
        fecha_asignacion: new Date().toISOString()
      })
      .eq('id', ticket_id);

    if (errorUpdate) {
      return { success: false, error: 'Error al reasignar ticket' };
    }

    // 4. Decrementar contador del técnico anterior (si existía)
    if (tecnico_anterior_id) {
      await supabase.rpc('decrementar_tickets_activos', {
        usuario_id: tecnico_anterior_id
      });
    }

    // 5. Incrementar contador del nuevo técnico
    await supabase.rpc('incrementar_tickets_activos', {
      usuario_id: nuevo_tecnico_id
    });

    // 6. Actualizar última asignación
    await supabase
      .from('usuarios_autorizados')
      .update({ ultima_asignacion: new Date().toISOString() })
      .eq('id', nuevo_tecnico_id);

    // 7. Enviar notificación al nuevo técnico
    await enviarNotificacion({
      ticket_id,
      usuario_id: nuevo_tecnico_id,
      tipo: 'asignacion',
      canal: 'whatsapp',
      prioridad: 3
    });

    // 8. Registrar en historial
    await supabase
      .from('historial_estados')
      .insert({
        ticket_id,
        estado_anterior: ticket.estado,
        estado_nuevo: ticket.estado,
        usuario_id: usuario_que_reasigna_id,
        comentario: `Reasignado a ${nuevoTecnico.nombre}. ${motivo || 'Sin motivo especificado'}`
      });

    return { success: true };

  } catch (error) {
    console.error('Error en reasignación:', error);
    return { success: false, error: 'Error inesperado en reasignación' };
  }
}

/**
 * Libera un técnico cuando cierra un ticket
 */
export async function liberarTecnico(
  ticket_id: string,
  tecnico_id: string
): Promise<void> {
  try {
    await supabase.rpc('decrementar_tickets_activos', {
      usuario_id: tecnico_id
    });

    console.log(`✅ Técnico ${tecnico_id} liberado del ticket ${ticket_id}`);
  } catch (error) {
    console.error('Error liberando técnico:', error);
  }
}

/**
 * Obtiene la carga actual de todos los técnicos
 */
export async function obtenerCargaTecnicos(): Promise<Tecnico[]> {
  const { data, error } = await supabase
    .from('usuarios_autorizados')
    .select('*')
    .in('rol', ['técnico', 'supervisor'])
    .eq('activo', true)
    .order('tickets_activos', { ascending: false });

  if (error) {
    console.error('Error obteniendo carga de técnicos:', error);
    return [];
  }

  return (data as Tecnico[]) || [];
}
