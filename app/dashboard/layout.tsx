import Link from 'next/link'
import { LayoutDashboard, FileText, Wrench, Users, UserCheck } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              🏗️ Sistema Tickets Minero
            </h1>
            <div className="text-sm text-gray-500">
              Conectado ✅
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-2">
            <NavLink href="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />}>
              Dashboard
            </NavLink>
            <NavLink href="/dashboard/tickets" icon={<FileText className="w-5 h-5" />}>
              Tickets
            </NavLink>
            <NavLink href="/dashboard/equipment" icon={<Wrench className="w-5 h-5" />}>
              Equipos
            </NavLink>
            <NavLink href="/dashboard/usuarios" icon={<Users className="w-5 h-5" />}>
              Usuarios
            </NavLink>
            <NavLink href="/dashboard/asignaciones" icon={<UserCheck className="w-5 h-5" />}>
              Asignaciones
            </NavLink>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function NavLink({ href, icon, children }: any) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
    >
      {icon}
      <span className="font-medium">{children}</span>
    </Link>
  )
}
