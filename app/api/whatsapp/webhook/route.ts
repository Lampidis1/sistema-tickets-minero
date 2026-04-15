import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extraer datos del mensaje de Twilio
    const from = formData.get('From') as string; // whatsapp:+56912345678
    const body = formData.get('Body') as string;
    const messageId = formData.get('MessageSid') as string;
    const numMedia = parseInt(formData.get('NumMedia') as string || '0');

    // Limpiar número de teléfono
    const phoneNumber = from?.replace('whatsapp:', '') || '';

    console.log(`📱 Mensaje WhatsApp recibido de ${phoneNumber}: "${body}"`);

    // 1. Verificar si el usuario está autorizado
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios_autorizados')
      .select('id, nombre, rol')
      .eq('telefono', phoneNumber)
      .eq('activo', true)
      .single();

    if (errorUsuario || !usuario) {
      console.log(`❌ Usuario no autorizado: ${phoneNumber}`);
      
      await enviarRespuesta(phoneNumber, 
        '🚫 Lo siento, no estás autorizado para usar este sistema.\n\n' +
        'Contacta a tu supervisor para solicitar acceso.'
      );
      
      return new NextResponse('OK', { status: 200 });
    }

    // 2. Obtener o crear sesión del bot
    let { data: sesion, error: errorSesion } = await supabase
      .from('sesiones_bot')
      .select('*')
      .eq('telefono', phoneNumber)
      .single();

    if (errorSesion || !sesion) {
      // Crear nueva sesión
      const { data: nuevaSesion } = await supabase
        .from('sesiones_bot')
        .insert({
          telefono: phoneNumber,
          estado: 'idle',
          datos_temporales: {},
          ultima_actividad: new Date().toISOString()
        })
        .select()
        .single();
      
      sesion = nuevaSesion;
    }

    // 3. Actualizar última actividad
    await supabase
      .from('sesiones_bot')
      .update({ ultima_actividad: new Date().toISOString() })
      .eq('telefono', phoneNumber);

    // 4. Registrar mensaje entrante
    await supabase
      .from('mensajes_whatsapp')
      .insert({
        telefono: phoneNumber,
        mensaje: body,
        tipo: numMedia > 0 ? 'imagen' : 'texto',
        direccion: 'entrante',
        estado: 'recibido',
        mensaje_id_whatsapp: messageId
      });

    // 5. Procesar mensaje según estado de la sesión
    const respuesta = await procesarMensaje(usuario, sesion, body, numMedia > 0);

    // 6. Enviar respuesta
    if (respuesta) {
      await enviarRespuesta(phoneNumber, respuesta);
      
      // Registrar respuesta saliente
      await supabase
        .from('mensajes_whatsapp')
        .insert({
          telefono: phoneNumber,
          mensaje: respuesta,
          tipo: 'texto',
          direccion: 'saliente',
          estado: 'enviado'
        });
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Error procesando webhook WhatsApp:', error);
    return new NextResponse('Error', { status: 500 });
  }
}

async function procesarMensaje(
  usuario: any,
  sesion: any,
  mensaje: string,
  tieneMedia: boolean
): Promise<string | null> {
  const mensajeLower = mensaje.toLowerCase().trim();
  const estado = sesion.estado;
  const datos = sesion.datos_temporales || {};

  // Estado: IDLE (esperando comando)
  if (estado === 'idle') {
    if (mensajeLower.match(/^(hola|hi|hello|buenos|buenas)/)) {
      // Obtener lista de equipos
      const { data: equipos } = await supabase
        .from('equipos')
        .select('codigo, tipo_equipo')
        .order('tipo_equipo');

      if (!equipos || equipos.length === 0) {
        return '❌ No hay equipos registrados en el sistema.';
      }

      // Agrupar equipos por tipo
      const grouped: Record<string, string[]> = {};
      equipos.forEach(eq => {
        const tipo = eq.tipo_equipo || 'Otros';
        if (!grouped[tipo]) grouped[tipo] = [];
        grouped[tipo].push(eq.codigo);
      });

      // Generar mensaje de bienvenida
      let mapa = `👋 ¡Hola ${usuario.nombre}!\n\n`;
      mapa += '📋 EQUIPOS DISPONIBLES:\n\n';

      const emojis: Record<string, string> = {
        'CAEX (Camiones)': '🚛',
        'CM (Carros Mineros)': '🚗',
        'Perforadora': '⛏️',
        'Pala': '🏗️'
      };

      for (const [tipo, lista] of Object.entries(grouped)) {
        const emoji = emojis[tipo] || '🔧';
        mapa += `${emoji} ${tipo.toUpperCase()} (${lista.length} equipos)\n`;
        lista.forEach(codigo => {
          mapa += `   • ${codigo}\n`;
        });
        mapa += '\n';
      }

      mapa += '\n📝 Para crear un ticket, describe el problema.\n';
      mapa += 'Ejemplo: "CAEX 120 tiene fuga de aceite"';

      return mapa;
    }

    // Intento de crear ticket (mensaje libre)
    return 'Para crear un ticket, escribe "hola" para ver los equipos disponibles.\n\n' +
           'O describe directamente el problema:\n' +
           'Ejemplo: "CAEX 120 tiene falla eléctrica"';
  }

  // Otros estados del bot aquí...
  // TODO: Implementar flujo completo de creación de tickets

  return null;
}

async function enviarRespuesta(to: string, message: string): Promise<void> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message })
    });

    if (!response.ok) {
      console.error('Error enviando respuesta WhatsApp');
    }
  } catch (error) {
    console.error('Error en enviarRespuesta:', error);
  }
}
