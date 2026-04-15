# 📱 Configuración de Twilio WhatsApp

Guía paso a paso para integrar WhatsApp usando Twilio.

---

## ✅ Paso 1: Obtener Credenciales de Twilio

1. **Ir a Twilio Console:**
   - https://console.twilio.com/

2. **Copiar credenciales:**
   - **Account SID**: Está en el dashboard principal
   - **Auth Token**: Click en "Show" para revelar

3. **Guardar en `.env.local`:**
   ```env
   TWILIO_ACCOUNT_SID=AC1234567890abcdef...
   TWILIO_AUTH_TOKEN=tu_auth_token_secreto
   ```

---

## ✅ Paso 2: Activar WhatsApp Sandbox (Pruebas)

1. **Ir a Messaging → Try it out → Send a WhatsApp message:**
   - https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn

2. **Unirse al sandbox:**
   - Enviar desde tu WhatsApp:
   - **A:** `+1 415 523 8886`
   - **Mensaje:** `join <tu-código-único>`
   - Ejemplo: `join orange-tiger`

3. **Copiar número del sandbox:**
   ```env
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

---

## ✅ Paso 3: Configurar Webhook

1. **Ir a Messaging → Settings → WhatsApp Sandbox Settings:**
   - https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox

2. **Configurar webhook de mensajes entrantes:**
   - **When a message comes in:** 
   - URL: `https://tu-dominio.vercel.app/api/whatsapp/webhook`
   - Method: **HTTP POST**

3. **Guardar cambios**

---

## ✅ Paso 4: Configurar Variables en Vercel

1. **Ir a tu proyecto en Vercel:**
   - Settings → Environment Variables

2. **Agregar:**
   ```
   TWILIO_ACCOUNT_SID = AC1234...
   TWILIO_AUTH_TOKEN = tu_token_secreto
   TWILIO_WHATSAPP_NUMBER = whatsapp:+14155238886
   SUPABASE_SERVICE_ROLE_KEY = tu_service_role_key
   ```

3. **Redeploy** para que surtan efecto

---

## ✅ Paso 5: Probar Integración

### **Enviar mensaje de prueba:**

```bash
curl -X POST https://tu-dominio.vercel.app/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "whatsapp:+56912345678",
    "message": "Hola! Este es un mensaje de prueba del sistema de tickets."
  }'
```

### **Respuesta esperada:**

```json
{
  "success": true,
  "messageSid": "SM1234567890abcdef...",
  "status": "queued"
}
```

---

## ✅ Paso 6: Flujo Completo de Prueba

1. **Desde tu WhatsApp, envía:**
   ```
   Hola
   ```
   Al número: `+1 415 523 8886`

2. **Deberías recibir:**
   ```
   👋 ¡Hola [Tu Nombre]!

   📋 EQUIPOS DISPONIBLES:

   🚛 CAEX (CAMIONES) (5 equipos)
      • CAEX 120
      • CAEX 121
      ...
   ```

3. **Si NO recibes respuesta:**
   - Verificar que el webhook esté configurado
   - Revisar logs en Vercel
   - Verificar que tu número esté en `usuarios_autorizados`

---

## 🔧 Paso 7: Agregar Usuario Autorizado

Si tu número NO está en la base de datos:

```sql
INSERT INTO usuarios_autorizados (
  telefono, 
  nombre, 
  rol, 
  especialidad, 
  activo
) VALUES (
  '+56912345678',
  'Tu Nombre',
  'técnico',
  'mecánico',
  true
);
```

O desde el dashboard: `/dashboard/usuarios` → Crear Usuario

---

## 📊 Monitoreo y Logs

### **Ver logs de mensajes en Twilio:**
- https://console.twilio.com/us1/monitor/logs/sms

### **Ver logs en Vercel:**
- Tu proyecto → Deployments → [último deploy] → Runtime Logs

### **Ver mensajes en Supabase:**
```sql
SELECT * FROM mensajes_whatsapp 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 💰 Costos

### **Sandbox (Gratis):**
- ✅ Ilimitado para pruebas
- ⚠️ Solo números que hicieron "join"
- ⚠️ Mensaje expira cada 24 horas

### **Producción:**
- **Solicitar número oficial:** $15 USD setup
- **Mensajes:** $0.005 USD/mensaje en Chile
- **Ejemplo:** 1,000 mensajes/mes = $5 USD

---

## 🚀 Migrar a Producción

Cuando estés listo para producción:

1. **Request to enable your Twilio number for WhatsApp:**
   - https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders

2. **Completar Facebook Business Verification**

3. **Configurar Templates de mensajes**

4. **Actualizar webhook a producción**

---

## ❓ Troubleshooting

### **Problema: No recibo mensajes**
- ✅ Verificar que hiciste "join" al sandbox
- ✅ Webhook configurado correctamente
- ✅ Tu número está en `usuarios_autorizados` con `activo=true`

### **Problema: Error 401 Unauthorized**
- ✅ Verificar TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN
- ✅ Redeploy en Vercel después de cambiar variables

### **Problema: Error enviando mensaje**
- ✅ Número destino en formato: `whatsapp:+56912345678`
- ✅ Incluir código de país (+56 para Chile)

---

## 📞 Soporte

- **Docs Twilio:** https://www.twilio.com/docs/whatsapp
- **Twilio Support:** https://support.twilio.com
- **Status Twilio:** https://status.twilio.com

---

**✅ Sistema listo para usar WhatsApp con Twilio!**
