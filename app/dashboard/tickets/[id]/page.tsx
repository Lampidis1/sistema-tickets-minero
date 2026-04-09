'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, User, Wrench, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'

type Ticket = {
  id: string
  numero_ticket: string
  tipo: string
  equipo_codigo: string
  breve_descripcion: string
  notas_trabajo?: string
  prioridad: number
  estado: string
  turno?: string
  jornada?: string
  area?: string
  telefono_creador: string
  creado_por?: string
  asignado_a?: string
  fecha_apertura: string
  fecha_cierre?: string
  origen_creacion: string
  created_at: string
}

type HistorialEstado = {
  id: string
  estado_anterior: string
  estado_nuevo: string
  changed_at: string
  changed_by?: string
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [historial, setHistorial] = useState<HistorialEstado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (ticketId) {
      loadTicketDetail()
    }
  }, [ticketId])

  async function loadTicketDetail() {
    try {
      // Cargar ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single()

      if (ticketError) throw ticketError
      setTicket(ticketData)

      // Cargar historial
      const { data: historialData, error: historialError } = await supabase
        .from('historial_estados')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('changed_at', { ascending: false })

      if (!historialError && historialData) {
        setHistorial(historialData)
      }

    } catch (error) {
      console.error('Error cargando ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateEstado(nuevoEstado: string) {
    if (!ticket) return

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ estado: nuevoEstado })
        .eq('id', ticket.id)

      if (error) throw error
      
      // Recargar datos
      loadTicketDetail()
      
      alert('Estado actualizado correctamente')
    } catch (error) {
      console.error('Error actualizando estado:', error)
      alert('Error al actualizar el estado')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando ticket...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket no encontrado</h2>
        <p className="text-gray-600 mb-6">El ticket que buscas no existe o fue eliminado.</p>
        <Link
          href="/dashboard/tickets"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Tickets
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/tickets"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Ticket {ticket.numero_ticket}
            </h1>
            <p className="text-gray-600 mt-1">
              Creado el {new Date(ticket.fecha_apertura).toLocaleString('es-CL')}
            </p>
          </div>
        </div>
        <StatusBadge status={ticket.estado} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información Principal */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Información del Ticket</h2>
            
            <div className="space-y-4">
              <InfoRow icon={<Wrench className="w-5 h-5" />} label="Equipo">
                <span className="font-semibold">{ticket.equipo_codigo}</span>
              </InfoRow>

              <InfoRow icon={<AlertCircle className="w-5 h-5" />} label="Tipo">
                <span className="capitalize">{ticket.tipo}</span>
              </InfoRow>

              <InfoRow label="Prioridad">
                <PriorityBadge priority={ticket.prioridad} />
              </InfoRow>

              {ticket.area && (
                <InfoRow label="Área">
                  {ticket.area}
                </InfoRow>
              )}

              {ticket.turno && (
                <InfoRow icon={<Clock className="w-5 h-5" />} label="Turno">
                  Turno {ticket.turno} - {ticket.jornada}
                </InfoRow>
              )}

              <InfoRow icon={<User className="w-5 h-5" />} label="Creador">
                {ticket.telefono_creador}
              </InfoRow>

              <InfoRow label="Origen">
                <span className="capitalize">{ticket.origen_creacion}</span>
              </InfoRow>
            </div>
          </div>

          {/* Descripción */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Descripción</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {ticket.breve_descripcion}
            </p>
          </div>

          {/* Notas de Trabajo */}
          {ticket.notas_trabajo && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Notas de Trabajo</h2>
              <p className="text-gray-700 whitespace-pre-wrap">
                {ticket.notas_trabajo}
              </p>
            </div>
          )}

          {/* Fotos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Fotografías
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Foto de Apertura</p>
                <p className="text-xs text-gray-400 mt-1">Sin foto</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Foto de Cierre</p>
                <p className="text-xs text-gray-400 mt-1">Sin foto</p>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Lateral */}
        <div className="space-y-6">
          {/* Acciones Rápidas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Acciones</h3>
            <div className="space-y-2">
              {ticket.estado === 'nuevo' && (
                <button
                  onClick={() => updateEstado('en_proceso')}
                  className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Poner En Proceso
                </button>
              )}
              {ticket.estado === 'en_proceso' && (
                <button
                  onClick={() => updateEstado('resuelto')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Marcar como Resuelto
                </button>
              )}
              {ticket.estado === 'resuelto' && (
                <button
                  onClick={() => updateEstado('cerrado')}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cerrar Ticket
                </button>
              )}
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Asignar Técnico
              </button>
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Agregar Nota
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Historial</h3>
            <div className="space-y-4">
              {/* Evento de creación */}
              <TimelineEvent
                icon={<CheckCircle className="w-4 h-4" />}
                title="Ticket Creado"
                date={ticket.fecha_apertura}
                color="text-blue-600"
              />

              {/* Eventos de cambio de estado */}
              {historial.map((evento) => (
                <TimelineEvent
                  key={evento.id}
                  icon={<AlertCircle className="w-4 h-4" />}
                  title={`Cambio: ${formatEstado(evento.estado_anterior)} → ${formatEstado(evento.estado_nuevo)}`}
                  date={evento.changed_at}
                  color="text-gray-600"
                />
              ))}

              {ticket.fecha_cierre && (
                <TimelineEvent
                  icon={<CheckCircle className="w-4 h-4" />}
                  title="Ticket Cerrado"
                  date={ticket.fecha_cierre}
                  color="text-green-600"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componentes auxiliares
function InfoRow({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-gray-400 mt-0.5">{icon}</div>}
      <div className="flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="text-gray-900 mt-0.5">{children}</div>
      </div>
    </div>
  )
}

function TimelineEvent({ icon, title, date, color }: any) {
  return (
    <div className="flex gap-3">
      <div className={`${color} mt-1`}>{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">
          {new Date(date).toLocaleString('es-CL', {
            dateStyle: 'short',
            timeStyle: 'short'
          })}
        </p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    nuevo: 'bg-red-100 text-red-800 border-red-200',
    asignado: 'bg-blue-100 text-blue-800 border-blue-200',
    en_proceso: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    resuelto: 'bg-green-100 text-green-800 border-green-200',
    cerrado: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  const labels = {
    nuevo: 'Nuevo',
    asignado: 'Asignado',
    en_proceso: 'En Proceso',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
  }

  return (
    <span className={`px-4 py-2 rounded-full text-sm font-medium border ${styles[status as keyof typeof styles] || styles.nuevo}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  const styles = {
    1: 'bg-red-500 text-white',
    2: 'bg-orange-500 text-white',
    3: 'bg-yellow-500 text-white',
    4: 'bg-green-500 text-white',
  }

  const labels = {
    1: '🔴 Crítico',
    2: '🟠 Alta',
    3: '🟡 Media',
    4: '🟢 Baja',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[priority as keyof typeof styles] || styles[3]}`}>
      {labels[priority as keyof typeof labels] || 'Media'}
    </span>
  )
}

function formatEstado(estado: string): string {
  const labels: Record<string, string> = {
    nuevo: 'Nuevo',
    asignado: 'Asignado',
    en_proceso: 'En Proceso',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
  }
  return labels[estado] || estado
}
