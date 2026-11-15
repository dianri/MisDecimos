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
| `record_ticket_prize_check` | `p_ticket_id, p_prize_amount_cents, p_check_source, p_list_status` | Actualiza el premio del billete, marca estado `VALIDADO` si estaba `PENDIENTE`, registra `PREMIO_COMPROBADO` en auditoría y genera alertas con importes proporcionales a cotitulares. |
| `request_payout_confirmation_reminder` | `p_ticket_id` | Permite enviar un recordatorio formal de cobro (`SOLICITUD_VALIDAR_COBRO`) a participantes pendientes o al propietario. |
| `confirm_prize_received` | `p_ticket_id` | El participante o custodio confirma recepción de su cobro. Si todos los cotitulares activos han confirmado, conmuta el estado del décimo a `LIQUIDADO`. |
| `toggle_archive_ticket` | `p_ticket_id, p_archive` | Gestiona el registro en `ticket_archive_hides` para ocultar o desocultar el décimo en la vista del usuario llamante. |

---

## 3. Arquitectura PWA y Web Push VAPID

### Soporte Multi-Plataforma
- **Android:** Notificaciones Web Push estándar mediante el Service Worker vía Chrome/Edge/Firefox.
- **iOS (16.4+):** Requiere que la aplicación sea instalada en la pantalla de inicio ("Añadir a pantalla de inicio" / PWA standalone) para conceder permisos y suscribirse al Notification API mediante el Service Worker.

### Flujo de Suscripción y Envío
1. El cliente genera una suscripción mediante `PushManager.subscribe()` usando la clave pública VAPID expuesta.
2. La suscripción (`endpoint`, `p256dh`, `auth`) se persiste en `public.web_push_subscriptions` asociada al usuario autenticado.
3. Al dispararse un evento crítico en la base de datos (nueva invitación, renuncia, premio o liquidación), un trigger o llamada a Supabase Edge Function (`supabase/functions/push-notifier`) recupera la clave privada VAPID de Supabase Secrets y despacha la notificación cifrada al Push Service correspondiente (FCM / Mozilla / Apple).
4. El Service Worker `sw.js` recibe el evento `push`, muestra la notificación con iconos de alta resolución y badge monocromo, y redirige a la URL absoluta correspondiente `https://misdecimos.dianrie.com/...`.

---

## 4. Captura GS1-128 y Motor de Plantillas de Boletos

### Parser de Códigos de Barras SELAE (`src/lib/selaeBarcodeParser.ts`)
- **Estructura Decodificada:** Normaliza secuencias numéricas canónicas de 20 a 24 dígitos (Code-128, GS1-128, ITF) presentes en los décimos físicos de Lotería Nacional:
  - Extracción de número de 5 dígitos (`^\d{5}$`).
  - Detección de Serie (3 dígitos) y Fracción (2 dígitos).
  - Normalización ante errores comunes de caracteres alfabéticos (`O->0`, `I/L->1`, `S->5`, `B->8`, `Z->2`).
  - Detección de tipo de sorteo (`NAVIDAD`, `EL_NINO`, `JUEVES`, `SABADO`, `ESPECIAL`) y precio oficial por defecto.

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
4. **Resiliencia ante Sorteos Futuros:** Si la API oficial devuelve error o el sorteo no se ha celebrado, la Edge Function responde con `prizeAmountCents = 0`, `checkSource = 'elpais'` y `listStatus = 'sin_resultados_aun'`.

### Estrategia de Caché y Persistencia Atómica
- **Caché en Memoria (Edge Runtime):** Map con clave `${drawType}:${number}`. TTL de 24 horas para resultados finales (`listStatus === 'final'`) y 5 minutos para listas provisionales durante la celebración del sorteo.
- **Refresco Forzado (`forceRefresh`):** Bypasea la caché cuando el usuario pulsa *"Comprobar de nuevo"*.
- **Persistencia Transaccional:** La Edge Function invoca la RPC `record_ticket_prize_check` con la cabecera `Authorization` del llamante, garantizando RLS estricto e inserción inmutable de auditoría.
