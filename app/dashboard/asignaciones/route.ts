import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { to, message } = await request.json();

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Faltan parámetros: to y message son requeridos' },
        { status: 400 }
      );
    }

    // Credenciales Twilio (desde variables de entorno)
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER; // ej: whatsapp:+14155238886

    if (!accountSid || !authToken || !twilioNumber) {
      console.error('Faltan credenciales de Twilio en variables de entorno');
      return NextResponse.json(
        { error: 'Configuración de Twilio incompleta' },
        { status: 500 }
      );
    }

    // Formatear número destino (debe empezar con whatsapp:+)
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    // Enviar mensaje via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formBody = new URLSearchParams({
      From: twilioNumber,
      To: toNumber,
      Body: message
    });

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de Twilio:', errorText);
      return NextResponse.json(
        { error: 'Error enviando mensaje WhatsApp', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log(`✅ WhatsApp enviado a ${to}. SID: ${data.sid}`);

    return NextResponse.json({
      success: true,
      messageSid: data.sid,
      status: data.status
    });

  } catch (error) {
    console.error('Error en /api/whatsapp/send:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
