import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos de la base de datos
export type Ticket = {
  id: string
  numero_ticket: string
  tipo: string
  equipo_codigo: string
  breve_descripcion: string
  prioridad: number
  estado: string
  turno?: string
  jornada?: string
  area?: string
  telefono_creador: string
  fecha_apertura: string
  created_at: string
}

export type Equipment = {
  id: string
  codigo: string
  tipo_equipo: string
  modelo?: string
  area?: string
  estado: string
  created_at: string
}

export type User = {
  id: string
  telefono: string
  nombre: string
  rol: string
  area?: string
  especialidad?: string
  activo: boolean
  created_at: string
}
