# ARCHITECTURE.md — Arquitectura Técnica de MisDecimos

Documento de referencia para el modelo de datos, funciones transaccionales y subsistemas de MisDecimos.

---

## 1. Diagrama Entidad-Relación (ER)

```mermaid
erDiagram
    auth_users ||--|| profiles : "id = auth.users.id"
    profiles ||--o{ tickets : "owner_id"
    profiles ||--o{ ownership_shares : "user_id"
    profiles ||--o{ pending_invites : "created_by / accepted_by_user_id"
    profiles ||--o{ ticket_archive_hides : "user_id"
    profiles ||--o{ audit_events : "actor_id / target_user_id"
    profiles ||--o{ notifications : "user_id"
    profiles ||--o{ web_push_subscriptions : "user_id"

    draw_templates ||--o{ tickets : "template_id"
    tickets ||--o{ ownership_shares : "ticket_id (CASCADE)"
    tickets ||--o{ pending_invites : "ticket_id (CASCADE)"
    tickets ||--o{ ticket_archive_hides : "ticket_id (CASCADE)"
    tickets ||--o{ audit_events : "ticket_id (CASCADE)"
    tickets ||--o{ notifications : "ticket_id (SET NULL)"

    profiles {
        uuid id PK
        text display_name
        text email
        text phone
        text avatar_url
        boolean push_enabled
        timestamptz created_at
        timestamptz updated_at
    }

    draw_templates {
        uuid id PK
        text draw_type
        int year
        text name
        numeric default_price
        text template_image_url
        jsonb overlay_config
        boolean is_active
        timestamptz created_at
    }

    tickets {
        uuid id PK
        uuid owner_id FK
        varchar number
        varchar serie
        varchar fraccion
        text draw_type
        text draw_name
        date draw_date
        numeric ticket_price
        text barcode_raw
        uuid template_id FK
        text status
        bigint prize_amount_cents
        timestamptz last_checked_at
        text check_source
        text origin
        timestamptz created_at
        timestamptz updated_at
    }

    ownership_shares {
        uuid id PK
        uuid ticket_id FK
        uuid user_id FK
        numeric percentage
        text role
        text status
        boolean waiver_requested
        timestamptz waiver_requested_at
        boolean prize_paid_confirmed
        timestamptz prize_paid_confirmed_at
        timestamptz created_at
        timestamptz updated_at
    }

    pending_invites {
        uuid id PK
        uuid ticket_id FK
        uuid created_by FK
        text label
        numeric percentage
        uuid invite_token UK
        varchar short_code
        text status
        uuid accepted_by_user_id FK
        timestamptz accepted_at
        timestamptz created_at
        timestamptz updated_at
    }

    ticket_archive_hides {
        uuid ticket_id PK,FK
        uuid user_id PK,FK
        timestamptz hidden_at
    }

    audit_events {
        uuid id PK
        uuid ticket_id FK
        uuid actor_id FK
        uuid target_user_id FK
        text action
        numeric percentage
        jsonb metadata
        timestamptz created_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        uuid ticket_id FK
        text type
        text title
        text body
        text action_url
        jsonb metadata
        boolean is_read
        timestamptz created_at
    }

    web_push_subscriptions {
        uuid id PK
        uuid user_id FK
        text endpoint UK
        text p256dh
        text auth
        text platform
        text user_agent
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 2. Catálogo de Funciones RPC (`SECURITY DEFINER`)

Todas las operaciones que mutan porcentajes, estados de décimos o invitaciones se ejecutan de manera atómica con `SET search_path = public, auth`:

| Función RPC | Parámetros Principales | Descripción y Efecto Atómico |
| :--- | :--- | :--- |
| `create_ticket` | `p_number, p_serie, p_fraccion, p_draw_type, p_draw_name, p_draw_date, p_ticket_price, p_barcode_raw, p_template_id, p_origin` | Crea el décimo, asigna cuota del 100% al propietario en `ownership_shares`, registra evento en `audit_events` y genera notificación interna. |
| `create_manual_participation` | `p_ticket_id, p_percentage, p_label` | Valida que el llamante sea el propietario, resta `p_percentage` de su cuota, genera un `short_code` numérico aleatorio único de 6 dígitos y crea el registro en `pending_invites`. |
| `create_equal_split_participations` | `p_ticket_id, p_parts_count, p_owner_participates` | Cancela invitaciones pendientes previas restituyendo cuotas, reparte a partes iguales absorbiendo el redondeo en la cuota del propietario y genera las invitaciones pendientes. |
| `cancel_pending_invite` | `p_invite_id` | Cambia el estado de la invitación a `CANCELADA` y reintegra íntegramente su porcentaje al propietario. |
| `accept_pending_invite` | `p_code_or_token, p_confirm` | Con `p_confirm = false` retorna una vista previa informativa. Con `p_confirm = true`, transfiere la cuota a `ownership_shares` (`ACEPTADA`) a nombre del usuario autenticado, marca la invitación `ACEPTADA` y notifica al propietario. |
| `reject_pending_invite` | `p_code_or_token` | Marca la invitación como `RECHAZADA` y restituye el porcentaje de forma inmediata al propietario. |
| `request_share_waiver` | `p_share_id` | Solo el propietario. Establece `waiver_requested = true` y despacha una notificación de solicitud de renuncia al participante. |
| `respond_share_waiver` | `p_share_id, p_accept` | El participante responde. Si acepta, su cuota pasa a 0%, estado `RENUNCIADA`, y el porcentaje se le devuelve al propietario. Si rechaza, cancela la solicitud manteniendo la cuota. |
| `renounce_own_participation` | `p_share_id` | Permite al participante con cuota aceptada renunciar voluntariamente a ella mientras no esté liquidado ni premiado pendiente. Su cuota pasa a 0%, estado `RENUNCIADA`, se reintegra al propietario, genera auditoría `RENUNCIA_VOLUNTARIA_PARTICIPANTE` y notifica al custodio. |
| `record_ticket_prize_check` | `p_ticket_id, p_prize_amount_cents, p_check_source, p_list_status` | Actualiza el premio del billete, marca estado `VALIDADO` si estaba `PENDIENTE`, registra `PREMIO_COMPROBADO` en auditoría y genera alertas con importes proporcionales a cotitulares. |
| `request_payout_confirmation_reminder` | `p_ticket_id` | Permite enviar un recordatorio formal de cobro (`SOLICITUD_VALIDAR_COBRO`) a participantes pendientes o al propietario. |
| `confirm_prize_received` | `p_ticket_id` | El participante o custodio confirma recepción de su cobro. Si todos los cotitulares activos han confirmado, conmuta el estado del décimo a `LIQUIDADO`. |
| `mark_all_notifications_read` | - | Marca de forma masiva todas las notificaciones pendientes del usuario autenticado como leídas (`is_read = true`). |
| `toggle_archive_ticket` | `p_ticket_id, p_archive` | Gestiona el registro en `ticket_archive_hides` para ocultar o desocultar el décimo en la vista del usuario llamante. |

### Políticas de Seguridad y Aislamiento RLS (Row Level Security)

- **`pending_invites` (Privacidad Estricta de Códigos PIN y Tokens):**
  - La política `pending_invites_select` permite el acceso `SELECT` únicamente a:
    1. El propietario del décimo (`created_by = auth.uid() OR is_ticket_owner(ticket_id)`).
    2. El usuario que ya aceptó esa invitación concreta (`accepted_by_user_id = auth.uid()`).
  - Ningún otro participante del décimo (`ownership_shares`) puede consultar ni listar invitaciones en estado `PENDIENTE` ni obtener códigos PIN o tokens por API directa.
  - Las operaciones de previsualización y canje de invitaciones (`accept_pending_invite` y `reject_pending_invite`) operan mediante funciones RPC transaccionales `SECURITY DEFINER` con `search_path = public, auth`, permitiendo validar y canjear códigos PIN de 6 dígitos sin requerir permisos `SELECT` directos sobre la tabla por parte del invitado.

---

## 3. Arquitectura PWA y Web Push VAPID

### Ciclo de Vida y Auto-Actualización Silenciosa (`autoUpdate`)
- **Estrategia Workbox:** `registerType: 'autoUpdate'`, `skipWaiting: true`, `clientsClaim: true` y `cleanupOutdatedCaches: true`.
- **Detección Inmediata y Silenciosa:** La PWA comprueba la existencia de nuevas versiones cada 60 segundos y cada vez que el usuario regresa a la aplicación (`visibilitychange`). Al detectar una nueva compilación en Vercel, descarga los nuevos assets y activa el nuevo Service Worker en segundo plano.
- **Transición Transparente:** Mediante el listener `controllerchange` en el cliente, la aplicación recarga una única vez de forma limpia sin mostrar carteles flotantes ni requerir confirmación manual del usuario, garantizando que siempre se ejecute el código más reciente.
- **Depuración Manual:** El modal de diagnóstico del componente `<VersionBadge />` mantiene la capacidad de inspeccionar el commit, versión y fecha de compilación, además de un botón directo de purga forzada (`navigator.serviceWorker.getRegistrations().unregister()` + borrado de `window.caches`).

### Soporte Multi-Plataforma
- **Android:** Notificaciones Web Push estándar mediante el Service Worker vía Chrome/Edge/Firefox.
- **iOS (16.4+):** Requiere que la aplicación sea instalada en la pantalla de inicio ("Añadir a pantalla de inicio" / PWA standalone) para conceder permisos y suscribirse al Notification API mediante el Service Worker.

### Onboarding Inteligente de Permisos Push (`src/hooks/usePushPermissionPrompt.ts`)
- **Estrategia No Intrusiva:** La solicitud de permisos Web Push se gestiona de forma diferida y contextualizada para maximizar la tasa de aceptación sin saturar al usuario:
  - **Disparador 1 (Primera Visita):** Se abre tras 1,5 segundos en la primera sesión (`dismissals === 0`) si el usuario no tiene permisos activos.
  - **Disparador 2 (Notificación Pendiente):** Se abre de forma contextualizada (*"Tienes notificaciones nuevas"*) si existen alertas no leídas (`unreadCount > 0`) y no se ha preguntado en la sesión actual.
- **Límite de 3 Cancelaciones:** Se almacena el contador `misdecimos_push_prompt_dismissals_${userId}` en `localStorage` con bloqueo de sesión en `sessionStorage`. Si el usuario descarta 3 veces el diálogo o si el navegador tiene el permiso en `denied`, no se vuelve a preguntar de forma automática.
- **Aviso de Descarte:** Al pulsar *"Ahora no"* o cerrar el modal, se muestra un aviso flotante de 5 segundos con acceso directo para gestionar las alertas en **Perfil**. Al activar manualmente el interruptor en `ProfilePage.tsx`, el contador de descartes se restablece automáticamente a 0.

### Instalador y Guía PWA Multiplataforma (`src/hooks/usePwaInstallPrompt.ts` y `<PwaInstallBanner />`)
- **Detección de Entorno Standalone:** Comprueba de forma combinada `display-mode: standalone`, `(navigator as any).standalone === true`, referrers `android-app://` y la persistencia en `localStorage` (`misdecimos_pwa_installed`). Si la app ya está instalada, anula cualquier aviso automático.
- **Detección de Plataforma y Adaptación Visual:**
  - `chromium`: Android (Chrome, Edge, Samsung Internet, Brave) y navegadores de escritorio Chromium. Captura a nivel global el evento `beforeinstallprompt` y escucha `appinstalled`. Dispone del botón directo de instalación en un clic (`deferredPrompt.prompt()`).
  - `ios`: iPhone, iPod e iPadOS (incluyendo iPadOS que reporta `MacIntel` con pantalla multitáctil `maxTouchPoints > 1`). Despliega guía visual con iconos paso a paso: compartir (`Share`) → *"Añadir a pantalla de inicio"* (`PlusSquare`) → *"Añadir"*.
  - `macos-safari`: Safari de escritorio en macOS. Muestra instrucciones guiadas para anclar al Dock mediante *Archivo → Añadir al Dock...*.
  - `desktop-other`: Otros navegadores de escritorio (como Mozilla Firefox). Ofrece orientación para instalar desde la barra de direcciones o menú del navegador.
- **Regla de Frecuencia Estricta (Máximo 3 Apariciones):**
  - Almacena en `localStorage` la clave `misdecimos_pwa_install_prompt_count`.
  - Dispone de bloqueo de sesión en `sessionStorage` (`misdecimos_pwa_prompt_shown_session`) para mostrarlo como máximo una única vez por sesión.
  - Se activa con un retardo de 2,5 segundos tras cargar la app únicamente si no hay modales en primer plano (`PushPermissionModal` o vistas de billete).
  - Al descartar (`dismiss()`), incrementa el contador en `+1`. Cuando alcanza `3`, no vuelve a mostrarse de forma automática jamás.
- **Invocación Manual en Perfil:** La sección *"Instalar aplicación en tu dispositivo"* en `ProfilePage.tsx` permanece siempre accesible e ignora el límite de 3 avisos, abriendo de forma inmediata el instalador correspondiente.
- **Soporte de Navegación Nativa:** Integrado con `useModalBackHandler` (`modalKey: 'pwa_install_banner'`) y presentado a nivel `z-50` sobre `BottomNav` con padding seguro para la barra de inicio (`env(safe-area-inset-bottom)`).

### Navegación Nativa Android y Gestión de Historial (PWA Anti-Cierre)
- **Gestor Global (`src/hooks/useAndroidBackNavigation.ts`):**
  - Controla el evento `window.onpopstate` para sincronizar las vistas internas (`/`, `/billetes/:id`, `/alertas`, `/auditoria`, `/perfil`) con el botón o gesto físico de retroceso de Android sin depender de librerías externas pesadas.
  - **Mecanismo Centinela (`exitGuard: true`):** En la ruta raíz (`/`), se inserta una entrada centinela en la pila de `window.history`. Al pulsar Atrás por primera vez, el evento es interceptado, se muestra un toast flotante en `z-50` (*"Pulsa atrás de nuevo para cerrar la aplicación"*) y se activa una ventana temporal de 2,5 segundos. Si se produce un segundo toque dentro de ese lapso, se permite la salida de la PWA; de lo contrario, el aviso se oculta y la guardia centinela se re-arma de manera automática.
  - **Navegación Interior y Resiliencia Deep-Link:** En pantallas secundarias con historial previo (`idx > 0`), el botón Atrás retrocede de forma natural. Si el usuario ingresó directamente por notificación push o enlace profundo sin historial (`idx === 0`), se redirige de forma transparente a la vista principal `/` en lugar de cerrar la aplicación.
  - **Historial Completo en `BottomNav`:** La navegación entre pestañas no sobrescribe la pila (`replace: true`), permitiendo al usuario volver sobre sus pasos de forma intuitiva.
- **Manejador de Modales y Sheets (`src/hooks/useModalBackHandler.ts`):**
  - Mantiene una pila global de modales activos (`activeModalStack`) y un contador de cierres programáticos (`programmaticBackCount`).
  - Al abrirse cualquier modal (`TicketFormModal`, `CreateParticipationSheet`, `BarcodeScannerModal`, `ShareInviteModal`, `InviteClaimModal`, `PwaInstallBanner`, `VersionBadge`), empuja un estado `{ modalOpen: true, modalKey }` en el historial y se apila en `activeModalStack`.
  - Al recibir `popstate` por pulsación de 'Atrás' físico, solo el modal situado en la cima de la pila responde y se cierra, protegiendo a los modales padre subyacentes.
  - **Prevención de Cierre en Cascada:** Cuando un modal hijo (ej. `BarcodeScannerModal`) se cierra programáticamente por código (tras escanear con éxito o por UI), incrementa `programmaticBackCount` antes de invocar `window.history.back()`, absorbiendo el evento `popstate` y garantizando que el modal padre (`TicketFormModal`) permanezca abierto con los datos precargados.

### Flujo de Suscripción y Envío
1. El cliente genera una suscripción mediante `PushManager.subscribe()` usando la clave pública VAPID expuesta (`VITE_VAPID_PUBLIC_KEY`).
2. La suscripción (`endpoint`, `p256dh`, `auth`) se persiste en `public.web_push_subscriptions` asociada al usuario autenticado.
3. Al insertarse una notificación en `public.notifications` (por premio, invitación, renuncia o aviso), el trigger PostgreSQL `on_notification_created_send_push` dispara de forma asíncrona no bloqueante (`pg_net` / `net.http_post`) la Edge Function `send-push`.
4. La Edge Function `send-push` recupera las claves VAPID de los secretos del proyecto y despacha la notificación a los dispositivos suscritos con `npm:web-push`, realizando auto-limpieza de suscripciones 404/410.
5. El Service Worker `push-sw.js` (importado por Workbox) intercepta el evento `push`, muestra la alerta con icono de alta resolución y badge monocromo (`/badge-mono.png`), y al pulsar (`notificationclick`) enfoca o abre la PWA navegando a la URL correspondiente.

---

## 4. Captura GS1-128 y Motor de Plantillas de Boletos

### Parser de Códigos de Barras SELAE (`src/lib/selaeBarcodeParser.ts`)
- **Estructura Estándar Oficial Definitiva (20 Dígitos: `2 + 3 + 2 + 3 + 6 + 4`):** Normaliza y decodifica con precisión matemática la secuencia numérica canónica presente en los billetes físicos de Lotería Nacional (Code-128, GS1-128, ITF):

| Segmento | Longitud | Posiciones | Campo decodificado | Ejemplo 1 (`5102607065>0023205830`) | Ejemplo 2 (`51020101100876719833`) |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Prefijo de Juego** | 2 | 0..2 | Prefijo Lotería Nacional | `51` (Navidad/Niño) o `01` | `51` (Navidad/Niño) o `01` |
| **Código Sorteo/Año** | 3 | 2..5 | `drawYearCode` / `drawCode` | `026` (Año 2026) | `020` |
| **Fracción** | 2 | 5..7 | `fraction` / `fraccion` | `07` (Fracción 7ª) | `10` (Fracción 10ª) |
| **Serie** | 3 | 7..10 | `series` / `serie` | `065` (Serie 65ª) | `110` (Serie 110ª) |
| **Número (6 dígitos)** | 6 | 10..16 | `ticketNumber` (`match[4].slice(-5)`) | `002320` → **`02320`** | `087671` → **`87671`** |
| **Control** | 4 | 16..20 | `checkDigits` | `5830` | `9833` |

- **Expresión Regular Canónica:** `/(?:51|01)(\d{3})(\d{2})(\d{3})(\d{6})(\d{4})/` extrayendo el número del décimo como los 5 últimos dígitos del grupo 4 (`match[4].slice(-5)`), la fracción en el grupo 2 y la serie en el grupo 3.
- **Normalización y Resiliencia OCR:** Eliminación previa de cualquier carácter no numérico (`raw.replace(/\D/g, '')`), incluyendo separadores como `>` y prefijos de simbología GS1 (ej. `]C1`), y sustitución de confusiones de caracteres comunes (`O->0`, `I/L->1`, `Z->2`, `S->5`, `B->8`).
- **Compatibilidad de Nombres:** Retorna aliases duales (`number`/`ticketNumber`, `serie`/`series`, `fraccion`/`fraction`, `drawCode`/`drawYearCode`).
- **Seguridad e Integridad:** Ante códigos ajenos a SELAE o no reconocidos, devuelve `isValid: false` y mensaje explicativo en `errorMessage`, sin inventar números ni recurrir a valores hardcoded ficticios.
- **Deducción de Sorteo Próximo:**
  - 1 a 6 de Enero: El Niño del año en curso.
  - 7 de Enero a 22 de Diciembre: Navidad del año en curso.
  - A partir del 23 de Diciembre: El Niño del año siguiente.

### Motor de Renderizado Híbrido (`<RealisticTicketCard />`)
- **Modo Plantilla Oficial (`draw_templates`):** Cuando existe una plantilla oficial registrada en la base de datos con `template_image_url`, superpone dinámicamente el número registrado, serie, fracción, fecha e importe según las coordenadas porcentuales de `overlay_config`.
- **Modo Vectorial Realista:** Si no se dispone de imagen externa, genera una réplica fotorrealista en SVG/CSS del boleto nacional:
  - Trama guilloche geométrica decorativa en verde lotería `#2E6146` y oro `#D97706`.
  - Capilla artística con el sello oficial **MisDecimos · SELLO DIGITAL**.
  - Tipografía matricial monoespaciada emulando la imprenta de la Fábrica Nacional de Moneda y Timbre (FNMT).
  - Código de barras GS1-128 simulado con checksum visible en la base.

---

## 5. Motor de Comprobación Oficial y Edge Function `check-prizes`

### Orígenes de Datos y Motores
1. **Lotería de Navidad (`NAVIDAD`):** Endpoint oficial JSONP de El País (`https://api.elpais.com/ws/LoteriaNavidadPremiados?n={numero}`). Limpieza de prefijo `busqueda=`, conversión de euros a céntimos y estado `provisional` o `final` (`status === 4`).
2. **Sorteo de El Niño (`EL_NINO`):** Endpoint oficial JSONP de El País (`https://api.elpais.com/ws/LoteriaNinoPremiados?n={numero}`).
3. **Sorteos Semanales y Ordinarios (`JUEVES`, `SABADO`, `ESPECIAL`):** API de SELAE con fallback mediante `loteriasapi.com` autenticado por `LOTERIAS_API_KEY`.
4. **Blindaje Defensivo Pre-Sorteo (Hora Peninsular Española CET):**
   - La Edge Function recupera de la base de datos la fecha canónica del sorteo (`draw_date`) y su modalidad (`draw_type`).
   - Calcula el inicio oficial del sorteo en CET (`Europe/Madrid`, UTC+1): 09:00 para `NAVIDAD` y 12:00 para `EL_NINO`.
   - Si `now < drawStart`, devuelve inmediatamente `{ ok: false, code: 'DRAW_NOT_HELD_YET', message: 'El sorteo aún no se ha celebrado...' }` sin mutar el décimo ni registrar auditorías erróneas.
   - Durante la celebración, si la API indica que el sorteo sigue en curso (`error === 1` o `status === 0`), devuelve `{ ok: false, code: 'DRAW_IN_PROGRESS', ... }` sin marcar el billete como `VALIDADO` o sin premio.

### Estrategia de Caché y Persistencia Atómica
- **Caché en Memoria (Edge Runtime):** Map con clave `${drawType}:${number}`. TTL de 24 horas para resultados finales (`listStatus === 'final'`) y 5 minutos para listas provisionales durante la celebración del sorteo.
- **Refresco Forzado (`forceRefresh`):** Bypasea la caché cuando el usuario pulsa *"Comprobar de nuevo"*.
- **Persistencia Transaccional:** La Edge Function invoca la RPC `record_ticket_prize_check` con la cabecera `Authorization` del llamante, garantizando RLS estricto e inserción inmutable de auditoría.
