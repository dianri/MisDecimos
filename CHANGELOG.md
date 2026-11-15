# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [0.5.0] - 2026-11-15

### Added
- **Edge Function `check-prizes` (Deno/TypeScript):**
  - Desplegada y activa en Supabase Cloud con soporte CORS completo.
  - Motores de consulta oficial:
    - Sorteo de Navidad: API pública de El País (`LoteriaNavidadPremiados`), decodificación JSONP, conversión a céntimos y estado de lista (`provisional` / `final`).
    - Sorteo de El Niño: API pública de El País (`LoteriaNinoPremiados`), conversión a céntimos y estado de lista.
    - Sorteos Ordinarios (`JUEVES`, `SABADO`, `ESPECIAL`) y fallback con API key de `loteriasapi.com`.
  - Caché en memoria en el runtime Edge (5 min provisional, 24h final) con opción de refresco forzado (`forceRefresh`).
  - Persistencia atómica mediante invocación de la RPC `record_ticket_prize_check`.
- **Funciones RPC Transaccionales de Liquidación (`20261115000003_prize_check_and_payouts.sql`):**
  - `record_ticket_prize_check`: Actualiza premio en céntimos, estado (`VALIDADO`), fuente oficial, registra evento de auditoría `PREMIO_COMPROBADO` y genera notificaciones automáticas a cotitulares con su parte proporcional exacta.
  - `request_payout_confirmation_reminder`: Recordatorios entre propietarios y participantes para agilizar la liquidación (`SOLICITUD_VALIDAR_COBRO` en auditoría y alertas).
  - `confirm_prize_received`: Permite a cotitulares y custodios marcar su cobro (`COBRO_PREMIO_CONFIRMADO`), transitando automáticamente a `LIQUIDADO` y registrando `DECIMO_LIQUIDADO` cuando todos han cobrado.
- **Tarjeta de Comprobación Oficial (`<PrizeCheckCard />`):**
  - Botón destacado dorado/ámbar ("Comprobar premio" / "Comprobar de nuevo") con spinner de consulta en tiempo real.
  - Recuadro de resultado:
    - Sin premio: Mensaje claro con atribución oficial y aviso de verificación en `loteriasyapuestas.es`.
    - Premiado: Tarjeta verde esmeralda con icono `Trophy`, premio total del décimo, desglose proporcional de cuota para el usuario autenticado y aviso legal.
    - Flujo de cobro interactivo: Botón "He recibido mi premio" para participantes, botón "Marcar premio como cobrado" para propietarios del 100%, o envío de recordatorios de cobro.
    - Sello de trazabilidad completa cuando el décimo alcanza el estado `LIQUIDADO`.
- **Integración en Cuadro de Propiedad e Historial:**
  - `<OwnershipBreakdownCard />`: Desglose del premio en euros por cotitular y badges `COBRO CONFIRMADO` / `PENDIENTE DE COBRO`.
  - `<TicketAuditTimeline />`: Nuevos eventos `PREMIO_COMPROBADO`, `SOLICITUD_VALIDAR_COBRO`, `COBRO_PREMIO_CONFIRMADO` y `DECIMO_LIQUIDADO`.
- **Servicio Frontend de Premios (`src/services/prizeService.ts`):** Invocación tipada de `check-prizes`.

## [0.4.0] - 2026-11-15

### Added
- **Cuadro de Propiedad y Gráfico Donut Interactivo (`<OwnershipBreakdownCard />`):**
  - Anillo SVG interactivo con proporciones matemáticas exactas y transiciones suaves, visualizando el reparto del 100%: Verde Lotería (`#2E6146`) para el propietario, Azules (`#1D4ED8`, `#2563EB`) para cotitulares con cuota aceptada y Ámbar discontinuo (`#D97706`) para invitaciones pendientes.
  - Tarjeta destacada de Propietario (`bg-[#EAF3EE]`, borde y acento verde `#2E6146`, avatar, cuota y custodia física).
  - Tarjetas de cotitulares con cuota aceptada, avatar, porcentaje y menú de opciones para solicitar renuncia formal.
  - Lista de invitaciones pendientes con código de 6 dígitos, acceso directo a ver QR/compartir y botón de cancelación para recuperar cuota al instante.
  - Botón dinámico inferior "Añadir participación" que muestra el porcentaje disponible del propietario.
- **Creación de Participaciones y Reparto a Partes Iguales (`<CreateParticipationSheet />`):**
  - Modal Bottom Sheet con pestañas "Porcentaje manual" y "Partes iguales":
    - Modo manual: Slider interactivo (1% al porcentaje disponible), presets rápidos (+10%, +20%, +25%, +50%), entrada numérica con clamp, campo opcional de etiqueta ("Para Carlos", "Hermano") y llamada transaccional a `create_manual_participation`.
    - Modo partes iguales: Selector numérico (stepper 2 a 10 participantes), interruptor "El propietario participa en el reparto", y previsualización matemática en tiempo real con absorción de redondeo por el custodio para garantizar 0% huérfano (`create_equal_split_participations`).
- **Invitaciones QR y Códigos de 6 Dígitos (`<ShareInviteModal />`):**
  - Modal con código alfanumérico destacado de 6 dígitos (`short_code`), renderizado de código QR dinámico mediante `qrcode.react`, botón de copia al portapapeles y compartición nativa en WhatsApp (`https://wa.me/?text=...`) o Web Share API.
- **Aceptación y Rechazo de Participaciones (`<InviteClaimModal />`):**
  - Modal para reclamar o descartar participaciones con vista detallada de boleto y porcentaje.
  - Botón de "Rechazar participación" conectado a la RPC `reject_pending_invite` que devuelve inmediatamente el porcentaje al propietario del décimo.
- **Flujo Bilateral de Renuncia de Participaciones:**
  - Prohibición estricta de revocación unilateral: el propietario solicita renuncia mediante `request_share_waiver`.
  - El cotitular visualiza una alerta destacada en su tarjeta con opciones de "Aceptar y devolver cuota" (`respond_share_waiver(..., true)`) o "Rechazar solicitud" (`respond_share_waiver(..., false)`).
- **Línea de Tiempo de Auditoría Detallada (`<TicketAuditTimeline />`):**
  - Vista cronológica inmutable con línea continua vertical de eventos con iconos diferenciados y colores según acción (`DECIMO_CREADO`, `ESCANEO_CODIGO_BARRAS`, `PARTICIPACION_CREADA`, `REPARTO_IGUALITARIO`, `INVITACION_ENVIADA`, `PARTICIPACION_ACEPTADA`, `PARTICIPACION_RECHAZADA`, `SOLICITUD_RENUNCIA_ENVIADA`, `SOLICITUD_RENUNCIA_ACEPTADA`, `SOLICITUD_RENUNCIA_RECHAZADA`, `PARTICIPACION_CANCELADA`, `PREMIO_COMPROBADO`, `PREMIO_COBRADO_CONFIRMADO`).
  - Desglose de porcentaje asociado, usuario que ejecutó la acción, fecha/hora completa y metadatos formateados.

## [0.3.0] - 2026-11-15

### Added
- **Escáner Multimodal y Parser GS1-128 de SELAE:**
  - Módulo `src/lib/selaeBarcodeParser.ts` capaz de decodificar códigos de barras oficiales de Lotería Nacional (Code-128, GS1-128, ITF), extrayendo número de 5 cifras, serie, fracción, fecha y tipo de sorteo con normalización de caracteres OCR.
  - Componente `<BarcodeScannerModal />` con soporte de cámara trasera (`facingMode: 'environment'`), guía láser animada (horizontal para décimos o cuadrada para invitaciones) y opción alternativa de subida de imagen vía `html5-qrcode`.
  - Modal de alta y edición `<TicketFormModal />` sincronizado con la función RPC transaccional `create_ticket` con origen `BARCODE_GS1` o `MANUAL`.
- **Componente de Boleto Realista (`<RealisticTicketCard />`):**
  - Renderizado híbrido: superposición dinámica sobre plantillas maestras (`draw_templates`) o diseño vectorial fotorrealista de billete de Lotería Nacional con trama guilloche, sello digital MisDecimos y tipografía de imprenta nacional.
  - Variantes `full` y `compact`.
- **Dashboard Principal "Mis Billetes Compartidos" (`TicketsPage.tsx`):**
  - Tarjeta resumen con conteo de billetes activos, acumulado de premios ganados por cuota en euros y acceso directo a alertas con badge.
  - Botones de acción rápida: "Añadir décimo", "Tengo un código" y "Escanear QR de invitación".
  - Auto-procesamiento de invitaciones pendientes tras login o deep-links (`sessionStorage.getItem('pending_invite_token')`).
  - Filtrado por pestañas: `Décimos` (propios), `Participaciones` (de terceros, con estado vacío de diseño original) y `Archivados`.
  - Tarjetas de billete `<TicketListItemCard />` con número en ámbar `#D97706`, serie, fracción, sorteo, premio y cuota del usuario.
- **Detalle del Décimo (`TicketDetailPage.tsx`):**
  - Vista completa con `<RealisticTicketCard variant="full" />`, origen de registro y fecha de sorteo.
  - Botón de archivar/desarchivar (`toggle_archive_ticket`) y eliminación segura si no existen cotitulares de terceros.
  - Bloqueo de seguridad con aviso informativo cuando el décimo cuenta con participaciones aceptadas.
  - Pestañas `PROPIEDAD` (desglose de cotitulares) e `HISTORIAL` (auditoría cronológica).

## [0.2.0] - 2026-11-15

### Added
- **Autenticación sin Contraseña (OTP por Email):**
  - Pantalla `LoginPage` con flujo en dos pasos: solicitud de código a email y verificación de 6 dígitos con soporte de pegado rápido, cuenta atrás de 60s y cambio de correo.
  - `AuthContext` con persistencia de deep-links de invitación en `sessionStorage` (`pending_invite_token`) para auto-reclamar tras autenticarse.
- **App Shell Mobile-First y Navegación:**
  - Componente `AppShell` con cabecera superior (email y logout) y `BottomNav` fija con 4 pestañas: Billetes, Alertas (con badge/contador en tiempo real), Auditoría y Perfil.
  - Páginas funcionales `TicketsPage`, `AlertsPage` (con marcado de leídas y suscripción Realtime) y `AuditPage`.
  - Reubicación ergonómica de `<VersionBadge />` flotante sobre la barra inferior sin obstruir la navegación.
- **Perfil de Usuario y Almacenamiento de Avatares:**
  - Migración `20261115000002_storage_avatars_bucket.sql`: bucket público `avatars` con límite de 2MB y RLS estricto por carpeta de usuario.
  - Subida de foto de perfil con compresión y redimensionado en cliente vía `<canvas>` a WebP (calidad 0.85, máx 512x512px) y cache-busting en `public.profiles`.
  - Formulario de edición con validación y sanitización de texto (`display_name`, `phone`).
- **PWA y Web Push Nativo:**
  - Servicio `pushSubscription.ts` para suscripción y desuscripción VAPID con persistencia en `public.web_push_subscriptions` y actualización de `public.profiles.push_enabled`.
  - Interruptor reactivo en el perfil para activar/desactivar notificaciones push y visualización del estado de permiso del navegador.
  - Componente `<PwaInstallBanner />` con captura de `beforeinstallprompt` (Android/Desktop) y guía contextual para Safari en iOS ("Compartir" -> "Añadir a pantalla de inicio").
- **Seguridad y Sanitización:**
  - Módulo `src/lib/sanitize.ts` con `sanitizeText` (limpieza de HTML, scripts y espacios) y `safeImageUrl` (validación de URLs HTTPS seguras).

## [0.1.0] - 2026-11-15

### Added
- **Gobernanza y Workflows:**
  - `AGENTS.md` con principios de desarrollo, Git Flow estricto, reglas de concurrencia y control de versiones anti-caché.
  - Workflows en `.agent/workflows/` (`start-feature.md` y `finish-feature.md`).
  - Documentación de arquitectura (`docs/ARCHITECTURE.md`), reglas de negocio (`docs/BUSINESS_RULES.md`) y panel de control (`docs/STATUS.md`).
- **Base de Datos y RPCs (Supabase `xmdghpyfrblmtjtevtru`):**
  - Esquema inicial con RLS completo para 9 tablas: `profiles`, `draw_templates`, `tickets`, `ownership_shares`, `pending_invites`, `ticket_archive_hides`, `audit_events`, `notifications`, `web_push_subscriptions`.
  - Trigger automático `on_auth_user_created` para creación de perfiles.
  - Semillas para plantillas de boletos de Lotería de Navidad y El Niño (2025 y 2026).
  - 10 funciones RPC transaccionales `SECURITY DEFINER` para gestión atómica de décimos, cálculo y cesión de porcentajes, códigos de 6 dígitos, renuncias y confirmación de cobros.
  - Canales Realtime habilitados en `notifications`, `ownership_shares`, `pending_invites` y `tickets`.
- **Frontend PWA y Control de Versión:**
  - Configuración base React 18 + Vite + TypeScript + Tailwind CSS con paleta Verde Lotería (`#2E6146`), Fondo Crema (`#F7F9F7`) y Ámbar (`#D97706`).
  - Configuración de `vite-plugin-pwa` con soporte offline y manifiesto web.
  - Componente `<VersionBadge />` flotante con indicador de red, diagnóstico de build, botón de purga de Service Worker y aviso de actualización automática.
  - Integración del cliente Supabase en `src/lib/supabase.ts` y tipos sincronizados en `src/types/database.types.ts`.
