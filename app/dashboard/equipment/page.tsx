'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Search, Plus, Wrench, ChevronRight, ChevronDown, AlertCircle, Settings } from 'lucide-react'

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

type EquipoConTickets = Equipo & {
  total_tickets: number
  tickets_abiertos: number
  tickets_criticos: number
}

export default function EquiposPage() {
  const [equipos, setEquipos] = useState<EquipoConTickets[]>([])
  const [filteredEquipos, setFilteredEquipos] = useState<EquipoConTickets[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterEstado, setFilterEstado] = useState('todos')
  const [viewMode, setViewMode] = useState<'list' | 'hierarchy'>('list')
  
  // Jerarquía expandida
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadEquipos()
    
    // Suscripción en tiempo real
    const subscription = supabase
      .channel('equipos-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'equipos' },
        () => loadEquipos()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    applyFilters()
  }, [equipos, searchTerm, filterTipo, filterEstado])

  async function loadEquipos() {
    try {
      // Cargar equipos con conteo de tickets
      const { data: equiposData, error: equiposError } = await supabase
        .from('equipos')
        .select('*')
        .order('tipo_equipo', { ascending: true })
        .order('codigo', { ascending: true })

      if (equiposError) throw equiposError

      // Cargar conteo de tickets por equipo
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('equipo_codigo, estado, prioridad')

      if (ticketsError) throw ticketsError

      // Combinar datos
      const equiposConTickets: EquipoConTickets[] = (equiposData || []).map(equipo => {
        const ticketsEquipo = (ticketsData || []).filter(t => t.equipo_codigo === equipo.codigo)
        return {
          ...equipo,
          total_tickets: ticketsEquipo.length,
          tickets_abiertos: ticketsEquipo.filter(t => 
            t.estado !== 'cerrado' && t.estado !== 'resuelto'
          ).length,
          tickets_criticos: ticketsEquipo.filter(t => t.prioridad === 1).length
        }
      })

      setEquipos(equiposConTickets)
    } catch (error) {
      console.error('Error cargando equipos:', error)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...equipos]

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(equipo =>
        equipo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        equipo.tipo_equipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (equipo.area && equipo.area.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filtro por tipo
    if (filterTipo !== 'todos') {
      filtered = filtered.filter(equipo => equipo.tipo_equipo === filterTipo)
    }

    // Filtro por estado
    if (filterEstado !== 'todos') {
      filtered = filtered.filter(equipo => equipo.estado === filterEstado)
    }

    setFilteredEquipos(filtered)
  }

  function toggleType(tipo: string) {
    const newExpanded = new Set(expandedTypes)
    if (newExpanded.has(tipo)) {
      newExpanded.delete(tipo)
    } else {
      newExpanded.add(tipo)
    }
    setExpandedTypes(newExpanded)
  }

  // Obtener tipos únicos
  const tiposUnicos = Array.from(new Set(filteredEquipos.map(e => e.tipo_equipo))).sort()

  // Agrupar por tipo
  const equiposPorTipo = tiposUnicos.reduce((acc, tipo) => {
    acc[tipo] = filteredEquipos.filter(e => e.tipo_equipo === tipo)
    return acc
  }, {} as Record<string, EquipoConTickets[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando equipos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipos</h1>
          <p className="text-gray-600 mt-2">
            {filteredEquipos.length} equipo{filteredEquipos.length !== 1 ? 's' : ''} registrado{filteredEquipos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/equipos/mapa"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            Ver Mapa PDF
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Nuevo Equipo
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
                placeholder="Código, tipo o área..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Equipo
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              <option value="CAEX">CAEX (Camiones)</option>
              <option value="CM">CM (Carros Mineros)</option>
              <option value="PERFORADORA">Perforadoras</option>
              <option value="PALA">Palas</option>
              <option value="FASE">FASE</option>
              <option value="CARRO_MOVIL">Carro Móvil</option>
            </select>
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
              <option value="operativo">Operativo</option>
              <option value="mantenimiento">En Mantenimiento</option>
              <option value="fuera_servicio">Fuera de Servicio</option>
            </select>
          </div>
        </div>

        {/* Selector de vista */}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-gray-700 font-medium">Vista:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'hierarchy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Jerarquía
            </button>
          </div>
        </div>

        {/* Botón limpiar filtros */}
        {(searchTerm || filterTipo !== 'todos' || filterEstado !== 'todos') && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterTipo('todos')
                setFilterEstado('todos')
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista o Jerarquía de Equipos */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
          {filteredEquipos.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No se encontraron equipos
            </div>
          ) : (
            filteredEquipos.map((equipo) => (
              <Link
                key={equipo.id}
                href={`/dashboard/equipos/${equipo.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Wrench className="w-10 h-10 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{equipo.codigo}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                        <span className="font-medium">{getTipoEquipoLabel(equipo.tipo_equipo)}</span>
                        {equipo.area && (
                          <>
                            <span>•</span>
                            <span>{equipo.area}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Indicadores de tickets */}
                    {equipo.tickets_criticos > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {equipo.tickets_criticos} Crítico{equipo.tickets_criticos !== 1 ? 's' : ''}
                      </span>
                    )}
                    {equipo.tickets_abiertos > 0 && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        {equipo.tickets_abiertos} Abierto{equipo.tickets_abiertos !== 1 ? 's' : ''}
                      </span>
                    )}
                    {equipo.total_tickets > 0 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {equipo.total_tickets} Total
                      </span>
                    )}
                    
                    {/* Estado */}
                    <EstadoBadge estado={equipo.estado} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          {tiposUnicos.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No se encontraron equipos
            </div>
          ) : (
            tiposUnicos.map((tipo) => (
              <div key={tipo} className="border-b border-gray-200 last:border-0">
                {/* Header de categoría */}
                <button
                  onClick={() => toggleType(tipo)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedTypes.has(tipo) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {getTipoEquipoLabel(tipo)}
                    </h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {equiposPorTipo[tipo].length}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {equiposPorTipo[tipo].reduce((sum, e) => sum + e.tickets_abiertos, 0)} tickets abiertos
                  </div>
                </button>

                {/* Lista de equipos expandida */}
                {expandedTypes.has(tipo) && (
                  <div className="bg-gray-50">
                    {equiposPorTipo[tipo].map((equipo) => (
                      <Link
                        key={equipo.id}
                        href={`/dashboard/equipos/${equipo.id}`}
                        className="block px-6 py-3 pl-16 hover:bg-gray-100 border-t border-gray-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{equipo.codigo}</h4>
                            {equipo.area && (
                              <p className="text-sm text-gray-600 mt-1">{equipo.area}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {equipo.tickets_criticos > 0 && (
                              <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                <AlertCircle className="w-3 h-3" />
                                {equipo.tickets_criticos}
                              </span>
                            )}
                            {equipo.tickets_abiertos > 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                {equipo.tickets_abiertos}
                              </span>
                            )}
                            <EstadoBadge estado={equipo.estado} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Resumen por tipo */}
      {filteredEquipos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tiposUnicos.map((tipo) => (
            <div key={tipo} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-600 mb-1">{getTipoEquipoLabel(tipo)}</p>
              <p className="text-2xl font-bold text-blue-800">{equiposPorTipo[tipo].length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {equiposPorTipo[tipo].reduce((sum, e) => sum + e.tickets_abiertos, 0)} tickets
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Componentes auxiliares
function EstadoBadge({ estado }: { estado: string }) {
  const styles = {
    operativo: 'bg-green-100 text-green-800',
    mantenimiento: 'bg-yellow-100 text-yellow-800',
    fuera_servicio: 'bg-red-100 text-red-800',
  }

  const labels = {
    operativo: 'Operativo',
    mantenimiento: 'Mantenimiento',
    fuera_servicio: 'Fuera de Servicio',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[estado as keyof typeof styles] || styles.operativo}`}>
      {labels[estado as keyof typeof labels] || estado}
    </span>
  )
}

function getTipoEquipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    CAEX: 'CAEX (Camiones)',
    CM: 'CM (Carros Mineros)',
    PERFORADORA: 'Perforadoras',
    PALA: 'Palas',
    FASE: 'FASE',
    CARRO_MOVIL: 'Carro Móvil',
  }
  return labels[tipo] || tipo
}
