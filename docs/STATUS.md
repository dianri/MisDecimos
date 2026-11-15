# Panel de Estado del Proyecto — MisDecimos

**Versión Actual:** `0.2.0`  
**Última Actualización:** 2026-11-15  
**Rama Activa:** `develop` (Fase 2 completada y fusionada)    
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

### [ ] Fase 3 (v0.3.0) — Captura de Décimos (GS1-128 / Código de Barras / Manual) y Boleto Realista
- [ ] Escáner con cámara de código de barras GS1-128 / Code 128 (SELAE).
- [ ] Formulario de alta manual con validación de número (5 dígitos), serie y fracción.
- [ ] Visualización de boleto realista interactivo usando `draw_templates` (sin subida pesada de fotos).
- [ ] Donut SVG interactivo del desglose de participaciones en tiempo real.

---

### [ ] Fase 4 (v0.4.0) — Reparto de Participaciones, Códigos de 6 Dígitos e Invitaciones
- [ ] Modal de asignación manual de % y stepper de reparto a partes iguales (2 a 10 partes).
- [ ] Generación de enlaces de invitación y códigos cortos numéricos de 6 dígitos.
- [ ] Flujo de aceptación/rechazo de invitación con vista previa del décimo.
- [ ] Flujo de solicitud y respuesta de renuncia unilateral (`waiver_requested`).

---

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
