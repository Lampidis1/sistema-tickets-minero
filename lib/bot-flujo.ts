import { supabase } from './supabase'
import {
  obtenerSesion,
  guardarSesion,
  limpiarSesion,
  actualizarDatosTemporales,
  actualizarEstado,
  type SesionUsuario
} from './bot-sesiones'

/**
 * Procesa el flujo conversacional completo del bot
 */
export async function procesarFlujoBot(
  telefono: string,
  mensaje: string,
  usuario: any
): Promise<string> {
  // Obtener o crear sesión
  let sesion = await obtenerSesion(telefono)
  
  if (!sesion) {
    sesion = {
      telefono,
      estado: 'idle',
      datos_temporales: {},
      ultima_actividad: new Date().toISOString()
    }
    await guardarSesion(sesion)
  }

  const mensajeNormalizado = mensaje.toLowerCase().trim()

  // Comandos globales que reinician el flujo
  if (['menu', 'inicio', 'cancelar', 'salir'].includes(mensajeNormalizado)) {
    await limpiarSesion(telefono)
    return generarMenuPrincipal(usuario.nombre)
  }

  // Procesar según el estado actual
  switch (sesion.estado) {
    case 'idle':
      return await procesarEstadoIdle(telefono, mensajeNormalizado, usuario)
    
    case 'esperando_equipo':
      return await procesarSeleccionEquipo(telefono, mensaje)
    
    case 'esperando_tipo_incidente':
      return await procesarSeleccionTipoIncidente(telefono, mensaje)
    
    case 'esperando_descripcion':
      return await procesarDescripcion(telefono, mensaje)
    
    case 'esperando_turno':
      return await procesarTurno(telefono, mensaje)
    
    case 'esperando_jornada':
      return await procesarJornada(telefono, mensaje)
    
    case 'esperando_foto_apertura':
      return await procesarFotoApertura(telefono, mensaje)
    
    default:
      await limpiarSesion(telefono)
      return generarMenuPrincipal(usuario.nombre)
  }
}

/**
 * Estado IDLE - Menú principal
 */
async function procesarEstadoIdle(
  telefono: string,
  mensaje: string,
  usuario: any
): Promise<string> {
  if (['hola', '1', 'nuevo ticket', 'crear ticket'].includes(mensaje)) {
    await actualizarEstado(telefono, 'esperando_equipo')
    return generarPreguntaEquipo()
  }
  
  if (['2', 'mis tickets', 'ver tickets'].includes(mensaje)) {
    return await mostrarTicketsUsuario(telefono)
  }
  
  if (['3', 'ayuda', 'help'].includes(mensaje)) {
    return generarMensajeAyuda()
  }

  // Por defecto, mostrar menú
  return generarMenuPrincipal(usuario.nombre)
}

/**
 * Paso 1: Selección de equipo
 */
async function procesarSeleccionEquipo(
  telefono: string,
  codigoEquipo: string
): Promise<string> {
  const codigo = codigoEquipo.toUpperCase().trim()

  // Buscar equipo en la base de datos
  const { data: equipo, error } = await supabase
    .from('equipos')
    .select('*')
    .eq('codigo', codigo)
    .single()

  if (error || !equipo) {
    // Intentar búsqueda parcial
    const { data: equiposParciales } = await supabase
      .from('equipos')
      .select('codigo, tipo_equipo')
      .ilike('codigo', `%${codigo}%`)
      .limit(5)

    if (equiposParciales && equiposParciales.length > 0) {
      const lista = equiposParciales
        .map(e => `• ${e.codigo} (${e.tipo_equipo})`)
        .join('\n')
      
      return `❌ No encontré exactamente "${codigoEquipo}".\n\n` +
             `¿Te refieres a alguno de estos?\n\n${lista}\n\n` +
             `Por favor escribe el código exacto.`
    }

    return `❌ No encontré el equipo "${codigoEquipo}".\n\n` +
           `Verifica el código y vuelve a intentarlo.\n\n` +
           `Ejemplos: CAEX-120, PERFORADORA-409, CM-26\n\n` +
           `O escribe *menu* para volver al inicio.`
  }

  // Equipo encontrado, guardar y avanzar
  await actualizarDatosTemporales(telefono, {
    equipo_codigo: equipo.codigo,
    equipo_id: equipo.id
  })
  await actualizarEstado(telefono, 'esperando_tipo_incidente')

  return `✅ Equipo: *${equipo.codigo}* (${equipo.tipo_equipo})\n\n` +
         generarPreguntaTipoIncidente()
}

/**
 * Paso 2: Tipo de incidente
 */
async function procesarSeleccionTipoIncidente(
  telefono: string,
  opcion: string
): Promise<string> {
  // Obtener tipos de incidente
  const { data: tipos } = await supabase
    .from('tipos_incidente')
    .select('*')
    .order('nombre')

  if (!tipos || tipos.length === 0) {
    return '❌ Error: No hay tipos de incidente configurados.'
  }

  // Intentar match por número
  const numeroOpcion = parseInt(opcion)
  let tipoSeleccionado = null

  if (!isNaN(numeroOpcion) && numeroOpcion >= 1 && numeroOpcion <= tipos.length) {
    tipoSeleccionado = tipos[numeroOpcion - 1]
  } else {
    // Intentar match por texto
    tipoSeleccionado = tipos.find(t => 
      t.nombre.toLowerCase().includes(opcion.toLowerCase())
    )
  }

  if (!tipoSeleccionado) {
    return `❌ Opción no válida.\n\n` + generarPreguntaTipoIncidente()
  }

  // Guardar y avanzar
  await actualizarDatosTemporales(telefono, {
    tipo_incidente_id: tipoSeleccionado.id,
    tipo_incidente: tipoSeleccionado.nombre
  })
  await actualizarEstado(telefono, 'esperando_descripcion')

  return `✅ Tipo: *${tipoSeleccionado.nombre}*\n\n` +
         generarPreguntaDescripcion()
}

/**
 * Paso 3: Descripción del problema
 */
async function procesarDescripcion(
  telefono: string,
  descripcion: string
): Promise<string> {
  if (descripcion.length < 10) {
    return `⚠️ La descripción es muy corta.\n\n` +
           `Por favor describe el problema con más detalle (mínimo 10 caracteres).`
  }

  await actualizarDatosTemporales(telefono, {
    descripcion: descripcion.trim()
  })
  await actualizarEstado(telefono, 'esperando_turno')

  return `✅ Descripción guardada.\n\n` + generarPreguntaTurno()
}

/**
 * Paso 4: Turno
 */
async function procesarTurno(
  telefono: string,
  turno: string
): Promise<string> {
  const turnosValidos = ['A', 'B', 'C', 'D']
  const turnoNormalizado = turno.toUpperCase().trim()

  if (!turnosValidos.includes(turnoNormalizado)) {
    return `❌ Turno no válido.\n\n` +
           `Opciones: A, B, C, D\n\n` +
           `¿En qué turno ocurrió el incidente?`
  }

  await actualizarDatosTemporales(telefono, {
    turno: turnoNormalizado
  })
  await actualizarEstado(telefono, 'esperando_jornada')

  return `✅ Turno: *${turnoNormalizado}*\n\n` + generarPreguntaJornada()
}

/**
 * Paso 5: Jornada
 */
async function procesarJornada(
  telefono: string,
  jornada: string
): Promise<string> {
  const jornadasValidas = ['día', 'dia', 'noche']
  const jornadaNormalizada = jornada.toLowerCase().trim()

  if (!jornadasValidas.includes(jornadaNormalizada)) {
    return `❌ Jornada no válida.\n\n` +
           `Opciones: *Día* o *Noche*\n\n` +
           `¿En qué jornada ocurrió?`
  }

  const jornadaFinal = jornadaNormalizada.replace('dia', 'día')
  
  await actualizarDatosTemporales(telefono, {
    jornada: jornadaFinal
  })
  await actualizarEstado(telefono, 'esperando_foto_apertura')

  return `✅ Jornada: *${jornadaFinal}*\n\n` +
         `📸 Por favor, *envía una foto* del problema.\n\n` +
         `Esto es obligatorio para documentar el incidente.`
}

/**
 * Paso 6: Foto de apertura
 */
async function procesarFotoApertura(
  telefono: string,
  mensaje: string
): Promise<string> {
  // Esta función se llamará cuando llegue la foto
  // Por ahora, solo indicamos que esperamos la foto
  return `⏳ Esperando que envíes la foto...\n\n` +
         `Usa el botón de la cámara 📷 para tomar o adjuntar una foto del problema.`
}

/**
 * Crear ticket final con todos los datos
 */
export async function crearTicketFinal(
  telefono: string,
  usuario: any,
  fotoUrl?: string
): Promise<string> {
  const sesion = await obtenerSesion(telefono)
  
  if (!sesion || !sesion.datos_temporales) {
    return '❌ Error: No hay datos de ticket para crear.'
  }

  const datos = sesion.datos_temporales

  // Validar que tengamos todos los datos necesarios
  if (!datos.equipo_id || !datos.tipo_incidente_id || !datos.descripcion) {
    return '❌ Error: Faltan datos para crear el ticket.'
  }

  // Generar número de ticket
  const numeroTicket = await generarNumeroTicket()

  // Crear ticket en la base de datos
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      numero_ticket: numeroTicket,
      tipo: 'incidente',
      creado_por: usuario.id,
      telefono_creador: telefono,
      equipo_id: datos.equipo_id,
      equipo_codigo: datos.equipo_codigo,
      tipo_incidente_id: datos.tipo_incidente_id,
      breve_descripcion: datos.descripcion,
      turno: datos.turno,
      jornada: datos.jornada,
      estado: 'nuevo',
      prioridad: 3,
      origen_creacion: 'whatsapp',
      foto_apertura_url: fotoUrl,
      fecha_apertura: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error creando ticket:', error)
    return '❌ Error al crear el ticket. Por favor intenta nuevamente.'
  }

  // Registrar en historial
  await supabase.from('historial_estados').insert({
    ticket_id: ticket.id,
    estado_anterior: null,
    estado_nuevo: 'nuevo',
    usuario_id: usuario.id,
    comentario: 'Ticket creado vía WhatsApp'
  })

  // Limpiar sesión
  await limpiarSesion(telefono)

  // Mensaje de confirmación
  return `✅ *Ticket creado exitosamente*\n\n` +
         `📋 Número: *${numeroTicket}*\n` +
         `🔧 Equipo: ${datos.equipo_codigo}\n` +
         `⚠️ Problema: ${datos.tipo_incidente}\n` +
         `📝 ${datos.descripcion}\n` +
         `⏰ Turno ${datos.turno} - ${datos.jornada}\n\n` +
         `Un técnico será asignado pronto.\n` +
         `Recibirás actualizaciones por WhatsApp.\n\n` +
         `Escribe *menu* para volver al inicio.`
}

// ============= FUNCIONES AUXILIARES =============

function generarMenuPrincipal(nombreUsuario: string): string {
  return `👋 Hola *${nombreUsuario}*!\n\n` +
         `Soy el asistente de tickets de mantenimiento.\n\n` +
         `¿Qué necesitas hacer?\n\n` +
         `1️⃣ *Nuevo Ticket* - Reportar un problema\n` +
         `2️⃣ *Mis Tickets* - Ver mis tickets activos\n` +
         `3️⃣ *Ayuda* - Instrucciones de uso\n\n` +
         `Escribe el número o la opción que necesites.`
}

function generarPreguntaEquipo(): string {
  return `🔧 *¿Qué equipo tiene el problema?*\n\n` +
         `Escribe el código del equipo:\n\n` +
         `Ejemplos:\n` +
         `• CAEX-120\n` +
         `• PERFORADORA-409\n` +
         `• CM-26\n` +
         `• PALA-02`
}

function generarPreguntaTipoIncidente(): string {
  return `⚠️ *¿Qué tipo de problema es?*\n\n` +
         `Selecciona escribiendo el número:\n\n` +
         `1. Falla eléctrica\n` +
         `2. Falla mecánica\n` +
         `3. Falla hidráulica\n` +
         `4. Falla de neumáticos\n` +
         `5. Otro problema`
}

function generarPreguntaDescripcion(): string {
  return `📝 *Describe el problema*\n\n` +
         `Explica con detalle qué está fallando:\n\n` +
         `(Mínimo 10 caracteres)`
}

function generarPreguntaTurno(): string {
  return `⏰ *¿En qué turno ocurrió?*\n\n` +
         `Escribe la letra del turno: A, B, C o D`
}

function generarPreguntaJornada(): string {
  return `🌓 *¿En qué jornada ocurrió?*\n\n` +
         `Escribe: *Día* o *Noche*`
}

function generarMensajeAyuda(): string {
  return `📚 *Ayuda del Sistema*\n\n` +
         `*Comandos disponibles:*\n\n` +
         `• *menu* - Ver menú principal\n` +
         `• *nuevo ticket* - Crear incidente\n` +
         `• *mis tickets* - Ver mis tickets\n` +
         `• *cancelar* - Cancelar operación actual\n\n` +
         `*Para crear un ticket necesitarás:*\n` +
         `1. Código del equipo\n` +
         `2. Tipo de problema\n` +
         `3. Descripción detallada\n` +
         `4. Turno y jornada\n` +
         `5. Foto del problema\n\n` +
         `Escribe *menu* para volver al inicio.`
}

async function mostrarTicketsUsuario(telefono: string): Promise<string> {
  const { data: tickets } = await supabase
    .from('tickets')
    .select('numero_ticket, equipo_codigo, breve_descripcion, estado, fecha_apertura')
    .eq('telefono_creador', telefono)
    .neq('estado', 'cerrado')
    .order('fecha_apertura', { ascending: false })
    .limit(5)

  if (!tickets || tickets.length === 0) {
    return `📋 No tienes tickets activos.\n\n` +
           `¿Necesitas crear uno? Escribe *nuevo ticket*`
  }

  let mensaje = `📋 *Tus Tickets Activos*\n\n`
  
  tickets.forEach((ticket, index) => {
    const fecha = new Date(ticket.fecha_apertura).toLocaleDateString('es-CL')
    const estadoEmoji = ticket.estado === 'nuevo' ? '🆕' : 
                       ticket.estado === 'en_proceso' ? '⚙️' : '✅'
    
    mensaje += 
      `${index + 1}. ${estadoEmoji} *${ticket.numero_ticket}*\n` +
      `   Equipo: ${ticket.equipo_codigo}\n` +
      `   Estado: ${ticket.estado}\n` +
      `   Fecha: ${fecha}\n\n`
  })

  mensaje += `Escribe *menu* para volver al inicio.`
  return mensaje
}

async function generarNumeroTicket(): Promise<string> {
  const fecha = new Date()
  const año = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  
  // Obtener el último número del mes
  const { data: ultimoTicket } = await supabase
    .from('tickets')
    .select('numero_ticket')
    .like('numero_ticket', `INC${año}${mes}%`)
    .order('numero_ticket', { ascending: false })
    .limit(1)
    .single()

  let secuencia = 1
  
  if (ultimoTicket && ultimoTicket.numero_ticket) {
    const ultimoNumero = parseInt(ultimoTicket.numero_ticket.slice(-4))
    secuencia = ultimoNumero + 1
  }

  return `INC${año}${mes}${String(secuencia).padStart(4, '0')}`
}
