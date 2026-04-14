import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Token de verificación de Meta (configurar en variables de entorno)
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto_12345'

/**
 * GET - Verificación de webhook de Meta
 * Meta envía este request para verificar que el endpoint es válido
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    console.log('📞 Verificación de webhook Meta:', { mode, token, challenge })

    // Verificar que sea el modo de suscripción y el token correcto
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente')
      return new NextResponse(challenge, { status: 200 })
    } else {
      console.log('❌ Verificación fallida')
      return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
    }
  } catch (error) {
    console.error('Error en verificación:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * POST - Recibir mensajes de WhatsApp
 * Meta envía mensajes aquí cuando los usuarios escriben al bot
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📨 Webhook recibido:', JSON.stringify(body, null, 2))

    // Verificar que venga del webhook de WhatsApp
    if (!body.entry || !body.entry[0]?.changes) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const changes = body.entry[0].changes[0]
    const value = changes.value

    // Verificar que haya mensajes
    if (!value.messages || value.messages.length === 0) {
      console.log('ℹ️  No hay mensajes en este webhook (puede ser status update)')
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // Procesar cada mensaje
    for (const message of value.messages) {
      await processIncomingMessage(message, value.metadata)
    }

    // Responder 200 inmediatamente a Meta (requerido)
    return NextResponse.json({ status: 'ok' }, { status: 200 })

  } catch (error) {
    console.error('❌ Error procesando webhook:', error)
    // Aunque haya error, respondemos 200 para que Meta no reintente
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}

/**
 * Procesar un mensaje entrante de WhatsApp
 */
async function processIncomingMessage(message: any, metadata: any) {
  const telefono = message.from // Número de teléfono del usuario
  const messageType = message.type // text, image, etc.
  const messageId = message.id
  const timestamp = message.timestamp

  console.log(`📱 Procesando mensaje de ${telefono} (tipo: ${messageType})`)

  // 1. Verificar si el usuario está autorizado
  const { data: usuario, error: userError } = await supabase
    .from('usuarios_autorizados')
    .select('*')
    .eq('telefono', telefono)
    .eq('activo', true)
    .single()

  if (userError || !usuario) {
    console.log(`⚠️  Usuario no autorizado: ${telefono}`)
    await sendWhatsAppMessage(telefono, 
      '❌ Lo siento, no estás autorizado para usar este sistema. Contacta al administrador.'
    )
    return
  }

  console.log(`✅ Usuario autorizado: ${usuario.nombre} (${usuario.rol})`)

  // 2. Guardar mensaje en BD
  await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: messageType === 'text' ? message.text.body : `[${messageType}]`,
    tipo: messageType,
    direccion: 'entrante',
    mensaje_id_whatsapp: messageId,
    estado: 'recibido'
  })

  // 3. Procesar según el tipo de mensaje
  if (messageType === 'text') {
    await handleTextMessage(message, usuario)
  } else if (messageType === 'image') {
    await handleImageMessage(message, usuario)
  } else if (messageType === 'interactive') {
    await handleInteractiveResponse(message, usuario)
  } else {
    console.log(`ℹ️  Tipo de mensaje no soportado: ${messageType}`)
  }
}

/**
 * Manejar mensaje de texto
 */
async function handleTextMessage(message: any, usuario: any) {
  const texto = message.text.body
  const telefono = message.from

  console.log(`💬 Texto recibido: "${texto}"`)

  // Importar el procesador de flujo
  const { procesarFlujoBot } = await import('@/lib/bot-flujo')
  
  // Procesar el mensaje a través del flujo conversacional
  const respuesta = await procesarFlujoBot(telefono, texto, usuario)
  
  // Enviar respuesta
  await sendWhatsAppMessage(telefono, respuesta)
}

/**
 * Manejar imagen recibida
 */
async function handleImageMessage(message: any, usuario: any) {
  const telefono = message.from
  const imageId = message.image.id
  const caption = message.image.caption || ''

  console.log(`🖼️  Imagen recibida: ${imageId}`)

  // Importar funciones necesarias
  const { obtenerSesion } = await import('@/lib/bot-sesiones')
  const { crearTicketFinal } = await import('@/lib/bot-flujo')
  
  // Verificar si estamos en el flujo de creación de ticket
  const sesion = await obtenerSesion(telefono)
  
  if (sesion && sesion.estado === 'esperando_foto_apertura') {
    // Descargar imagen de WhatsApp y subirla a Supabase Storage
    const fotoUrl = await descargarYSubirImagen(imageId, telefono)
    
    if (fotoUrl) {
      // Crear el ticket con la foto
      const respuesta = await crearTicketFinal(telefono, usuario, fotoUrl)
      await sendWhatsAppMessage(telefono, respuesta)
    } else {
      await sendWhatsAppMessage(telefono,
        `❌ Error al procesar la imagen.\n\n` +
        `Por favor intenta nuevamente o escribe *menu* para reiniciar.`
      )
    }
  } else {
    // No estamos en un flujo de ticket, solo confirmar recepción
    await sendWhatsAppMessage(telefono,
      `✅ Imagen recibida.\n\n` +
      `${caption ? `Descripción: ${caption}\n\n` : ''}` +
      `Escribe *nuevo ticket* para crear un reporte con foto.`
    )
  }
}

/**
 * Manejar respuesta a botones interactivos
 */
async function handleInteractiveResponse(message: any, usuario: any) {
  const telefono = message.from
  const response = message.interactive

  if (response.type === 'button_reply') {
    const buttonId = response.button_reply.id
    console.log(`🔘 Botón presionado: ${buttonId}`)
    
    // Procesar según el botón
    if (buttonId === 'nuevo_ticket') {
      await iniciarCreacionTicket(telefono, usuario)
    } else if (buttonId === 'mis_tickets') {
      await mostrarMisTickets(telefono, usuario)
    }
  } else if (response.type === 'list_reply') {
    const listId = response.list_reply.id
    console.log(`📋 Opción de lista seleccionada: ${listId}`)
    
    // Procesar selección de lista (equipos, tipos de incidente, etc.)
  }
}


/**
 * Enviar mensaje de WhatsApp
 * Esta función se conectará con la API de WhatsApp Business
 */
async function sendWhatsAppMessage(to: string, message: string) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️  Credenciales de WhatsApp no configuradas. Mensaje no enviado.')
    console.log(`Mensaje que se enviaría a ${to}:`, message)
    return
  }

  try {
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
          to: to,
          type: 'text',
          text: { body: message }
        })
      }
    )

    const data = await response.json()
    
    if (!response.ok) {
      console.error('❌ Error enviando mensaje WhatsApp:', data)
      return
    }

    console.log('✅ Mensaje enviado a WhatsApp:', data.messages?.[0]?.id)

    // Guardar mensaje enviado en BD
    await supabase.from('mensajes_whatsapp').insert({
      telefono: to,
      mensaje: message,
      tipo: 'texto',
      direccion: 'saliente',
      mensaje_id_whatsapp: data.messages?.[0]?.id,
      estado: 'enviado'
    })

  } catch (error) {
    console.error('❌ Error enviando mensaje:', error)
  }
}

/**
 * Descargar imagen de WhatsApp y subirla a Supabase Storage
 */
async function descargarYSubirImagen(
  mediaId: string,
  telefono: string
): Promise<string | null> {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN

  if (!WHATSAPP_TOKEN) {
    console.error('❌ Token de WhatsApp no configurado')
    return null
  }

  try {
    // 1. Obtener URL de la imagen
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        }
      }
    )

    const mediaData = await mediaResponse.json()
    const mediaUrl = mediaData.url

    if (!mediaUrl) {
      console.error('❌ No se pudo obtener URL de la imagen')
      return null
    }

    // 2. Descargar la imagen
    const imageResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      }
    })

    if (!imageResponse.ok) {
      console.error('❌ Error descargando imagen')
      return null
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    
    // 3. Subir a Supabase Storage
    const fileName = `ticket-${telefono}-${Date.now()}.jpg`
    const filePath = `tickets-fotos/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ticket-photos')
      .upload(filePath, imageBuffer, {
        contentType,
        cacheControl: '31536000' // 1 año
      })

    if (uploadError) {
      console.error('❌ Error subiendo imagen a Supabase:', uploadError)
      return null
    }

    // 4. Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('ticket-photos')
      .getPublicUrl(filePath)

    console.log('✅ Imagen subida exitosamente:', urlData.publicUrl)
    return urlData.publicUrl

  } catch (error) {
    console.error('❌ Error en proceso de imagen:', error)
    return null
  }
}
