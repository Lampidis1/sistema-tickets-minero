# Sistema de Tickets Minero

Aplicación web para gestión de tickets de mantenimiento de equipos mineros.

## Características

- Dashboard en tiempo real
- Gestión de tickets
- Inventario de equipos
- Integración con WhatsApp
- Almacenamiento de fotos (5 años)

## Tecnologías

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## Variables de Entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xvngixjaqeteiuyusnmp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-aqui
```

## Instalación Local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)



# 🏗️ Sistema de Tickets Minero

Sistema integral de gestión de incidentes para operaciones mineras con integración WhatsApp, monitoreo automático de equipos y reporting avanzado.

## 🚀 Stack Tecnológico

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Storage)
- **Automatización**: N8N Workflows
- **Mensajería**: WhatsApp Business API
- **Deploy**: Vercel

## 📋 Funcionalidades Implementadas

### ✅ Dashboard Principal
- Vista general con estadísticas en tiempo real
- Contadores de tickets por estado
- Total de equipos registrados
- Indicador de conexión a Supabase

### ✅ Gestión de Tickets
- Lista completa de tickets con realtime updates
- Filtros avanzados por estado, prioridad y búsqueda
- Vista detallada de cada ticket
- Badges visuales de estado y prioridad
- Metadata completa: turno, jornada, área, equipo

### ✅ Gestión de Equipos
- Catálogo de equipos mineros (CAEX, Perforadoras, etc.)
- Vista de mapa de equipos
- Seguimiento de estado operativo
- Asignación a usuarios

### ✅ **Gestión de Usuarios (NUEVO)**
- CRUD completo de usuarios autorizados WhatsApp
- Filtros por rol (Admin, Supervisor, Técnico, Operador)
- Activación/desactivación de usuarios
- Campos: teléfono, nombre, rol, área, especialidad
- Realtime updates automáticos
- Estadísticas por rol y estado

## 🗄️ Estructura de Base de Datos

### Tablas Principales
- `usuarios_autorizados` - Usuarios habilitados para WhatsApp
- `equipos` - Catálogo de maquinaria minera
- `tipos_incidente` - Catálogo de incidentes
- `tickets` - Gestión de tickets e incidentes
- `mensajes_whatsapp` - Historial de mensajes
- `historial_estados` - Trazabilidad de cambios
- `mantenimientos_programados` - Calendario de mantención
- `monitoreo_equipos` - Eventos de desconexión
- `ticket_photos` - Fotos con retención 5 años

## 🔧 Configuración

### Variables de Entorno
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xvngixjaqeteiuyusnmp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-aqui
```

### Instalación Local
```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## 📱 Roadmap - Siguiente Fase

### 1️⃣ **Integración WhatsApp (PRIORIDAD)**
- [ ] API Routes en Next.js para webhooks WhatsApp
- [ ] Validación de usuarios autorizados
- [ ] Árbol de decisión conversacional
- [ ] Upload de fotos a Supabase Storage
- [ ] Workflow N8N completo

### 2️⃣ **Monitoreo Automático**
- [ ] Detección de desconexiones de equipos
- [ ] Generación automática de tickets
- [ ] Registro de eventos cortos
- [ ] Alertas configurables

### 3️⃣ **Reporting y Analytics**
- [ ] Dashboard de KPIs
- [ ] Comparativa horas programadas vs emergencias
- [ ] Exportación de reportes mensuales
- [ ] Gráficas de tendencias

## 🎯 Estados del Ticket
- **Nuevo**: Recién creado
- **Asignado**: Asignado a técnico
- **En Proceso**: En trabajo activo
- **Resuelto**: Solucionado, pendiente cierre
- **Cerrado**: Completado con foto de cierre

## 👥 Roles de Usuario
- **Administrador**: Acceso total al sistema
- **Supervisor**: Gestión y asignación de tickets
- **Técnico**: Resolución de incidentes
- **Operador**: Creación de tickets básicos

## 📞 Soporte
Sistema desarrollado para operaciones mineras con soporte WhatsApp.
