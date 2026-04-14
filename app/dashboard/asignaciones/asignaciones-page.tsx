'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Activity, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react'

type Tecnico = {
  id: string
  nombre: string
  rol: string
  especialidad?: string
  telefono: string
  tickets_activos: number
  disponible: boolean
  acepta_emergencias: boolean
  prioridad_asignacion: number
  turno_actual?: string
  ultima_asignacion?: string
}

type TicketPendiente = {
  id: string
  numero_ticket: string
  equipo_codigo: string
  breve_descripcion: string
  prioridad: number
  tipo: string
  fecha_apertura: string
  tipo_incidente?: { nombre: string, categoria: string }
}

export default function AsignacionesPage() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [ticketsPendientes, setTicketsPendientes] = useState<TicketPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [selectedTecnico, setSelectedTecnico] = useState<string | null>(null)

  useEffect(() => {
    loadData()

    // Realtime updates
    const subscription = supabase
      .channel('asignaciones-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => loadData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'usuarios_autorizados' },
        () => loadData()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadData() {
    try {
      // Cargar técnicos
      const { data: tecnicosData } = await supabase
        .from('usuarios_autorizados')
        .select('*')
        .in('rol', ['tecnico', 'supervisor'])
        .eq('activo', true)
        .order('tickets_activos')

      // Cargar tickets pendientes de asignación
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*, tipo_incidente:tipos_incidente(*)')
        .eq('estado', 'nuevo')
        .is('asignado_a', null)
        .order('prioridad')
        .order('fecha_apertura')

      setTecnicos(tecnicosData || [])
      setTicketsPendientes(ticketsData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function asignarManualmente() {
    if (!selectedTicket || !selectedTecnico) {
      alert('Selecciona un ticket y un técnico')
      return
    }

    try {
      // Importar función de reasignación
      const { default: module } = await import('@/lib/asignacion-tecnicos')
      
      // Asignar ticket
      const { error: assignError } = await supabase
        .from('tickets')
        .update({
          asignado_a: selectedTecnico,
          estado: 'asignado',
          fecha_asignacion: new Date().toISOString()
        })
        .eq('id', selectedTicket)

      if (assignError) throw assignError

      // Incrementar contador del técnico
      await supabase.rpc('incrementar_tickets_activos', {
        usuario_id: selectedTecnico
      })

      // Enviar notificación
      const { notificarAsignacion } = await import('@/lib/notificaciones')
      
      const ticket = ticketsPendientes.find(t => t.id === selectedTicket)
      await notificarAsignacion(selectedTicket, selectedTecnico, ticket?.prioridad === 1)

      alert('✅ Ticket asignado exitosamente')
      setSelectedTicket(null)
      setSelectedTecnico(null)
      loadData()
    } catch (error: any) {
      console.error('Error asignando ticket:', error)
      alert(`Error: ${error.message}`)
    }
  }

  async function asignarAutomaticamente(ticketId: string) {
    try {
      const { asignarTecnicoAutomatico } = await import('@/lib/asignacion-tecnicos')
      
      const ticket = ticketsPendientes.find(t => t.id === ticketId)
      const esEmergencia = ticket?.prioridad === 1

      const tecnicoAsignado = await asignarTecnicoAutomatico(ticketId, esEmergencia)

      if (tecnicoAsignado) {
        alert(`✅ Asignado a ${tecnicoAsignado.nombre}`)
        loadData()
      } else {
        alert('⚠️ No hay técnicos disponibles')
      }
    } catch (error: any) {
      console.error('Error en asignación automática:', error)
      alert(`Error: ${error.message}`)
    }
  }

  async function toggleDisponibilidad(tecnicoId: string, disponibleActual: boolean) {
    try {
      await supabase
        .from('usuarios_autorizados')
        .update({ disponible: !disponibleActual })
        .eq('id', tecnicoId)

      loadData()
    } catch (error) {
      console.error('Error cambiando disponibilidad:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Asignación de Tickets</h1>
        <p className="text-gray-600 mt-2">
          Gestiona la carga de trabajo de los técnicos
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          title="Técnicos Disponibles"
          value={tecnicos.filter(t => t.disponible).length}
          total={tecnicos.length}
          color="bg-green-500"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          title="Tickets Pendientes"
          value={ticketsPendientes.length}
          color="bg-orange-500"
        />
        <StatCard
          icon={<Zap className="w-6 h-6" />}
          title="Emergencias"
          value={ticketsPendientes.filter(t => t.prioridad === 1).length}
          color="bg-red-500"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          title="Carga Promedio"
          value={Math.round(tecnicos.reduce((sum, t) => sum + t.tickets_activos, 0) / (tecnicos.length || 1))}
          suffix=" tickets/técnico"
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Técnicos */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Técnicos
            </h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {tecnicos.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No hay técnicos registrados
              </div>
            ) : (
              tecnicos.map((tecnico) => (
                <div
                  key={tecnico.id}
                  className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedTecnico === tecnico.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedTecnico(tecnico.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{tecnico.nombre}</span>
                        {tecnico.rol === 'supervisor' && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                            Supervisor
                          </span>
                        )}
                      </div>
                      
                      {tecnico.especialidad && (
                        <p className="text-sm text-gray-600 mb-2">
                          {tecnico.especialidad}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {tecnico.tickets_activos} activos
                        </span>
                        {tecnico.turno_actual && (
                          <span>Turno {tecnico.turno_actual}</span>
                        )}
                        {tecnico.acepta_emergencias && (
                          <span className="flex items-center gap-1 text-red-600">
                            <Zap className="w-3 h-3" />
                            Emergencias
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleDisponibilidad(tecnico.id, tecnico.disponible)
                      }}
                      className={`ml-4 px-3 py-1 rounded-full text-xs font-medium ${
                        tecnico.disponible
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tecnico.disponible ? '✓ Disponible' : '✗ No disponible'}
                    </button>
                  </div>

                  {/* Barra de carga */}
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                      <span>Carga de trabajo</span>
                      <span className="ml-auto">
                        {tecnico.tickets_activos}/10
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          tecnico.tickets_activos >= 8
                            ? 'bg-red-500'
                            : tecnico.tickets_activos >= 5
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((tecnico.tickets_activos / 10) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tickets Pendientes */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Tickets Pendientes de Asignación
            </h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {ticketsPendientes.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                ✅ No hay tickets pendientes
              </div>
            ) : (
              ticketsPendientes.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedTicket === ticket.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedTicket(ticket.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-semibold text-blue-600">
                          {ticket.numero_ticket}
                        </span>
                        <PriorityBadge priority={ticket.prioridad} />
                        {ticket.tipo === 'emergencia' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">
                            🚨 EMERGENCIA
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-900 mb-1">
                        {ticket.equipo_codigo}
                      </p>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {ticket.breve_descripcion}
                      </p>

                      {ticket.tipo_incidente && (
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {ticket.tipo_incidente.nombre}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      asignarAutomaticamente(ticket.id)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    ⚡ Asignar automáticamente
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Panel de Asignación Manual */}
      {(selectedTicket || selectedTecnico) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Asignación Manual</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ticket Seleccionado
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg">
                {selectedTicket ? (
                  <span className="font-mono text-sm">
                    {ticketsPendientes.find(t => t.id === selectedTicket)?.numero_ticket}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">Ninguno</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Técnico Seleccionado
              </label>
              <div className="px-4 py-3 bg-gray-50 rounded-lg">
                {selectedTecnico ? (
                  <span className="text-sm">
                    {tecnicos.find(t => t.id === selectedTecnico)?.nombre}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">Ninguno</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={asignarManualmente}
              disabled={!selectedTicket || !selectedTecnico}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Asignar Ticket
            </button>
            <button
              onClick={() => {
                setSelectedTicket(null)
                setSelectedTecnico(null)
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Limpiar Selección
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Componentes auxiliares
function StatCard({ icon, title, value, total, suffix, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`${color} text-white p-3 rounded-lg w-fit mb-4`}>
        {icon}
      </div>
      <h3 className="text-gray-600 text-sm mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {total && <p className="text-gray-500 text-sm">/ {total}</p>}
        {suffix && <p className="text-gray-500 text-sm">{suffix}</p>}
      </div>
    </div>
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
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[priority as keyof typeof styles] || styles[3]}`}>
      {labels[priority as keyof typeof labels] || 'Media'}
    </span>
  )
}
