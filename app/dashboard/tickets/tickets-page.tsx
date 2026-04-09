'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Search, Filter, Download, Plus } from 'lucide-react'

type Ticket = {
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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState('todos')
  const [filterPrioridad, setFilterPrioridad] = useState('todos')

  useEffect(() => {
    loadTickets()
    
    // Suscripción en tiempo real
    const subscription = supabase
      .channel('tickets-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tickets' },
        () => loadTickets()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    applyFilters()
  }, [tickets, searchTerm, filterEstado, filterPrioridad])

  async function loadTickets() {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (error) {
      console.error('Error cargando tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...tickets]

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(ticket =>
        ticket.numero_ticket.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.equipo_codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.breve_descripcion.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por estado
    if (filterEstado !== 'todos') {
      filtered = filtered.filter(ticket => ticket.estado === filterEstado)
    }

    // Filtro por prioridad
    if (filterPrioridad !== 'todos') {
      filtered = filtered.filter(ticket => ticket.prioridad === parseInt(filterPrioridad))
    }

    setFilteredTickets(filtered)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-600 mt-2">
            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} 
            {searchTerm || filterEstado !== 'todos' || filterPrioridad !== 'todos' ? ' (filtrados)' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Nuevo Ticket
          </button>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Número, equipo o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filtro Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              <option value="nuevo">Nuevo</option>
              <option value="asignado">Asignado</option>
              <option value="en_proceso">En Proceso</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>

          {/* Filtro Prioridad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prioridad
            </label>
            <select
              value={filterPrioridad}
              onChange={(e) => setFilterPrioridad(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todas</option>
              <option value="1">🔴 Crítica</option>
              <option value="2">🟠 Alta</option>
              <option value="3">🟡 Media</option>
              <option value="4">🟢 Baja</option>
            </select>
          </div>
        </div>

        {/* Botón limpiar filtros */}
        {(searchTerm || filterEstado !== 'todos' || filterPrioridad !== 'todos') && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterEstado('todos')
                setFilterPrioridad('todos')
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista de Tickets */}
      <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
        {filteredTickets.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            {searchTerm || filterEstado !== 'todos' || filterPrioridad !== 'todos' 
              ? 'No se encontraron tickets con los filtros aplicados'
              : 'No hay tickets registrados'}
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/tickets/${ticket.id}`}
              className="block px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header del ticket */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-semibold text-blue-600">
                      {ticket.numero_ticket}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="font-medium text-gray-900">
                      {ticket.equipo_codigo}
                    </span>
                    <PriorityBadge priority={ticket.prioridad} />
                    <span className="text-xs text-gray-500 capitalize">
                      {ticket.tipo}
                    </span>
                  </div>

                  {/* Descripción */}
                  <p className="text-gray-700 mb-2">
                    {ticket.breve_descripcion}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {ticket.area && (
                      <>
                        <span>📍 {ticket.area}</span>
                        <span>•</span>
                      </>
                    )}
                    {ticket.turno && (
                      <>
                        <span>⏰ Turno {ticket.turno}</span>
                        <span>•</span>
                      </>
                    )}
                    {ticket.jornada && (
                      <>
                        <span>{ticket.jornada}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>
                      {new Date(ticket.fecha_apertura).toLocaleString('es-CL', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                </div>

                {/* Estado */}
                <div className="ml-4">
                  <StatusBadge status={ticket.estado} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Estadísticas rápidas */}
      {filteredTickets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatBox
            label="Total"
            value={filteredTickets.length}
            color="bg-blue-100 text-blue-800"
          />
          <StatBox
            label="Nuevos"
            value={filteredTickets.filter(t => t.estado === 'nuevo').length}
            color="bg-red-100 text-red-800"
          />
          <StatBox
            label="En Proceso"
            value={filteredTickets.filter(t => t.estado === 'en_proceso').length}
            color="bg-yellow-100 text-yellow-800"
          />
          <StatBox
            label="Resueltos"
            value={filteredTickets.filter(t => t.estado === 'resuelto').length}
            color="bg-green-100 text-green-800"
          />
          <StatBox
            label="Cerrados"
            value={filteredTickets.filter(t => t.estado === 'cerrado').length}
            color="bg-gray-100 text-gray-800"
          />
        </div>
      )}
    </div>
  )
}

// Componentes auxiliares
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

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color.split(' ')[1]}`}>{value}</p>
    </div>
  )
}
