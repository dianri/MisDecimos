# Panel de Estado del Proyecto — MisDecimos

**Versión Actual:** `1.0.38` (Producción Estable · Parser Oficial SELAE 20 Dígitos y Autodetección de Sorteo y Fecha)  
**Última Actualización:** 2026-11-19  
**Rama de Producción:** `main` (Tag `v1.0.38`)  
**Rama Activa de Desarrollo:** `develop`  
**Backend Supabase:** `xmdghpyfrblmtjtevtru`

---

## 🧭 Fases del Proyecto — Estado General de Entrega

### [x] Fase 1 (v0.1.0) — Cimientos, Gobernanza y Esquema Central
- [x] Ramas base Git Flow (`main`, `develop`) y workflow multi-agente (`AGENTS.md`).
- [x] Workflows de Antigravity en `.agent/workflows/`.
- [x] Documentación de Arquitectura, Estado y Reglas de Negocio en `/docs`.
- [x] Migración SQL inicial (`20261115000001_init_misdecimos_schema.sql`):
  - [x] Tablas: `profiles`, `draw_templates`, `tickets`, `ownership_shares`, `pending_invites`, `ticket_archive_hides`, `audit_events`, `notifications`, `web_push_subscriptions`.
  - [x] Triggers automáticos (creación de perfil al autenticar con OTP).
  - [x] Políticas RLS estrictas para todas las tablas.
  - [x] Funciones RPC transaccionales `SECURITY DEFINER` (creación de décimos, reparto igualitario, gestión de invitaciones, renuncias y confirmación de premios).
  - [x] Publicaciones Realtime activadas.
- [x] Configuración frontend React + Vite + TypeScript + Tailwind CSS.
- [x] PWA configurada con `vite-plugin-pwa` y manifiesto completo.
- [x] Componente `<VersionBadge />` anti-caché con control de SW y purga en 1 clic.
- [x] Cliente Supabase en `src/lib/supabase.ts` y tipos generados en `src/types/database.types.ts`.

---

### [x] Fase 2 (v0.2.0) — Autenticación OTP y Gestión de Perfil
- [x] Flujo de login sin contraseña por Email OTP vía Supabase Auth con deep-link de invitación.
- [x] App Shell Mobile-First con cabecera y BottomNav de 4 pestañas (Billetes, Alertas con badge en tiempo real, Auditoría, Perfil).
- [x] Módulo de sanitización de entradas (`sanitizeText`, `safeImageUrl`).
- [x] Migración del bucket `avatars` en Supabase Storage con RLS por usuario.
- [x] Pantalla de perfil de usuario con avatar circular, compresión WebP en cliente y subida a bucket `avatars`.
- [x] Gestión de suscripción Web Push nativa y banner de instalación PWA (Android / iOS).

---

### [x] Fase 3 (v0.3.0) — Captura de Décimos (GS1-128 / Código de Barras / Manual) y Boleto Realista
- [x] Parser de código de barras GS1-128 / Code-128 de SELAE (`selaeBarcodeParser.ts`).
- [x] Modal de escáner multimodal con cámara y subida de imagen (`html5-qrcode`).
- [x] Modal de alta manual y sincronización con `create_ticket` RPC.
- [x] Componente de boleto digital realista `<RealisticTicketCard />` con plantillas oficiales y guilloche.
- [x] Dashboard principal `Mis Billetes Compartidos` con filtrado por pestañas y deep-link de invitación.
- [x] Vista de detalle del décimo `TicketDetailPage` con estado, auditoría y bloqueo de seguridad.

---

### [x] Fase 4 (v0.4.0) — Reparto de Participaciones, Códigos de 6 Dígitos e Invitaciones
- [x] Cuadro de propiedad interactivo y gráfico Donut SVG (`OwnershipBreakdownCard.tsx`).
- [x] Bottom Sheet `Nueva participación` con modos Porcentaje Manual y Partes Iguales (`CreateParticipationSheet.tsx`).
- [x] Modal de invitación con código de 6 dígitos, QR dinámico y compartir por WhatsApp (`ShareInviteModal.tsx`).
- [x] Modal de reclamo y rechazo de invitaciones pendientes (`reject_pending_invite` en `<InviteClaimModal />`).
- [x] Flujo bilateral estricto de solicitud y respuesta de renuncia de cotitulares (`waiver_requested`, `request_share_waiver`, `respond_share_waiver`).
- [x] Cancelación de invitaciones pendientes por el propietario (`cancel_pending_invite`) con devolución íntegra de cuota.
- [x] Línea temporal enriquecida de auditoría del décimo con iconos, badges y metadatos (`TicketAuditTimeline.tsx`).

---

### [x] Fase 5 (v0.5.0) — Liquidación de Premios, Comprobación SELAE y Auditoría Inmutable
- [x] Migración RPC de comprobación (`record_ticket_prize_check`), recordatorios (`request_payout_confirmation_reminder`) y liquidación (`confirm_prize_received`).
- [x] Edge Function `check-prizes` desplegada y activa con motores El País (Navidad/Niño) y fallback Loterías API.
- [x] Tarjeta de comprobación `<PrizeCheckCard />` con botón de búsqueda, desglose proporcional de premio y nota legal.
- [x] Flujo de confirmación de cobro ("He recibido mi premio") para cotitulares y propietarios.
- [x] Estado `LIQUIDADO` del décimo tras cobro unánime de todos los participantes.
- [x] Visualización de premios y estados de cobro en `<OwnershipBreakdownCard />` y línea temporal `<TicketAuditTimeline />`.

---

### [x] Fase 6 (v0.6.0) — Notificaciones Push en Background, Automatización y QA End-to-End
- [x] Generación de claves VAPID y configuración de secretos en Supabase (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- [x] Service Worker con soporte nativo para eventos `push` y `notificationclick` (`public/push-sw.js`).
- [x] Edge Function `send-push` desplegada con `npm:web-push`, soporte para pruebas y auto-limpieza 404/410.
- [x] Trigger PostgreSQL no bloqueante en `public.notifications` con extensión `pg_net`.
- [x] RPC `mark_all_notifications_read` para marcado masivo de alertas leídas.
- [x] Pantalla `Mis Notificaciones` con diseño fiel, marcas temporales `HH:mm - DD/MM` y acciones de renuncia directa.
- [x] Pantalla `Auditoría` global con buscador en tiempo real, chips de categoría y marco educativo de las 4 reglas.

---

### 🚀 Release de Producción (v1.0.0 a v1.0.11)
- [x] Configuración de enrutado SPA y cabeceras anti-caché en `vercel.json`.
- [x] Metaetiquetas móviles PWA completas en `index.html`.
- [x] v1.0.1: Chunks manuales de Rollup, versión dinámica y retry de OTP email/signup.
- [x] v1.0.2: RLS sin recursión infinita en PostgreSQL y corrección de "Décimo no encontrado.".
- [x] v1.0.3: Manual de Pantallas (`docs/SCREENS_GUIDE.md`) e índices de navegación rápida en `README.md`.
- [x] v1.0.4: Fallback reactivo anti-imagen rota en `RealisticTicketCard.tsx` y plantillas vectoriales.
- [x] v1.0.5: Sorteos exclusivos oficiales (Navidad y El Niño) y parser GS1-128 sincronizado.
- [x] v1.0.6: Cancelación de invitaciones pendientes no reclamadas en décimos validados (`cancel_all_pending_invites`).
- [x] v1.0.7: Pestaña "Partes iguales" como primera opción por defecto (100% libre) y valor inicial 20% manual.
- [x] v1.0.8: Ciclo de vida PWA en modo `autoUpdate` silencioso sin banner flotante ni clics manuales.
- [x] v1.0.9: Botón cuadrado de acceso directo a la cámara para escanear décimos en el Dashboard.
- [x] v1.0.10: Jerarquía `z-index` de `BottomNav` (`z-30`) y modales con `max-h-[88dvh]`, scroll interno y pie fijo `env(safe-area-inset-bottom)`.
- [x] v1.0.11: Botón ergonómico de cámara en verde sólido con icono blanco (54px) y menú contextual flotante desbloqueado (`z-30`/`z-40`).
- [x] v1.0.12: Bloqueo de comprobación previa al sorteo (hora peninsular española), tarjeta informativa `CalendarClock`, defensiva en Edge Function (`DRAW_NOT_HELD_YET`) y reseteo a `PENDIENTE` en BD.
- [x] v1.0.13: Navegación Atrás nativa Android en PWA, centinela `exitGuard`, toast de confirmación (2,5s), hook `useModalBackHandler` y conservación de historial en `BottomNav`.
- [x] v1.0.14: Renuncia voluntaria de participaciones por el cotitular (`renounce_own_participation`), modal de confirmación `z-50`, reintegro íntegro al propietario y auditoría `RENUNCIA_VOLUNTARIA_PARTICIPANTE`.
- [x] v1.0.15: Onboarding inteligente de notificaciones push (`usePushPermissionPrompt`), disparadores (onboarding y alertas sin leer), límite de 3 cancelaciones, modal accesible `PushPermissionModal` y aviso de gestión en Perfil.
- [x] v1.0.16: Prompter e instalador PWA multiplataforma guiado (`usePwaInstallPrompt`, `PwaInstallBannerModal`), compatibilidad Chromium, iOS/iPadOS y macOS Safari con límite de 3 avisos.
- [x] v1.0.17: Corrección de offset en extracción de número del código de barras SELAE (`selaeBarcodeParser.ts`).
- [x] v1.0.18: Prevención de cierre en cascada por `popstate` (`useModalBackHandler`) y handoff inmediato del escáner al formulario con datos precargados.
- [x] v1.0.19: Corrección de padding vertical superior y `safe-area` en la cabecera (`AppShell.tsx`), garantizando 14 px de aire vertical en escritorio y móviles sin notch.
- [x] v1.0.20: Desglose canónico oficial de 20 dígitos en código de barras SELAE (`2 + 3 + 2 + 3 + 6 + 4`) con soporte para separadores y prefijos GS1.
- [x] v1.0.21: Exclusión de participaciones renunciadas (`status = 'RENUNCIADA'` o `percentage <= 0`) en el conteo de billetes activos, sumatorio de premios y pestañas de la interfaz (`ticketMetrics.ts`).
- [x] v1.0.22: Privacidad estricta de invitaciones pendientes (`pending_invites`): restricción de RLS a propietario y receptor aceptado, ocultación completa en UI para cotitulares y porcentaje agregado neutro en Donut/leyenda.
- [x] v1.0.23: Detección avanzada de PWA instalada (`getInstalledRelatedApps`, `id: /`), supresión de guía redundante en Chromium sin `deferredPrompt`, botón unificado de descarte permanente (`misdecimos_pwa_prompt_dismissed`), feedback instantáneo (0 ms) y cierre inmediato al reclamar participaciones (`InviteClaimModal.tsx`).
- [x] v1.0.24: Escáner unificado y polimórfico inteligente (`scanPayloadClassifier.ts`): detección automática de códigos de barras SELAE (décimos) y códigos QR (invitaciones) con redirección al flujo adecuado.
- [x] v1.0.25: Estabilización de ciclo de vida del escáner (`BarcodeScannerModal.tsx`): desacoplamiento de dependencias volátiles con refs, auto-reanudación tras segundo plano en Android y liberación garantizada de `MediaStreamTrack`.
- [x] v1.0.26: Bloque de usuario interactivo en cabecera (`AppShell.tsx`): acceso directo a `/perfil` pulsando el avatar, nombre o email.
- [x] v1.0.27: Eliminación del subtítulo redundante *"MisDecimos · Trazabilidad Asegurada"* en la cabecera del dashboard principal (`TicketsPage.tsx`).
- [x] v1.0.28: Selector dual cámara/galería con Bottom Sheet en la pantalla de perfil (`ProfilePage.tsx`) y opción de eliminar avatar.
- [x] v1.0.29: Centralización de cierre de sesión en `ProfilePage.tsx` y eliminación del botón «Salir» de la cabecera superior.
- [x] v1.0.30: Supresión del botón duplicado de campana de alertas en la tarjeta de billetes compartidos (`TicketsPage.tsx`).
- [x] v1.0.31: Navegación adaptativa híbrida en escritorio (`md:flex` en `<header>`) y móvil (`md:hidden` en barra inferior).
- [x] v1.0.32: Simplificación de la navegación principal a dos secciones (**Billetes** y **Alertas**), indicador activo en el avatar de cabecera y reubicación de **Auditoría** dentro de la pantalla de **Perfil** con retorno directo.
- [x] v1.0.33: Reparación integral del pipeline de entrega Web Push en Android: autenticación en trigger `pg_net` para evitar HTTP 401 en Supabase Kong, sincronización silenciosa de suscripciones al iniciar sesión en `AppShell.tsx`, blindaje de `push-sw.js`, feedback verídico sin falsos positivos en `ProfilePage.tsx` y despliegue de `send-push` v2.
- [x] v1.0.34: Gráfico circular segmentado de alta precisión (`OwnershipBreakdownCard.tsx` y `ownershipSegments.ts`): anillo de 50 segmentos radiales discretos distribuidos uniformemente cada 7,2° sin solapamiento de trazos naranjas, con asignación continua y excluyente por cuotas (verde Propietario, azul Cotitulares, naranja Pendientes y gris Disponible).
- [x] v1.0.35: Deep-linking directo al décimo desde Web Push en Android: inclusión de `ticket_id`, `notification_id` y ruta canónica `/billetes/:id` en trigger y Edge Function `send-push` (v3), soporte multiventana y arranque en frío en `push-sw.js`, listener de mensajes y marcado silencioso de lectura en `AppShell.tsx`, y resolución universal de alias en `useAndroidBackNavigation.ts`.
- [x] v1.0.36: Preservación de pestaña activa al retroceder desde el detalle de un décimo: sincronización en URL (`?tab=participaciones` y `?tab=archivados`) con `useSearchParams`, persistencia sin contaminar el historial (`{ replace: true }`), respaldo explícito `state: { fromTab: activeTab }` al abrir billetes y retorno unificado `handleBack` en `TicketDetailPage` (respetando la pestaña previa con historial `idx > 0` o derivando a `participaciones` en accesos directos de cotitulares).
- [x] v1.0.37: Gráfico circular Donut SVG sólido (`OwnershipBreakdownCard.tsx` y `ownershipSegments.ts`): arcos continuos de alta precisión (`viewBox="0 0 160 160"`, `r = 62`, `strokeWidth = 15`) sin solapamientos, con círculo base gris para disponible y arcos proporcionales acumulados para Propietario (`#2E6146`), Cotitulares (`#2563EB`) y Pendientes (`#D97706`) con animación `duration-500`.
- [x] v1.0.38: Parser oficial SELAE de 20 dígitos canónicos (`1 + 3 + 1 + 2 + 3 + 6 + 4`) con expresión regular `/(?:01)?5(\d{3})(\d{1})(\d{2})(\d{3})(\d{6})(\d{4})/`, autodetección de tipo de sorteo (`102` Navidad, `002` El Niño) y fecha (`YYYY-12-22`, `YYYY-01-06`), resolución de fallo en billetes de El Niño (`5002...`), sincronización con `TicketFormModal.tsx` preservando fechas leídas sin sobrescritura y suite de pruebas unitarias con décimos reales de producción.
