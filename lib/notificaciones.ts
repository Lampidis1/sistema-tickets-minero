import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

export type TipoNotificacion = 
  | 'asignacion'
  | 'emergencia'
  | 'cambio_estado'
  | 'recordatorio'
  | 'escalamiento'
  | 'cierre'
  | 'comentario';

export type CanalNotificacion = 'whatsapp' | 'email';

export interface NotificacionParams {
  ticket_id: string;
  usuario_id: string;
  tipo: TipoNotificacion;
  canal: CanalNotificacion;
  prioridad?: number; // 1=crítico, 2=alto, 3=medio, 4=bajo
  datos_adicionales?: Record<string, any>;
}

/**
 * Genera el mensaje personalizado según el tipo de notificación
 */
function generarMensaje(
  tipo: TipoNotificacion,
  datos: {
    nombre_usuario: string;
    numero_ticket: string;
    equipo_codigo?: string;
    tipo_incidente?: string;
    prioridad?: number;
    estado_anterior?: string;
    estado_nuevo?: string;
    comentario?: string;
  }
): string {
  const { nombre_usuario, numero_ticket, equipo_codigo, tipo_incidente } = datos;

  switch (tipo) {
    case 'asignacion':
      return `👷 ¡Hola ${nombre_usuario}!

Se te ha asignado un nuevo ticket:

📋 Ticket: ${numero_ticket}
🔧 Equipo: ${equipo_codigo || 'N/A'}
⚠️ Tipo: ${tipo_incidente || 'No especificado'}
📊 Prioridad: ${datos.prioridad === 1 ? '🔴 CRÍTICA' : datos.prioridad === 2 ? '🟡 ALTA' : '🟢 NORMAL'}

Por favor, revisa los detalles en el sistema.

📱 Responde cuando estés en camino.`;

    case 'emergencia':
      return `🚨 EMERGENCIA - ATENCIÓN URGENTE

${nombre_usuario}, se requiere tu atención INMEDIATA:

📋 Ticket: ${numero_ticket}
🔴 PRIORIDAD CRÍTICA
🔧 Equipo: ${equipo_codigo || 'N/A'}
⚠️ Problema: ${tipo_incidente || 'Sin especificar'}

⏰ Tiempo de respuesta esperado: INMEDIATO

Por favor confirma recepción de este mensaje.`;

    case 'cambio_estado':
      return `📌 Actualización de Ticket

Ticket: ${numero_ticket}
${datos.estado_anterior} → ${datos.estado_nuevo}

${datos.comentario ? `💬 ${datos.comentario}` : ''}

Revisa el sistema para más detalles.`;

    case 'recordatorio':
      return `⏰ Recordatorio

Hola ${nombre_usuario}, tienes un ticket pendiente:

📋 ${numero_ticket}
🔧 ${equipo_codigo || 'N/A'}

Este ticket lleva más de 2 horas sin actualización.

Por favor actualiza el estado o agrega un comentario.`;

    case 'escalamiento':
      return `⬆️ Escalamiento de Ticket

${nombre_usuario}, el ticket ${numero_ticket} ha sido escalado a ti.

Equipo: ${equipo_codigo}
Estado: Requiere atención de supervisor

Por favor revisa y asigna según corresponda.`;

    case 'cierre':
      return `✅ Ticket Cerrado

El ticket ${numero_ticket} ha sido marcado como cerrado.

Gracias por tu trabajo, ${nombre_usuario}.

${datos.comentario ? `💬 ${datos.comentario}` : ''}`;

    case 'comentario':
      return `💬 Nuevo Comentario

Ticket: ${numero_ticket}

"${datos.comentario}"

Revisa el ticket para responder.`;

    default:
      return `Notificación para ticket ${numero_ticket}`;
  }
}

/**
 * Envía una notificación a un usuario
 */
export async function enviarNotificacion(
  params: NotificacionParams
): Promise<{ success: boolean; notificacion_id?: string; error?: string }> {
  const { ticket_id, usuario_id, tipo, canal, prioridad = 3, datos_adicionales = {} } = params;

  try {
    // 1. Obtener datos del usuario
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios_autorizados')
      .select('nombre, telefono, email, notificaciones_push, notificaciones_email')
      .eq('id', usuario_id)
      .single();

    if (errorUsuario || !usuario) {
      console.error('Usuario no encontrado:', errorUsuario);
      return { success: false, error: 'Usuario no encontrado' };
    }

    // 2. Verificar preferencias de notificación
    if (canal === 'whatsapp' && !usuario.notificaciones_push) {
      console.log(`Usuario ${usuario.nombre} tiene notificaciones WhatsApp desactivadas`);
      return { success: false, error: 'Notificaciones WhatsApp desactivadas' };
    }

    if (canal === 'email' && !usuario.notificaciones_email) {
      console.log(`Usuario ${usuario.nombre} tiene notificaciones email desactivadas`);
      return { success: false, error: 'Notificaciones email desactivadas' };
    }

    // 3. Obtener datos del ticket
    const { data: ticket, error: errorTicket } = await supabase
      .from('tickets')
      .select(`
        numero_ticket,
        equipo_codigo,
        prioridad,
        tipo_incidente:tipos_incidente(nombre)
      `)
      .eq('id', ticket_id)
      .single();

    if (errorTicket || !ticket) {
      console.error('Ticket no encontrado:', errorTicket);
      return { success: false, error: 'Ticket no encontrado' };
    }

    // 4. Generar mensaje personalizado
    const mensaje = generarMensaje(tipo, {
      nombre_usuario: usuario.nombre,
      numero_ticket: ticket.numero_ticket || 'SIN-NUMERO',
      equipo_codigo: ticket.equipo_codigo,
      tipo_incidente: ticket.tipo_incidente?.nombre,
      prioridad: ticket.prioridad,
      ...datos_adicionales
    });

    // 5. Crear registro de notificación
    const { data: notificacion, error: errorNotif } = await supabase
      .from('notificaciones')
      .insert({
        ticket_id,
        usuario_id,
        tipo,
        canal,
        mensaje,
        estado: 'pendiente',
        prioridad,
        metadata: {
          telefono: usuario.telefono,
          email: usuario.email,
          ...datos_adicionales
        }
      })
      .select()
      .single();

    if (errorNotif || !notificacion) {
      console.error('Error creando notificación:', errorNotif);
      return { success: false, error: 'Error creando notificación' };
    }

    // 6. Enviar notificación según canal
    if (canal === 'whatsapp') {
      const enviado = await enviarWhatsApp(usuario.telefono, mensaje);
      
      if (enviado) {
        await supabase
          .from('notificaciones')
          .update({ 
            estado: 'enviado',
            enviado_at: new Date().toISOString()
          })
          .eq('id', notificacion.id);
      }
    } else if (canal === 'email' && usuario.email) {
      const enviado = await enviarEmail(usuario.email, `Ticket ${ticket.numero_ticket}`, mensaje);
      
      if (enviado) {
        await supabase
          .from('notificaciones')
          .update({ 
            estado: 'enviado',
            enviado_at: new Date().toISOString()
          })
          .eq('id', notificacion.id);
      }
    }

    console.log(`✅ Notificación ${tipo} enviada a ${usuario.nombre} vía ${canal}`);

    return { 
      success: true, 
      notificacion_id: notificacion.id 
    };

  } catch (error) {
    console.error('Error enviando notificación:', error);
    return { 
      success: false, 
      error: 'Error inesperado al enviar notificación' 
    };
  }
}

/**
 * Envía mensaje por WhatsApp (integración con Twilio)
 */
async function enviarWhatsApp(telefono: string, mensaje: string): Promise<boolean> {
  try {
    // Llamar al API route de Next.js que maneja Twilio
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: telefono,
        message: mensaje
      })
    });

    if (!response.ok) {
      console.error('Error enviando WhatsApp:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error en enviarWhatsApp:', error);
    return false;
  }
}

/**
 * Envía email (placeholder - implementar con SendGrid/Resend)
 */
async function enviarEmail(
  email: string, 
  asunto: string, 
  mensaje: string
): Promise<boolean> {
  try {
    // TODO: Implementar con SendGrid o Resend
    console.log(`📧 Email a ${email}: ${asunto}`);
    console.log(mensaje);
    
    // Por ahora solo log, luego integrar proveedor email real
    return true;
  } catch (error) {
    console.error('Error en enviarEmail:', error);
    return false;
  }
}

/**
 * Envía recordatorios para tickets antiguos sin actualización
 */
export async function enviarRecordatoriosAutomaticos(): Promise<void> {
  try {
    // Buscar tickets asignados sin actualización en 2+ horas
    const dosHorasAtras = new Date();
    dosHorasAtras.setHours(dosHorasAtras.getHours() - 2);

    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('id, asignado_a, updated_at')
      .eq('estado', 'asignado')
      .lt('updated_at', dosHorasAtras.toISOString());

    if (error || !tickets || tickets.length === 0) {
      return;
    }

    console.log(`📬 Enviando ${tickets.length} recordatorios...`);

    for (const ticket of tickets) {
      if (ticket.asignado_a) {
        await enviarNotificacion({
          ticket_id: ticket.id,
          usuario_id: ticket.asignado_a,
          tipo: 'recordatorio',
          canal: 'whatsapp',
          prioridad: 3
        });
      }
    }

  } catch (error) {
    console.error('Error enviando recordatorios:', error);
  }
}

/**
 * Marca notificación como leída
 */
export async function marcarNotificacionLeida(
  notificacion_id: string
): Promise<void> {
  await supabase
    .from('notificaciones')
    .update({ 
      estado: 'leido',
      leido_at: new Date().toISOString()
    })
    .eq('id', notificacion_id);
}
