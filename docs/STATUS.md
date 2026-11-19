# Panel de Estado del Proyecto — MisDecimos

**Versión Actual:** `1.0.19` (Producción Estable · Padding Vertical Safe-Area en Cabecera)  
**Última Actualización:** 2026-11-19  
**Rama de Producción:** `main` (Tag `v1.0.19`)  
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
