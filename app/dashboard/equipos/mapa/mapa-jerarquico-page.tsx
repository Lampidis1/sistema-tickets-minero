'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  ArrowLeft, Plus, Trash2, Edit2, ChevronRight, ChevronDown,
  FolderPlus, Wrench, Save, AlertCircle 
} from 'lucide-react'

type HierarchyNode = {
  id: string
  name: string
  type: 'category' | 'subcategory' | 'device'
  parent_id: string | null
  equipment_id?: string
  order_index: number
  created_at?: string
}

type EquipoBasico = {
  id: string
  codigo: string
  tipo_equipo: string
}

export default function MapaJerarquicoPage() {
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([])
  const [equipos, setEquipos] = useState<EquipoBasico[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalType, setModalType] = useState<'category' | 'subcategory' | 'device'>('category')
  const [modalParentId, setModalParentId] = useState<string | null>(null)
  const [newNodeName, setNewNodeName] = useState('')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Cargar jerarquía (guardarla en una tabla custom o localStorage por ahora)
      const savedHierarchy = localStorage.getItem('equipment_hierarchy')
      if (savedHierarchy) {
        setHierarchy(JSON.parse(savedHierarchy))
      } else {
        // Crear jerarquía inicial de ejemplo
        setHierarchy(getInitialHierarchy())
      }

      // Cargar equipos
      const { data: equiposData } = await supabase
        .from('equipos')
        .select('id, codigo, tipo_equipo')
        .order('codigo')

      setEquipos(equiposData || [])
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  function getInitialHierarchy(): HierarchyNode[] {
    return [
      // CAEX
      { id: '1', name: 'CAEX (Camiones)', type: 'category', parent_id: null, order_index: 0 },
      { id: '1-1', name: 'Sistema Hidráulico', type: 'subcategory', parent_id: '1', order_index: 0 },
      { id: '1-2', name: 'Sistema Eléctrico', type: 'subcategory', parent_id: '1', order_index: 1 },
      
      // CM
      { id: '2', name: 'CM (Carros Mineros)', type: 'category', parent_id: null, order_index: 1 },
      { id: '2-1', name: 'Sistema Mecánico', type: 'subcategory', parent_id: '2', order_index: 0 },
      { id: '2-2', name: 'Sistema Tetra', type: 'subcategory', parent_id: '2', order_index: 1 },
      
      // Perforadoras
      { id: '3', name: 'Perforadoras', type: 'category', parent_id: null, order_index: 2 },
      { id: '3-1', name: 'Desarrollo', type: 'subcategory', parent_id: '3', order_index: 0 },
      
      // Palas
      { id: '4', name: 'Palas Excavadoras', type: 'category', parent_id: null, order_index: 3 },
      { id: '4-1', name: 'Extracción', type: 'subcategory', parent_id: '4', order_index: 0 },
    ]
  }

  function saveHierarchy() {
    localStorage.setItem('equipment_hierarchy', JSON.stringify(hierarchy))
    alert('Jerarquía guardada exitosamente')
    setEditMode(false)
  }

  function toggleNode(nodeId: string) {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  function getChildNodes(parentId: string | null): HierarchyNode[] {
    return hierarchy
      .filter(node => node.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
  }

  function openAddModal(type: 'category' | 'subcategory' | 'device', parentId: string | null = null) {
    setModalType(type)
    setModalParentId(parentId)
    setNewNodeName('')
    setSelectedEquipmentId('')
    setShowAddModal(true)
  }

  function addNode() {
    if (!newNodeName.trim() && modalType !== 'device') return
    if (modalType === 'device' && !selectedEquipmentId) return

    const newNode: HierarchyNode = {
      id: Date.now().toString(),
      name: modalType === 'device' 
        ? equipos.find(e => e.id === selectedEquipmentId)?.codigo || ''
        : newNodeName.trim(),
      type: modalType,
      parent_id: modalParentId,
      equipment_id: modalType === 'device' ? selectedEquipmentId : undefined,
      order_index: getChildNodes(modalParentId).length,
    }

    setHierarchy([...hierarchy, newNode])
    setShowAddModal(false)
    
    // Auto-expandir el padre
    if (modalParentId) {
      setExpandedNodes(new Set([...expandedNodes, modalParentId]))
    }
  }

  function deleteNode(nodeId: string) {
    if (!confirm('¿Eliminar este elemento y todos sus hijos?')) return
    
    // Eliminar el nodo y todos sus descendientes
    const toDelete = new Set([nodeId])
    let changed = true
    
    while (changed) {
      changed = false
      hierarchy.forEach(node => {
        if (node.parent_id && toDelete.has(node.parent_id) && !toDelete.has(node.id)) {
          toDelete.add(node.id)
          changed = true
        }
      })
    }
    
    setHierarchy(hierarchy.filter(node => !toDelete.has(node.id)))
  }

  function renderNode(node: HierarchyNode, level: number = 0) {
    const children = getChildNodes(node.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = selectedNode === node.id

    const equipo = node.equipment_id 
      ? equipos.find(e => e.id === node.equipment_id)
      : null

    return (
      <div key={node.id} className="relative">
        {/* Nodo actual */}
        <div
          className={`
            flex items-center justify-between p-3 rounded-lg transition-colors
            ${isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'hover:bg-gray-50'}
            ${level > 0 ? 'ml-8' : ''}
          `}
          style={{ marginLeft: level > 0 ? `${level * 2}rem` : '0' }}
        >
          <div className="flex items-center gap-3 flex-1">
            {/* Botón expandir/colapsar */}
            {hasChildren && (
              <button
                onClick={() => toggleNode(node.id)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </button>
            )}
            
            {!hasChildren && <div className="w-6"></div>}

            {/* Icono según tipo */}
            {node.type === 'category' && (
              <span className="text-2xl">📁</span>
            )}
            {node.type === 'subcategory' && (
              <span className="text-xl">📂</span>
            )}
            {node.type === 'device' && (
              <Wrench className="w-5 h-5 text-blue-600" />
            )}

            {/* Nombre */}
            {node.type === 'device' && equipo ? (
              <Link
                href={`/dashboard/equipos/${equipo.id}`}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {node.name}
              </Link>
            ) : (
              <span className={`font-medium ${
                node.type === 'category' ? 'text-lg text-gray-900' :
                node.type === 'subcategory' ? 'text-gray-800' :
                'text-gray-700'
              }`}>
                {node.name}
              </span>
            )}

            {/* Badge de tipo */}
            {node.type === 'device' && equipo && (
              <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                {equipo.tipo_equipo}
              </span>
            )}
          </div>

          {/* Acciones en modo edición */}
          {editMode && (
            <div className="flex items-center gap-2">
              {node.type !== 'device' && (
                <>
                  <button
                    onClick={() => openAddModal('subcategory', node.id)}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="Agregar subcategoría"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openAddModal('device', node.id)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Agregar dispositivo"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => deleteNode(node.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Hijos (si está expandido) */}
        {isExpanded && hasChildren && (
          <div className="mt-1">
            {children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  const rootNodes = getChildNodes(null)

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
            <h1 className="text-3xl font-bold text-gray-900">Mapa Jerárquico de Equipos</h1>
            <p className="text-gray-600 mt-1">
              Organización visual de equipos por categorías y sistemas
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveHierarchy}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save className="w-4 h-4" />
                Guardar Cambios
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit2 className="w-4 h-4" />
              Editar Jerarquía
            </button>
          )}
        </div>
      </div>

      {/* Instrucciones */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Modo de Edición</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Usa 📂 para agregar subcategorías dentro de una categoría</li>
                <li>Usa ➕ para agregar dispositivos a una subcategoría</li>
                <li>Usa 🗑️ para eliminar elementos (eliminará también sus hijos)</li>
                <li>Haz click en "Guardar Cambios" cuando termines</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Botón agregar categoría principal */}
      {editMode && (
        <button
          onClick={() => openAddModal('category')}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-600 hover:text-blue-600 font-medium"
        >
          + Agregar Categoría Principal
        </button>
      )}

      {/* Árbol de jerarquía */}
      <div className="bg-white rounded-lg shadow p-6">
        {rootNodes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FolderPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p>No hay categorías. Agrega una categoría principal para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rootNodes.map(node => renderNode(node, 0))}
          </div>
        )}
      </div>

      {/* Modal para agregar nodos */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {modalType === 'category' && 'Agregar Categoría Principal'}
              {modalType === 'subcategory' && 'Agregar Subcategoría'}
              {modalType === 'device' && 'Agregar Dispositivo'}
            </h3>

            {modalType !== 'device' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="Ej: Sistema Hidráulico"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Equipo
                </label>
                <select
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Seleccionar equipo --</option>
                  {equipos.map(equipo => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipo.codigo} ({equipo.tipo_equipo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={addNode}
                disabled={
                  (modalType !== 'device' && !newNodeName.trim()) ||
                  (modalType === 'device' && !selectedEquipmentId)
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Leyenda</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📁</span>
            <span className="text-gray-700">Categoría Principal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📂</span>
            <span className="text-gray-700">Subcategoría / Sistema</span>
          </div>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            <span className="text-gray-700">Dispositivo / Equipo</span>
          </div>
        </div>
      </div>
    </div>
  )
}
