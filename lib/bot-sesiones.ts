import { supabase } from './supabase'

// Estados posibles en el flujo de creación de ticket
export type EstadoConversacion = 
  | 'idle'
  | 'esperando_equipo'
  | 'esperando_tipo_incidente'
  | 'esperando_descripcion'
  | 'esperando_turno'
  | 'esperando_jornada'
  | 'esperando_foto_apertura'
  | 'confirmacion_ticket'

export interface SesionUsuario {
  telefono: string
  estado: EstadoConversacion
  datos_temporales: {
    equipo_codigo?: string
    equipo_id?: string
    tipo_incidente_id?: string
    tipo_incidente?: string
    descripcion?: string
    turno?: string
    jornada?: string
    foto_url?: string
  }
  ultima_actividad: string
}

/**
 * Obtiene la sesión actual del usuario
 */
export async function obtenerSesion(telefono: string): Promise<SesionUsuario | null> {
  try {
    // Usando Supabase como almacenamiento temporal de sesiones
    const { data, error } = await supabase
      .from('sesiones_bot')
      .select('*')
      .eq('telefono', telefono)
      .single()

    if (error || !data) {
      return null
    }

    return {
      telefono: data.telefono,
      estado: data.estado as EstadoConversacion,
      datos_temporales: data.datos_temporales || {},
      ultima_actividad: data.ultima_actividad
    }
  } catch (error) {
    console.error('Error obteniendo sesión:', error)
    return null
  }
}

/**
 * Guarda o actualiza la sesión del usuario
 */
export async function guardarSesion(sesion: SesionUsuario): Promise<void> {
  try {
    const { error } = await supabase
      .from('sesiones_bot')
      .upsert({
        telefono: sesion.telefono,
        estado: sesion.estado,
        datos_temporales: sesion.datos_temporales,
        ultima_actividad: new Date().toISOString()
      }, {
        onConflict: 'telefono'
      })

    if (error) {
      console.error('Error guardando sesión:', error)
    }
  } catch (error) {
    console.error('Error guardando sesión:', error)
  }
}

/**
 * Limpia la sesión del usuario (reinicia el flujo)
 */
export async function limpiarSesion(telefono: string): Promise<void> {
  try {
    await supabase
      .from('sesiones_bot')
      .delete()
      .eq('telefono', telefono)
  } catch (error) {
    console.error('Error limpiando sesión:', error)
  }
}

/**
 * Actualiza solo el estado de la sesión
 */
export async function actualizarEstado(
  telefono: string, 
  nuevoEstado: EstadoConversacion
): Promise<void> {
  const sesion = await obtenerSesion(telefono)
  
  if (sesion) {
    sesion.estado = nuevoEstado
    await guardarSesion(sesion)
  }
}

/**
 * Actualiza datos temporales de la sesión
 */
export async function actualizarDatosTemporales(
  telefono: string,
  datos: Partial<SesionUsuario['datos_temporales']>
): Promise<void> {
  const sesion = await obtenerSesion(telefono)
  
  if (sesion) {
    sesion.datos_temporales = {
      ...sesion.datos_temporales,
      ...datos
    }
    await guardarSesion(sesion)
  }
}

/**
 * Limpia sesiones inactivas (más de 1 hora)
 */
export async function limpiarSesionesInactivas(): Promise<void> {
  const unaHoraAtras = new Date()
  unaHoraAtras.setHours(unaHoraAtras.getHours() - 1)

  try {
    await supabase
      .from('sesiones_bot')
      .delete()
      .lt('ultima_actividad', unaHoraAtras.toISOString())
  } catch (error) {
    console.error('Error limpiando sesiones inactivas:', error)
  }
}
