'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Wrench, AlertCircle, CheckCircle, Clock } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalTickets: 0,
    ticketsAbiertos: 0,
    ticketsEnProceso: 0,
    ticketsCerrados: 0,
    equiposTotales: 0,
  })
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      const { data: tickets } = await supabase
        .from('tickets')
        .select('*')

      const { data: equipos } = await supabase
        .from('equipos')
        .select('*')

      const ticketsAbiertos = tickets?.filter(t => t.estado === 'nuevo').length || 0
      const ticketsEnProceso = tickets?.filter(t => t.estado === 'en_proceso').length || 0
      const ticketsCerrados = tickets?.filter(t => t.estado === 'cerrado' || t.estado === 'resuelto').length || 0

      setStats({
        totalTickets: tickets?.length || 0,
        ticketsAbiertos,
        ticketsEnProceso,
        ticketsCerrados,
        equiposTotales: equipos?.length || 0,
      })

    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Vista general del sistema de tickets</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<FileText className="w-8 h-8" />}
          title="Total Tickets"
          value={stats.totalTickets}
          color="bg-blue-500"
        />
        <StatCard
          icon={<AlertCircle className="w-8 h-8" />}
          title="Tickets Abiertos"
          value={stats.ticketsAbiertos}
          color="bg-red-500"
        />
        <StatCard
          icon={<Clock className="w-8 h-8" />}
          title="En Proceso"
          value={stats.ticketsEnProceso}
          color="bg-yellow-500"
        />
        <StatCard
          icon={<CheckCircle className="w-8 h-8" />}
          title="Cerrados"
          value={stats.ticketsCerrados}
          color="bg-green-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wrench className="w-6 h-6 text-gray-600" />
          <h3 className="text-lg font-semibold">Equipos Registrados</h3>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.equiposTotales}</p>
        <p className="text-sm text-gray-500 mt-2">Equipos en sistema</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Conexión Supabase</h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Conectado</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`${color} text-white p-3 rounded-lg w-fit mb-4`}>
        {icon}
      </div>
      <h3 className="text-gray-600 text-sm">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  )
}
