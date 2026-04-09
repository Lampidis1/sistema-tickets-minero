'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { ArrowLeft, Wrench, AlertCircle, Clock, FileText } from 'lucide-react'
import Link from 'next/link'

type Equipo = {
  id: string
  codigo: string
  tipo_equipo: string
  modelo?: string
  area?: string
  sistema?: string
  sub_sistema?: string
  estado: string
  created_at: string
}

type Ticket = {
  id: string
  numero_ticket: string
  tipo: string
  breve_descripcion: string
  prioridad: number
  estado: string
  fecha_apertura: string
  created_at: string
}

export default function EquipoDetailPage() {
  const params = useParams()
  const equipoId = params.id as string

  const [equipo, setEquipo] = useState<Equipo | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (equipoId) {
      loadEquipoDetail()
    }
  }, [equipoId])

  async function loadEquipoDetail() {
    try {
      // Cargar equipo
      const { data: equipoData, error: equipoError } = await supabase
        .from('equipos')
        .select('*')
        .eq('id', equipoId)
        .single()

      if (equipoError) throw equipoError
      setEquipo(equipoData)

      // Cargar tickets del equipo
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, numero_ticket, tipo, breve_descripcion, prioridad, estado, fecha_apertura, created_at')
        .eq('equipo_codigo', equipoData.codigo)
        .order('created_at', { ascending: false })

      if (!ticketsError && ticketsData) {
        setTickets(ticketsData)
      }

    } catch (error) {
      console.error('Error cargando equipo:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando equipo...</p>
        </div>
      </div>
    )
  }

  if (!equipo) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Equipo no encontrado</h2>
        <p className="text-gray-600 mb-6">El equipo que buscas no existe o fue eliminado.</p>
        <Link
          href="/dashboard/equipos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Equipos
        </Link>
      </div>
    )
  }

  const ticketsAbiertos = tickets.filter(t => t.estado !== 'cerrado' && t.estado !== 'resuelto')
  const ticketsCriticos = tickets.filter(t => t.prioridad === 1)
  const ticketsCerrados = tickets.filter(t => t.estado === 'cerrado')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/equipos"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{equipo.codigo}</h1>
            <p className="text-gray-600 mt-1">{getTipoEquipoLabel(equipo.tipo_equipo)}</p>
          </div>
        </div>
        <EstadoBadge estado={equipo.estado} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del Equipo */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Información del Equipo</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Código">
                <span className="font-semibold">{equipo.codigo}</span>
              </InfoRow>

              <InfoRow label="Tipo">
                {getTipoEquipoLabel(equipo.tipo_equipo)}
              </InfoRow>

              {equipo.modelo && (
                <InfoRow label="Modelo">
                  {equipo.modelo}
                </InfoRow>
              )}

              {equipo.area && (
                <InfoRow label="Área">
                  {equipo.area}
                </InfoRow>
              )}

              {equipo.sistema && (
                <InfoRow label="Sistema">
                  {equipo.sistema}
                </InfoRow>
              )}

              {equipo.sub_sistema && (
                <InfoRow label="Sub-Sistema">
                  {equipo.sub_sistema}
                </InfoRow>
              )}

              <InfoRow label="Estado">
                <EstadoBadge estado={equipo.estado} />
              </InfoRow>

              <InfoRow label="Fecha de Registro">
                {new Date(equipo.created_at).toLocaleDateString('es-CL')}
              </InfoRow>
            </div>
          </div>

          {/* Historial de Tickets */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Historial de Tickets</h2>
              <Link
                href={`/dashboard/tickets?equipo=${equipo.codigo}`}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Ver todos
              </Link>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p>No hay tickets registrados para este equipo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-blue-600">
                            {ticket.numero_ticket}
                          </span>
                          <PriorityBadge priority={ticket.prioridad} />
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{ticket.breve_descripcion}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="capitalize">{ticket.tipo}</span>
                          <span>•</span>
                          <span>
                            {new Date(ticket.fecha_apertura).toLocaleDateString('es-CL', {
                              dateStyle: 'short'
                            })}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={ticket.estado} />
                    </div>
                  </Link>
                ))}
                
                {tickets.length > 5 && (
                  <div className="text-center pt-2">
                    <Link
                      href={`/dashboard/tickets?equipo=${equipo.codigo}`}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Ver {tickets.length - 5} tickets más
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna Lateral */}
        <div className="space-y-6">
          {/* Estadísticas Rápidas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Estadísticas</h3>
            <div className="space-y-3">
              <StatRow label="Total Tickets" value={tickets.length} color="text-blue-800" />
              <StatRow label="Tickets Abiertos" value={ticketsAbiertos.length} color="text-yellow-800" />
              <StatRow label="Tickets Críticos" value={ticketsCriticos.length} color="text-red-800" />
              <StatRow label="Tickets Cerrados" value={ticketsCerrados.length} color="text-green-800" />
            </div>
          </div>

          {/* Acciones */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Acciones</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Crear Ticket
              </button>
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                Programar Mantenimiento
              </button>
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                Editar Equipo
              </button>
              <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                Ver Historial Completo
              </button>
            </div>
          </div>

          {/* Estado del Equipo */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Estado Actual</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  equipo.estado === 'operativo' ? 'bg-green-500' :
                  equipo.estado === 'mantenimiento' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium capitalize">
                  {equipo.estado === 'operativo' ? 'Operativo' :
                   equipo.estado === 'mantenimiento' ? 'En Mantenimiento' :
                   'Fuera de Servicio'}
                </span>
              </div>
              
              {ticketsCriticos.length > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {ticketsCriticos.length} ticket{ticketsCriticos.length !== 1 ? 's' : ''} crítico{ticketsCriticos.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              
              {ticketsAbiertos.length > 0 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {ticketsAbiertos.length} ticket{ticketsAbiertos.length !== 1 ? 's' : ''} abierto{ticketsAbiertos.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componentes auxiliares
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <div className="text-gray-900">{children}</div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles = {
    operativo: 'bg-green-100 text-green-800 border-green-200',
    mantenimiento: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    fuera_servicio: 'bg-red-100 text-red-800 border-red-200',
  }

  const labels = {
    operativo: 'Operativo',
    mantenimiento: 'En Mantenimiento',
    fuera_servicio: 'Fuera de Servicio',
  }

  return (
    <span className={`px-4 py-2 rounded-full text-sm font-medium border ${styles[estado as keyof typeof styles] || styles.operativo}`}>
      {labels[estado as keyof typeof labels] || estado}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    nuevo: 'bg-red-100 text-red-800',
    asignado: 'bg-blue-100 text-blue-800',
    en_proceso: 'bg-yellow-100 text-yellow-800',
    resuelto: 'bg-green-100 text-green-800',
    cerrado: 'bg-gray-100 text-gray-800',
  }

  const labels = {
    nuevo: 'Nuevo',
    asignado: 'Asignado',
    en_proceso: 'En Proceso',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.nuevo}`}>
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
    1: '🔴',
    2: '🟠',
    3: '🟡',
    4: '🟢',
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[priority as keyof typeof styles] || styles[3]}`}>
      {labels[priority as keyof typeof labels]}
    </span>
  )
}

function getTipoEquipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    CAEX: 'CAEX (Camión)',
    CM: 'CM (Carro Minero)',
    PERFORADORA: 'Perforadora',
    PALA: 'Pala',
    FASE: 'FASE',
    CARRO_MOVIL: 'Carro Móvil',
  }
  return labels[tipo] || tipo
}
