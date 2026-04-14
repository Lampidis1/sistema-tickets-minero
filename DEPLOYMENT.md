# 🚀 DEPLOYMENT - Sistema Tickets Minero

## ✅ CHECKLIST PRE-DEPLOYMENT

### 1. Verificar Archivos Localmente
```bash
# Estructura esperada
app/
  ├── api/whatsapp/route.ts
  ├── dashboard/
  │   ├── asignaciones/page.tsx  ✅ NUEVO
  │   ├── equipment/
  │   ├── tickets/
  │   └── usuarios/page.tsx      ✅ NUEVO
  └── layout.tsx

lib/
  ├── asignacion-tecnicos.ts     ✅ NUEVO
  ├── bot-flujo.ts               ✅ ACTUALIZADO
  ├── bot-sesiones.ts            ✅ ACTUALIZADO
  ├── notificaciones.ts          ✅ NUEVO
  └── supabase.ts
```

### 2. Variables de Entorno en Vercel

Ve a **Vercel Dashboard → Tu Proyecto → Settings → Environment Variables** y agrega:

```bash
# Supabase (ya deberías tenerlas)
NEXT_PUBLIC_SUPABASE_URL=https://xvngixjaqeteiuyusnmp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui

# WhatsApp Business API (NUEVAS)
WHATSAPP_VERIFY_TOKEN=mi_token_secreto_2024
WHATSAPP_ACCESS_TOKEN=tu_access_token_de_meta
WHATSAPP_PHONE_NUMBER_ID=103142321672950
```

### 3. Migrar Base de Datos en Supabase

Ejecuta estos SQL en **Supabase → SQL Editor**:

#### Migración 1: Tabla de Sesiones del Bot
```sql
-- Crear tabla de sesiones conversacionales
CREATE TABLE IF NOT EXISTS public.sesiones_bot (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    telefono varchar NOT NULL UNIQUE,
    estado varchar NOT NULL DEFAULT 'idle',
    datos_temporales jsonb DEFAULT '{}'::jsonb,
    ultima_actividad timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_bot_telefono ON public.sesiones_bot(telefono);
CREATE INDEX IF NOT EXISTS idx_sesiones_bot_ultima_actividad ON public.sesiones_bot(ultima_actividad);
```

#### Migración 2: Campos de Notificaciones en Usuarios
```sql
-- Agregar campos para sistema de notificaciones
ALTER TABLE public.usuarios_autorizados
ADD COLUMN IF NOT EXISTS notificaciones_push boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notificaciones_email boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email varchar,
ADD COLUMN IF NOT EXISTS prioridad_asignacion integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS tickets_activos integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS acepta_emergencias boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS disponible boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS turno_actual varchar,
ADD COLUMN IF NOT EXISTS ultima_asignacion timestamptz;

CREATE INDEX IF NOT EXISTS idx_usuarios_disponibles 
ON public.usuarios_autorizados(disponible, activo) 
WHERE rol IN ('tecnico', 'supervisor');

CREATE INDEX IF NOT EXISTS idx_usuarios_emergencias 
ON public.usuarios_autorizados(acepta_emergencias, disponible) 
WHERE activo = true;
```

#### Migración 3: Tabla de Notificaciones
```sql
-- Tabla para registro de notificaciones
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
    usuario_id uuid REFERENCES public.usuarios_autorizados(id) ON DELETE CASCADE,
    tipo varchar NOT NULL,
    canal varchar NOT NULL,
    mensaje text NOT NULL,
    estado varchar DEFAULT 'pendiente',
    prioridad integer DEFAULT 3,
    metadata jsonb DEFAULT '{}'::jsonb,
    enviado_at timestamptz,
    entregado_at timestamptz,
    leido_at timestamptz,
    error_mensaje text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON public.notificaciones(usuario_id, estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_ticket ON public.notificaciones(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON public.notificaciones(estado) WHERE estado = 'pendiente';
```

#### Migración 4: Funciones RPC
```sql
-- Función para incrementar tickets activos
CREATE OR REPLACE FUNCTION incrementar_tickets_activos(usuario_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE usuarios_autorizados
  SET tickets_activos = COALESCE(tickets_activos, 0) + 1
  WHERE id = usuario_id;
END;
$$ LANGUAGE plpgsql;

-- Función para decrementar tickets activos
CREATE OR REPLACE FUNCTION decrementar_tickets_activos(usuario_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE usuarios_autorizados
  SET tickets_activos = GREATEST(COALESCE(tickets_activos, 0) - 1, 0)
  WHERE id = usuario_id;
END;
$$ LANGUAGE plpgsql;
```

### 4. Configurar Storage en Supabase

1. Ve a **Supabase → Storage**
2. Crear nuevo bucket: **`ticket-photos`**
3. Configuración:
   - **Public bucket**: ✅ true
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`

4. Crear políticas (SQL Editor):
```sql
-- Política para upload
CREATE POLICY "Permitir upload de fotos de tickets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-photos');

-- Política para lectura
CREATE POLICY "Permitir lectura pública de fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-photos');
```

### 5. Configurar Webhook de WhatsApp en Meta

1. Ve a https://developers.facebook.com/
2. Tu App → WhatsApp → Configuration
3. En "Webhook":
   - **Callback URL**: `https://sistema-tickets-minero.vercel.app/api/whatsapp`
   - **Verify Token**: `mi_token_secreto_2024`
   - Click **Verify and Save**

4. Suscribirse a eventos:
   - Marcar: ✅ `messages`
   - Click **Subscribe**

### 6. Configurar Usuarios de Prueba

Ejecuta en Supabase SQL Editor:

```sql
-- Actualizar usuarios existentes con nuevos campos
UPDATE usuarios_autorizados
SET 
  notificaciones_push = true,
  prioridad_asignacion = 5,
  tickets_activos = 0,
  acepta_emergencias = false,
  disponible = true,
  turno_actual = 'A'
WHERE activo = true;

-- Marcar un técnico como especialista de emergencias
UPDATE usuarios_autorizados
SET 
  acepta_emergencias = true,
  prioridad_asignacion = 1,
  especialidad = 'eléctrico'
WHERE telefono = '+56912345678'; -- Reemplaza con un teléfono real
```

### 7. Insertar Tipos de Incidente

```sql
INSERT INTO tipos_incidente (nombre, categoria, prioridad_default, requiere_foto) VALUES
  ('Falla eléctrica', 'electrico', 2, true),
  ('Falla mecánica', 'mecanico', 2, true),
  ('Falla hidráulica', 'hidraulico', 2, true),
  ('Falla de neumáticos', 'neumaticos', 3, true),
  ('Otro problema', 'general', 3, true)
ON CONFLICT DO NOTHING;
```

---

## 🧪 TESTING POST-DEPLOYMENT

### Test 1: Verificar Webhook
```bash
curl "https://sistema-tickets-minero.vercel.app/api/whatsapp?hub.mode=subscribe&hub.verify_token=mi_token_secreto_2024&hub.challenge=test123"
```
✅ Debe responder: `test123`

### Test 2: Ver Logs en Vercel
1. Vercel Dashboard → Tu Proyecto → Logs
2. Envía "Hola" desde WhatsApp
3. Deberías ver: `📱 Procesando mensaje de: +56...`

### Test 3: Crear Ticket Completo

Desde WhatsApp con un usuario autorizado:
```
1. Escribe: "Hola"
2. Escribe: "1" (nuevo ticket)
3. Escribe: "CAEX-120" (equipo)
4. Escribe: "1" (falla eléctrica)
5. Escribe: "El motor no arranca"
6. Escribe: "A" (turno)
7. Escribe: "Día"
8. [Si eres técnico] Escribe: "NO" (no es emergencia)
9. Envía foto del problema
10. ✅ Deberías recibir número de ticket
```

### Test 4: Verificar Dashboard
1. Ir a https://sistema-tickets-minero.vercel.app/dashboard
2. Ver que el ticket aparece en la lista
3. Ir a "Asignaciones"
4. Ver que el técnico tiene el ticket asignado

### Test 5: Verificar Notificación
Si el ticket se asignó automáticamente, el técnico debería recibir:
```
🔔 *Nuevo Ticket Asignado*

Hola *[Nombre]!*

Se te ha asignado un nuevo ticket:
...
```

---

## ⚠️ TROUBLESHOOTING

### Problema: Webhook no verifica
**Solución**: 
- Verifica que `WHATSAPP_VERIFY_TOKEN` en Vercel coincida con Meta
- Revisa logs en Vercel

### Problema: No se envían notificaciones WhatsApp
**Solución**:
- Verifica `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`
- Revisa que el token no haya expirado
- Verifica logs: debería aparecer `✅ Mensaje enviado a WhatsApp`

### Problema: Error al subir foto
**Solución**:
- Verifica que el bucket `ticket-photos` existe
- Verifica que sea público
- Verifica las políticas de storage

### Problema: No asigna técnicos automáticamente
**Solución**:
```sql
-- Verificar que hay técnicos disponibles
SELECT nombre, disponible, tickets_activos 
FROM usuarios_autorizados 
WHERE rol IN ('tecnico', 'supervisor') AND activo = true;

-- Marcar técnicos como disponibles
UPDATE usuarios_autorizados 
SET disponible = true 
WHERE rol = 'tecnico';
```

---

## 📊 MÉTRICAS DE ÉXITO

Después del deployment, verifica:

✅ Webhook responde correctamente
✅ Usuarios pueden crear tickets vía WhatsApp
✅ Fotos se suben a Supabase Storage
✅ Técnicos reciben notificaciones push
✅ Dashboard muestra tickets en tiempo real
✅ Asignación automática funciona
✅ Página de asignaciones carga correctamente

---

## 🎯 PRÓXIMO PASO

Una vez verificado todo:

1. **Probar con usuarios reales** (3-5 personas)
2. **Ajustar algoritmo de asignación** según feedback
3. **Monitorear notificaciones** (ver si llegan)
4. **Implementar Fase 2**: Monitoreo automático de equipos

---

## 📞 SOPORTE

Si algo no funciona:
1. Revisa Vercel Logs
2. Revisa Supabase Logs (Database → Logs)
3. Verifica variables de entorno
4. Verifica que todas las migraciones se ejecutaron

**El sistema está completo y listo para producción** 🚀
