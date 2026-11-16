# 📱 Manual Funcional de Pantallas y Flujos de Usuario — MisDecimos

Este documento proporciona una guía detallada y exhaustiva sobre el funcionamiento, propósitos, controles interactivos y código fuente de cada pantalla, modal y flujo dentro de **MisDecimos**.

---

## 📑 Índice de Pantallas

1. [Acceso y Autenticación (Login)](#1-acceso-y-autenticación)
2. [Estructura Base y Navegación (AppShell)](#2-estructura-base-y-navegación)
3. [Dashboard Principal: Mis Billetes Compartidos](#3-dashboard-principal-mis-billetes-compartidos)
4. [Detalle del Décimo y Gestión de Cuotas](#4-detalle-del-décimo-y-gestión-de-cuotas)
5. [Bandeja de Alertas y Notificaciones](#5-bandeja-de-alertas-y-notificaciones)
6. [Centro Global de Auditoría y Trazabilidad](#6-centro-global-de-auditoría-y-trazabilidad)
7. [Mi Perfil, PWA y Ajustes](#7-mi-perfil-pwa-y-ajustes)

---

## 1. Acceso y Autenticación

- **Componente Principal:** [`src/pages/LoginPage.tsx`](../src/pages/LoginPage.tsx)
- **Contexto de Estado:** [`src/context/AuthContext.tsx`](../src/context/AuthContext.tsx)
- **Librería de Backend:** Supabase Auth (`auth.signInWithOtp`, `auth.verifyOtp`)

```mermaid
flowchart TD
    A["Usuario introduce Email"] --> B["Llamada a supabase.auth.signInWithOtp"]
    B --> C["Código de 6 dígitos enviado por email"]
    C --> D["Paso 2: Formulario de 6 dígitos OTP"]
    D --> E{"verifyOtp con type: 'email'"}
    E -- Éxito --> H["Sesión iniciada / AuthContext"]
    E -- Error --> F{"Reintento con type: 'signup'"}
    F -- Éxito --> H
    F -- Error --> G["Error visible en pantalla"]
    H --> I{"¿Invitación en sessionStorage?"}
    I -- Sí --> J["Abre modal de reclamación de invitación"]
    I -- No --> K["Dashboard principal"]
```

### Funcionalidad y Controles:
1. **Introducción de Correo Electrónico:**
   - Valida el formato del email y ejecuta `signInWithOtp({ email, options: { shouldCreateUser: true } })`.
   - Si la URL de entrada contiene un parámetro de invitación `?invite=TOKEN` o `/invite/:token`, [`AuthContext.tsx`](../src/context/AuthContext.tsx) lo persiste en `sessionStorage` (`pending_invite_token`) para reanudar la reclamación inmediatamente tras autenticarse.
2. **Entrada de Código OTP de 6 Dígitos:**
   - 6 inputs numéricos independientes con avance y retroceso automático de cursor (`focus`), soporte completo para pegar (*paste*) un código de 6 dígitos copiado del portapapeles.
   - **Mecanismo de Doble Verificación Anti-Fallo:** Se invoca `supabase.auth.verifyOtp` con `type: 'email'`. Si Supabase rechaza la petición porque el usuario es un registro nuevo no confirmado, se reintenta automáticamente con `type: 'signup'`.
3. **Temporizador de Reenvío:**
   - Cuenta atrás regresiva de 60 segundos antes de permitir reenviar el código.
   - Botón *"Cambiar correo"* para retroceder de paso en caso de errata.
4. **Pie de Página Dinámico:**
   - Muestra la versión real en ejecución `MisDecimos v${__APP_VERSION__}` enlazada a la constante de compilación.

---

## 2. Estructura Base y Navegación

- **Componente Contenedor:** [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx)
- **Badge Anti-Caché:** [`src/components/common/VersionBadge.tsx`](../src/components/common/VersionBadge.tsx)

### Elementos de la Interfaz:
1. **Cabecera Superior Fija:**
   - **Logo y Título:** Logotipo oficial de Loterías y marca MisDecimos.
   - **Botón de Campana de Alertas:** Acceso directo a la pestaña de notificaciones con insignia numérica roja en tiempo real si existen alertas no leídas.
   - **Avatar de Usuario:** Enlace rápido al perfil del usuario autenticado.
2. **Barra Inferior Móvil (`BottomNav`):**
   - 4 accesos fijos adaptados a pantallas táctiles:
     - 🎟️ **Billetes:** Dashboard de décimos en custodia y participaciones.
     - 🔔 **Alertas:** Centro de notificaciones con badge interactivo.
     - 🛡️ **Auditoría:** Registro global de operaciones inmutables.
     - 👤 **Perfil:** Configuración de cuenta, avatar y notificaciones Web Push.
3. **Componente `<VersionBadge />`:**
   - Widget flotante discreto en la esquina inferior que muestra `vX.Y.Z · <git-hash>` y el indicador de red (*Online/Offline*).
   - Al pulsar, abre un modal de diagnóstico técnico con la fecha de build y el botón *"Forzar actualización y limpiar caché"*, que vacía `caches`, desregistra Service Workers y recarga en limpio.
   - Notificación flotante automática si hay una nueva versión del Service Worker en espera (`skipWaiting`).

---

## 3. Dashboard Principal: Mis Billetes Compartidos

- **Página:** [`src/pages/TicketsPage.tsx`](../src/pages/TicketsPage.tsx)
- **Tarjeta de Listado:** [`src/components/tickets/TicketListItemCard.tsx`](../src/components/tickets/TicketListItemCard.tsx)
- **Modal de Registro:** [`src/components/tickets/TicketFormModal.tsx`](../src/components/tickets/TicketFormModal.tsx)
- **Escáner de Código de Barras / QR:** [`src/components/tickets/BarcodeScannerModal.tsx`](../src/components/tickets/BarcodeScannerModal.tsx)
- **Parser Oficial GS1-128:** [`src/lib/selaeBarcodeParser.ts`](../src/lib/selaeBarcodeParser.ts)
- **Modal de Reclamación:** [`src/components/tickets/InviteClaimModal.tsx`](../src/components/tickets/InviteClaimModal.tsx)

### Pestañas del Dashboard:
- **Mis Décimos:** Muestra los décimos donde el usuario actual es el custodio legal y propietario registrador (`owner_id = user.id`).
- **Mis Participaciones:** Muestra los décimos donde el usuario ha sido invitado y posee una cuota activa aceptada (`percentage > 0`).
- **Archivados:** Décimos ocultados o archivados por el usuario para limpiar su vista principal.

### Botones y Acciones:
1. **Botón Flotante / Primario "+ Registrar Décimo":**
   - Abre [`TicketFormModal.tsx`](../src/components/tickets/TicketFormModal.tsx).
   - Permite dos métodos de captura:
     - **Modo Escáner Multimodal:** Abre la cámara trasera del móvil con selector de linterna o permite seleccionar una imagen/foto del décimo. Procesa códigos GS1-128 / ITF de SELAE extrayendo automáticamente el número de 5 dígitos, serie, fracción y fecha de sorteo.
     - **Modo Manual:** Permite seleccionar el sorteo extraordinario mediante una cuadrícula limpia de 2 opciones (**Navidad** y **El Niño**), autocompletando la fecha oficial (22 de diciembre o 6 de enero), el nombre del sorteo y el precio oficial (20,00 €), además de número (00000-99999), serie y fracción.
   - Al guardar, ejecuta la RPC `create_ticket`, asegurando el 100% de titularidad inicial y navegando inmediatamente a la ficha de detalle.
2. **Botón "Reclamar / Canjear Código" (o QR):**
   - Abre [`InviteClaimModal.tsx`](../src/components/tickets/InviteClaimModal.tsx).
   - Permite introducir el código de 6 dígitos o escanear el código QR recibido por WhatsApp/email.
   - Realiza una previsualización de la participación (número, sorteo, porcentaje e importe en €) y ofrece dos opciones:
     - **"Aceptar y Asignar a mi cuenta":** Ejecuta `accept_pending_invite` y transfiere formalmente la cuota.
     - **"Rechazar Participación":** Reintegra de inmediato el porcentaje al propietario.

---

## 4. Detalle del Décimo y Gestión de Cuotas

- **Página Principal:** [`src/pages/TicketDetailPage.tsx`](../src/pages/TicketDetailPage.tsx)
- **Boleto Realista:** [`src/components/tickets/RealisticTicketCard.tsx`](../src/components/tickets/RealisticTicketCard.tsx)
- **Comprobación de Premios:** [`src/components/tickets/PrizeCheckCard.tsx`](../src/components/tickets/PrizeCheckCard.tsx)
- **Cuadro de Propiedad:** [`src/components/tickets/OwnershipBreakdownCard.tsx`](../src/components/tickets/OwnershipBreakdownCard.tsx)
- **Reparto y Participaciones:** [`src/components/tickets/CreateParticipationSheet.tsx`](../src/components/tickets/CreateParticipationSheet.tsx)
- **Modal de Compartición (QR / Link / WhatsApp):** [`src/components/tickets/ShareInviteModal.tsx`](../src/components/tickets/ShareInviteModal.tsx)
- **Línea Temporal de Auditoría:** [`src/components/tickets/TicketAuditTimeline.tsx`](../src/components/tickets/TicketAuditTimeline.tsx)

### Módulos Integrados en el Detalle:

#### A) Tarjeta de Décimo Realista (`<RealisticTicketCard />`)
- Representación visual del décimo con diseño fiel al papel oficial de SELAE, textura guilloché de seguridad, código de barras simulado, fecha del sorteo, precio e insignia de custodia legal asignada al propietario.
- **Mecanismo de Fallback Anti-Imagen Rota:** Integra un listener reactivo `onError` que, ante cualquier fallo de carga o ausencia de imagen de plantilla externa (`template_image_url`), conmuta de forma automática e inmediata al motor vectorial completo (filigrana guilloché, capilla artística con sello digital `MisDecimos`, número matricial y código GS1-128), evitando iconos de imagen rota en el navegador.

#### B) Comprobador Oficial de Premios (`<PrizeCheckCard />`)
- **Consulta Oficial:** Botón *"Comprobar premio"* que invoca la Supabase Edge Function `check-prizes`, conectada a endpoints oficiales y de alta disponibilidad con caché en memoria.
- **Desglose Fiscal (Ley 16/2012):** Calcula automáticamente el premio total, la exención de los primeros 40.000 € y la retención del 20% de IRPF para obtener el importe neto a liquidar.
- **Cuota Individual:** Muestra a cada participante el importe exacto bruto y neto que le corresponde en base a su porcentaje aceptado.
- **Confirmación de Cobro:** Botón *"He recibido mi premio"*, disponible para cotitulares cuando el estado es `VALIDADO`. Ejecuta `confirm_prize_paid` registrando fecha, hora e IP para la liquidación formal unánime.

#### C) Cuadro de Propiedad y Gráfico Donut SVG (`<OwnershipBreakdownCard />`)
- **Gráfico Donut SVG Dinámico:** Visualiza el 100% de la propiedad dividido en sectores de color por cotitular. En el centro certifica el estado `100% Distribuido` (Principio Cero Huérfanos).
- **Lista de Cotitulares:** Nombre, avatar, porcentaje exacto, importe jugado y estado de cuota (`ACEPTADA`).
- **Invitaciones Pendientes:** Listado de códigos activos emitidos aún no reclamados, con botón para abrir el modal de compartición y botón **"Eliminar"** visible para el propietario en cualquier estado del décimo (`PENDIENTE`, `VALIDADO`, `ARCHIVADO`, salvo liquidado), devolviendo de inmediato la cuota al propietario. Si existen 2 o más invitaciones pendientes, muestra además el botón masivo **"Cancelar todas las pendientes (recuperar X%)"** para cancelar en un solo clic mediante la RPC `cancel_all_pending_invites`.
- **Añadir Participación y Eliminación de Décimo:** El botón inferior *"Añadir participación"* permanece disponible tanto en `PENDIENTE` como en `VALIDADO` mientras el propietario conserve cuota libre. Asimismo, el botón *"Eliminar décimo"* está habilitado en ambos estados siempre que no existan cuotas de terceros en estado `ACEPTADA`.
- **Flujo Bilateral de Renuncia de Participaciones:**
  - Un participante puede pulsar *"Solicitar renuncia"* indicando el motivo.
  - El custodio recibe una alerta y puede *"Aceptar renuncia"* (reintegrando el porcentaje a su bolsa) o *"Rechazar renuncia"*.

#### D) Reparto de Participaciones (`<CreateParticipationSheet />`)
- Permite crear nuevas participaciones antes del sorteo:
  - **Reparto Manual:** Especificando porcentaje (%) o importe en euros (€).
  - **Reparto a Partes Iguales:** Entre N personas (ej. 3, 4, 5 cotitulares), aplicando el algoritmo de absorción de redondeo en el custodio para garantizar suma exacta del 100,00%.
- Al guardar, abre [`ShareInviteModal.tsx`](../src/components/tickets/ShareInviteModal.tsx), que genera:
  - Enlace web directo `https://misdecimos.dianrie.com/invite/<token>`
  - Código numérico de 6 dígitos
  - Código QR generado con `qrcode.react`
  - Botón directo para compartir el mensaje oficial por **WhatsApp**.

#### E) Auditoría del Décimo (`<TicketAuditTimeline />`)
- Historial inmutable y cronológico de todas las mutaciones producidas sobre el décimo: creación, escaneos, cesión de porcentajes, invitaciones reclamadas, renuncias solicitadas/aceptadas y confirmaciones de cobro de premios.

---

## 5. Bandeja de Alertas y Notificaciones

- **Página:** [`src/pages/AlertsPage.tsx`](../src/pages/AlertsPage.tsx)
- **Backend:** Tabla `public.notifications` con suscripción Supabase Realtime y Web Push.

### Funcionalidad y Controles:
1. **Filtro de Estado:** Alternador entre *"Todas las alertas"* y *"Solo no leídas"*.
2. **Formato Temporal:** Estampas temporales formateadas en `HH:mm - DD/MM` (ej. `14:35 - 22/12`).
3. **Acciones Rápidas en la Alerta:**
   - Si la alerta corresponde a una solicitud de renuncia de participación, ofrece directamente dos botones:
     - ✅ **Aceptar Renuncia:** Ejecuta `respond_waiver(..., p_accept = true)`.
     - ❌ **Rechazar:** Ejecuta `respond_waiver(..., p_accept = false)`.
   - Clicar en cualquier alerta redirige automáticamente a la ficha del décimo correspondiente.
4. **Botón "Leídas todas":** Invoca la RPC `mark_all_notifications_read`, actualizando el estado de lectura y poniendo a 0 el badge de la campana.

---

## 6. Centro Global de Auditoría y Trazabilidad

- **Página:** [`src/pages/AuditPage.tsx`](../src/pages/AuditPage.tsx)
- **Backend:** Tabla inmutable `public.audit_events` (sin permisos de UPDATE o DELETE en RLS).

### Secciones Principales:
1. **Acordeón de las 4 Reglas de Oro:**
   - 🔒 **Custodia Inmutable:** El custodio registrador inicial nunca puede transferirse a un tercero.
   - ⚖️ **Cero Huérfanos:** La suma de porcentajes de un décimo debe ser siempre exactamente 100,00%.
   - 🛡️ **Trazabilidad Inmutable:** Cada cesión, renuncia y liquidación se registra con estampa de tiempo y usuario.
   - 🤝 **Liquidación Unánime:** La marcación como `LIQUIDADO` exige que todos los participantes confirmen el cobro.
2. **Buscador y Filtros por Categoría:**
   - Barra de búsqueda libre (número de décimo, tipo de evento o nombre del participante).
   - Chips de filtrado rápido: *Todos, Creación, Participaciones, Premios, Seguridad*.
3. **Línea Temporal Global:**
   - Explorador de eventos de toda la plataforma a los que el usuario tiene acceso legítimo, con tarjeta desplegable de metadatos técnicos (dirección IP, navegador, método de origen y hashes).

---

## 7. Mi Perfil, PWA y Ajustes

- **Página:** [`src/pages/ProfilePage.tsx`](../src/pages/ProfilePage.tsx)
- **Servicio Push:** [`src/services/push/pushSubscription.ts`](../src/services/push/pushSubscription.ts)
- **Banner PWA:** [`src/components/pwa/PwaInstallBanner.tsx`](../src/components/pwa/PwaInstallBanner.tsx)
- **Storage:** Bucket Supabase Storage `avatars` con RLS por UID.

### Opciones y Controles:
1. **Avatar de Usuario con Compresión en Cliente:**
   - Selector de imagen con previsualización inmediata.
   - Redimensiona automáticamente y convierte la imagen a formato **WebP** en el navegador para ahorrar ancho de banda.
   - Sube el archivo al bucket seguro `avatars` en Supabase Storage bajo la carpeta del usuario `auth.uid()`.
2. **Datos Personales Sanitizados:**
   - Campos de *Nombre a mostrar* y *Teléfono de contacto*, protegidos contra inyecciones XSS mediante `sanitizeText`.
3. **Gestión de Notificaciones Web Push (VAPID):**
   - Interruptor (*Toggle*) para activar/desactivar notificaciones nativas en el dispositivo.
   - Registra el endpoint, clave `p256dh` y `auth` en `public.web_push_subscriptions` vinculados al usuario.
   - Botón *"Enviar notificación de prueba"*: Dispara la Edge Function `send-push` en modo test para verificar que el Service Worker y el sistema operativo muestran la alerta correctamente con sonido y vibración.
4. **Instalación de la PWA:**
   - Componente [`PwaInstallBanner.tsx`](../src/components/pwa/PwaInstallBanner.tsx).
   - En Android / Chrome: Dispara el evento nativo `beforeinstallprompt` en un solo clic.
   - En iOS Safari: Guía visual explicativa paso a paso (*"Compartir" -> "Añadir a pantalla de inicio"*).
5. **Cierre de Sesión:**
   - Botón *"Cerrar Sesión"* que ejecuta `supabase.auth.signOut()`, limpia el estado global y devuelve al usuario a la pantalla de Login.
