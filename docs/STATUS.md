# Panel de Estado del Proyecto — MisDecimos

**Versión Actual:** `0.4.0`  
**Última Actualización:** 2026-11-15  
**Rama Activa:** `develop` (Fase 4 completada)  
**Backend Supabase:** `xmdghpyfrblmtjtevtru`

---

## 🧭 Fases del Proyecto

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

### [ ] Fase 5 (v0.5.0) — Liquidación de Premios, Comprobación SELAE y Auditoría Inmutable

### [ ] Fase 5 (v0.5.0) — Auditoría Inmutable, Comprobación de Sorteos y Liquidación
- [ ] Comprobación automática de premios (Lotería de Navidad, El Niño y LoteriasAPI).
- [ ] Historial inmutable de auditoría por décimo (`audit_events`).
- [ ] Flujo de confirmación de cobro de premios por participante.
- [ ] Cierre automático del décimo al estado `LIQUIDADO` y animación de confeti.

---

### [ ] Fase 6 (v0.6.0) — Web Push Nativo VAPID y Experiencia Offline PWA
- [ ] Integración Web Push VAPID para Android y pantalla de inicio de iOS (PWA standalone).
- [ ] Notificaciones en segundo plano para invitaciones, renuncias y premios.
- [ ] Caché offline de décimos y sincronización resiliente al recuperar red.
