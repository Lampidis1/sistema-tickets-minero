'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  asignarTecnicoAutomatico, 
  reasignarTicket, 
  obtenerCargaTecnicos,
  type Tecnico 
} from '@/lib/asignacion-tecnicos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Ticket {
  id: string;
  numero_ticket: string;
  equipo_codigo: string;
  tipo_incidente: { nombre: string } | null;
  prioridad: number;
  estado: string;
  asignado_a: string | null;
  fecha_apertura: string;
}

export default function AsignacionesPage() {
  const supabase = createClientComponentClient();
  
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [ticketsPendientes, setTicketsPendientes] = useState<Ticket[]>([]);
  const [ticketSeleccionado, setTicketSeleccionado] = useState<string | null>(null);
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatos();
    
    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('asignaciones-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tickets' },
        () => cargarDatos()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'usuarios_autorizados' },
        () => cargarTecnicos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function cargarDatos() {
    await Promise.all([
      cargarTecnicos(),
      cargarTicketsPendientes()
    ]);
    setLoading(false);
  }

  async function cargarTecnicos() {
    const data = await obtenerCargaTecnicos();
    setTecnicos(data);
  }

  async function cargarTicketsPendientes() {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        numero_ticket,
        equipo_codigo,
        prioridad,
        estado,
        asignado_a,
        fecha_apertura,
        tipo_incidente:tipos_incidente(nombre)
      `)
      .in('estado', ['nuevo', 'asignado'])
      .order('prioridad', { ascending: true })
      .order('fecha_apertura', { ascending: true });

    if (!error && data) {
      setTicketsPendientes(data as Ticket[]);
    }
  }

  async function handleAsignacionAutomatica(ticketId: string) {
    setLoading(true);
    
    const ticket = ticketsPendientes.find(t => t.id === ticketId);
    const tipo_incidente = ticket?.tipo_incidente?.nombre || '';
    const es_emergencia = ticket?.prioridad === 1;

    const resultado = await asignarTecnicoAutomatico(
      ticketId,
      tipo_incidente,
      es_emergencia
    );

    if (resultado.success) {
      alert(`✅ Ticket asignado a ${resultado.tecnico?.nombre}`);
      await cargarDatos();
    } else {
      alert(`❌ Error: ${resultado.error}`);
    }
    
    setLoading(false);
  }

  async function handleAsignacionManual() {
    if (!ticketSeleccionado || !tecnicoSeleccionado) {
      alert('Selecciona un ticket y un técnico');
      return;
    }

    setLoading(true);

    const resultado = await reasignarTicket(
      ticketSeleccionado,
      tecnicoSeleccionado,
      'supervisor-id', // TODO: Obtener ID del supervisor actual
      'Asignación manual desde dashboard'
    );

    if (resultado.success) {
      alert('✅ Ticket asignado correctamente');
      setTicketSeleccionado(null);
      setTecnicoSeleccionado(null);
      await cargarDatos();
    } else {
      alert(`❌ Error: ${resultado.error}`);
    }

    setLoading(false);
  }

  function obtenerColorCarga(tickets_activos: number): string {
    if (tickets_activos === 0) return 'bg-green-500';
    if (tickets_activos <= 2) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function obtenerPorcentajeCarga(tickets_activos: number, max = 5): number {
    return Math.min((tickets_activos / max) * 100, 100);
  }

  const ticketsSinAsignar = ticketsPendientes.filter(t => !t.asignado_a);
  const ticketsAsignados = ticketsPendientes.filter(t => t.asignado_a);
  const emergencias = ticketsPendientes.filter(t => t.prioridad === 1);
  const tecnicosDisponibles = tecnicos.filter(t => t.disponible);
  const cargaPromedio = tecnicos.length > 0
    ? tecnicos.reduce((sum, t) => sum + t.tickets_activos, 0) / tecnicos.length
    : 0;

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard de Asignaciones</h1>
        <p className="text-gray-600">Gestión en tiempo real de técnicos y tickets</p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Técnicos Disponibles</div>
          <div className="text-3xl font-bold text-green-600">{tecnicosDisponibles.length}</div>
          <div className="text-xs text-gray-500">de {tecnicos.length} totales</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600">Tickets Pendientes</div>
          <div className="text-3xl font-bold text-orange-600">{ticketsSinAsignar.length}</div>
          <div className="text-xs text-gray-500">sin asignar</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600">Emergencias</div>
          <div className="text-3xl font-bold text-red-600">{emergencias.length}</div>
          <div className="text-xs text-gray-500">prioridad crítica</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600">En Proceso</div>
          <div className="text-3xl font-bold text-blue-600">{ticketsAsignados.length}</div>
          <div className="text-xs text-gray-500">asignados</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600">Carga Promedio</div>
          <div className="text-3xl font-bold text-purple-600">{cargaPromedio.toFixed(1)}</div>
          <div className="text-xs text-gray-500">tickets/técnico</div>
        </Card>
      </div>

      {/* Layout principal: Técnicos y Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Técnicos */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">👷 Técnicos</h2>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {tecnicos.map((tecnico) => (
              <div
                key={tecnico.id}
                onClick={() => setTecnicoSeleccionado(tecnico.id)}
                className={`
                  p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${tecnicoSeleccionado === tecnico.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold">{tecnico.nombre}</div>
                    <div className="text-sm text-gray-600">
                      {tecnico.especialidad || 'Sin especialidad'}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {!tecnico.disponible && (
                      <Badge variant="secondary">No disponible</Badge>
                    )}
                    {tecnico.acepta_emergencias && (
                      <Badge variant="destructive">⚡ Emergencias</Badge>
                    )}
                    {tecnico.rol === 'supervisor' && (
                      <Badge>Supervisor</Badge>
                    )}
                  </div>
                </div>

                {/* Barra de carga */}
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Carga: {tecnico.tickets_activos} tickets</span>
                    <span>{obtenerPorcentajeCarga(tecnico.tickets_activos)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${obtenerColorCarga(tecnico.tickets_activos)}`}
                      style={{ width: `${obtenerPorcentajeCarga(tecnico.tickets_activos)}%` }}
                    />
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>Prioridad: {tecnico.prioridad_asignacion}</span>
                  {tecnico.turno_actual && (
                    <span>Turno: {tecnico.turno_actual}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Panel de Tickets Pendientes */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">📋 Tickets Pendientes</h2>
          
          {ticketsSinAsignar.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              ✅ No hay tickets pendientes de asignación
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {ticketsSinAsignar.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setTicketSeleccionado(ticket.id)}
                  className={`
                    p-4 border-2 rounded-lg cursor-pointer transition-all
                    ${ticketSeleccionado === ticket.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{ticket.numero_ticket}</div>
                    <div className="flex gap-2">
                      {ticket.prioridad === 1 && (
                        <Badge variant="destructive">🔴 EMERGENCIA</Badge>
                      )}
                      {ticket.prioridad === 2 && (
                        <Badge variant="destructive">🟡 ALTA</Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    🔧 {ticket.equipo_codigo}
                  </div>
                  <div className="text-sm text-gray-600">
                    ⚠️ {ticket.tipo_incidente?.nombre || 'Sin tipo'}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAsignacionAutomatica(ticket.id);
                      }}
                      disabled={loading}
                    >
                      ⚡ Asignar Auto
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Botón de asignación manual */}
      {ticketSeleccionado && tecnicoSeleccionado && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Asignación Manual Seleccionada</div>
              <div className="text-sm text-gray-600">
                Ticket: {ticketsPendientes.find(t => t.id === ticketSeleccionado)?.numero_ticket} →
                Técnico: {tecnicos.find(t => t.id === tecnicoSeleccionado)?.nombre}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTicketSeleccionado(null);
                  setTecnicoSeleccionado(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAsignacionManual}
                disabled={loading}
              >
                ✅ Confirmar Asignación
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
