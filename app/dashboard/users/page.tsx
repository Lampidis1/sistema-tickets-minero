'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Edit2, Trash2, Phone, Shield, CheckCircle, XCircle, UserCheck } from 'lucide-react'

type Usuario = {
  id: string
  telefono: string
  nombre: string
  rol: string
  area?: string
  especialidad?: string
  activo: boolean
  created_at: string
  updated_at: string
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [filteredUsuarios, setFilteredUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRol, setFilterRol] = useState('todos')
  const [filterEstado, setFilterEstado] = useState('todos')

  // Form state
  const [formData, setFormData] = useState({
    telefono: '',
    nombre: '',
    rol: 'operador',
    area: '',
    especialidad: '',
    activo: true
  })

  useEffect(() => {
    loadUsuarios()
    
    // Suscripción en tiempo real
    const subscription = supabase
      .channel('usuarios-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'usuarios_autorizados' },
        () => loadUsuarios()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    applyFilters()
  }, [usuarios, searchTerm, filterRol, filterEstado])

  async function loadUsuarios() {
    try {
      const { data, error } = await supabase
        .from('usuarios_autorizados')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsuarios(data || [])
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  function applyFilters() {
    let filtered = [...usuarios]

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(usuario =>
        usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.telefono.includes(searchTerm) ||
        usuario.area?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.especialidad?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por rol
    if (filterRol !== 'todos') {
      filtered = filtered.filter(usuario => usuario.rol === filterRol)
    }

    // Filtro por estado
    if (filterEstado !== 'todos') {
      filtered = filtered.filter(usuario => 
        filterEstado === 'activo' ? usuario.activo : !usuario.activo
      )
    }

    setFilteredUsuarios(filtered)
  }

  function openModal(usuario?: Usuario) {
    if (usuario) {
      setEditingUsuario(usuario)
      setFormData({
        telefono: usuario.telefono,
        nombre: usuario.nombre,
        rol: usuario.rol,
        area: usuario.area || '',
        especialidad: usuario.especialidad || '',
        activo: usuario.activo
      })
    } else {
      setEditingUsuario(null)
      setFormData({
        telefono: '',
        nombre: '',
        rol: 'operador',
        area: '',
        especialidad: '',
        activo: true
      })
    }
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingUsuario(null)
    setFormData({
      telefono: '',
      nombre: '',
      rol: 'operador',
      area: '',
      especialidad: '',
      activo: true
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      if (editingUsuario) {
        // Actualizar usuario existente
        const { error } = await supabase
          .from('usuarios_autorizados')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUsuario.id)

        if (error) throw error
        alert('Usuario actualizado exitosamente')
      } else {
        // Crear nuevo usuario
        const { error } = await supabase
          .from('usuarios_autorizados')
          .insert([formData])

        if (error) throw error
        alert('Usuario creado exitosamente')
      }

      closeModal()
      loadUsuarios()
    } catch (error: any) {
      console.error('Error guardando usuario:', error)
      alert(`Error: ${error.message}`)
    }
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Estás seguro de eliminar a ${nombre}?`)) return

    try {
      const { error } = await supabase
        .from('usuarios_autorizados')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('Usuario eliminado exitosamente')
      loadUsuarios()
    } catch (error: any) {
      console.error('Error eliminando usuario:', error)
      alert(`Error: ${error.message}`)
    }
  }

  async function toggleActivo(usuario: Usuario) {
    try {
      const { error } = await supabase
        .from('usuarios_autorizados')
        .update({ 
          activo: !usuario.activo,
          updated_at: new Date().toISOString()
        })
        .eq('id', usuario.id)

      if (error) throw error
      loadUsuarios()
    } catch (error: any) {
      console.error('Error actualizando estado:', error)
      alert(`Error: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando usuarios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usuarios Autorizados</h1>
          <p className="text-gray-600 mt-2">
            {filteredUsuarios.length} usuario{filteredUsuarios.length !== 1 ? 's' : ''} WhatsApp
          </p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
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
                placeholder="Nombre, teléfono, área o especialidad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filtro Rol */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rol
            </label>
            <select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="tecnico">Técnico</option>
              <option value="operador">Operador</option>
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
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Botón limpiar filtros */}
        {(searchTerm || filterRol !== 'todos' || filterEstado !== 'todos') && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterRol('todos')
                setFilterEstado('todos')
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista de Usuarios */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Área / Especialidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {searchTerm || filterRol !== 'todos' || filterEstado !== 'todos'
                    ? 'No se encontraron usuarios con los filtros aplicados'
                    : 'No hay usuarios registrados'}
                </td>
              </tr>
            ) : (
              filteredUsuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserCheck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.nombre}
                        </div>
                        <div className="text-xs text-gray-500">
                          Desde {new Date(usuario.created_at).toLocaleDateString('es-CL')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Phone className="w-4 h-4 mr-2 text-gray-400" />
                      {usuario.telefono}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RolBadge rol={usuario.rol} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{usuario.area || '-'}</div>
                    {usuario.especialidad && (
                      <div className="text-xs text-gray-500">{usuario.especialidad}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleActivo(usuario)}
                      className="flex items-center gap-2"
                    >
                      {usuario.activo ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          Inactivo
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(usuario)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(usuario.id, usuario.nombre)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Estadísticas rápidas */}
      {filteredUsuarios.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatBox
            label="Total"
            value={filteredUsuarios.length}
            color="bg-blue-100 text-blue-800"
          />
          <StatBox
            label="Activos"
            value={filteredUsuarios.filter(u => u.activo).length}
            color="bg-green-100 text-green-800"
          />
          <StatBox
            label="Inactivos"
            value={filteredUsuarios.filter(u => !u.activo).length}
            color="bg-gray-100 text-gray-800"
          />
          <StatBox
            label="Técnicos"
            value={filteredUsuarios.filter(u => u.rol === 'tecnico').length}
            color="bg-purple-100 text-purple-800"
          />
          <StatBox
            label="Operadores"
            value={filteredUsuarios.filter(u => u.rol === 'operador').length}
            color="bg-yellow-100 text-yellow-800"
          />
        </div>
      )}

      {/* Modal de Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {editingUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+56912345678"
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Formato: +56XXXXXXXXX</p>
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Juan Pérez"
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Rol */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rol *
                  </label>
                  <select
                    required
                    value={formData.rol}
                    onChange={(e) => setFormData({...formData, rol: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="admin">Administrador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="tecnico">Técnico</option>
                    <option value="operador">Operador</option>
                  </select>
                </div>

                {/* Área */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Área
                  </label>
                  <input
                    type="text"
                    placeholder="Mantenimiento, Producción, etc."
                    value={formData.area}
                    onChange={(e) => setFormData({...formData, area: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Especialidad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Especialidad
                  </label>
                  <input
                    type="text"
                    placeholder="Eléctrico, Mecánico, Hidráulico, etc."
                    value={formData.especialidad}
                    onChange={(e) => setFormData({...formData, especialidad: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Estado */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">
                    Usuario activo (puede usar WhatsApp Bot)
                  </label>
                </div>

                {/* Botones */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingUsuario ? 'Actualizar' : 'Crear'} Usuario
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componentes auxiliares
function RolBadge({ rol }: { rol: string }) {
  const styles = {
    admin: 'bg-purple-100 text-purple-800',
    supervisor: 'bg-blue-100 text-blue-800',
    tecnico: 'bg-green-100 text-green-800',
    operador: 'bg-yellow-100 text-yellow-800',
  }

  const icons = {
    admin: <Shield className="w-3 h-3" />,
    supervisor: <UserCheck className="w-3 h-3" />,
    tecnico: <UserCheck className="w-3 h-3" />,
    operador: <UserCheck className="w-3 h-3" />,
  }

  const labels = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    tecnico: 'Técnico',
    operador: 'Operador',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[rol as keyof typeof styles] || styles.operador}`}>
      {icons[rol as keyof typeof icons]}
      {labels[rol as keyof typeof labels] || rol}
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
