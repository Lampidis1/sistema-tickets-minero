import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          Sistema de Tickets Minero
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Gestión inteligente de incidentes y mantenimiento de equipos
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
        >
          Ir al Dashboard
          <ArrowRight className="w-5 h-5" />
        </Link>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-bold text-lg mb-2">Dashboard en Tiempo Real</h3>
            <p className="text-gray-600">Monitoreo continuo de equipos y tickets</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">🚜</div>
            <h3 className="font-bold text-lg mb-2">Inventario de Equipos</h3>
            <p className="text-gray-600">Gestión jerárquica de toda la flota</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="text-4xl mb-4">📱</div>
            <h3 className="font-bold text-lg mb-2">Integración WhatsApp</h3>
            <p className="text-gray-600">Creación de tickets desde móvil</p>
          </div>
        </div>
      </div>
    </main>
  )
}
