# Panel de Estado del Proyecto — MisDecimos

**Versión Actual:** `1.0.115` (Producción Estable · Guardia Automática de Documentación)  
**Última Actualización:** 2026-11-28  
**Rama de Producción:** `main` (Tag `v1.0.115`)  
**Rama Activa de Desarrollo:** `develop`  
**Backend Supabase:** `xmdghpyfrblmtjtevtru`

> Para el historial detallado versión por versión, consultar [CHANGELOG.md](../CHANGELOG.md).

---

## 🧭 Fases del Proyecto — Resumen de Entregas

- [x] **Fase 1 (v0.1.0) — Cimientos, Gobernanza y Esquema Central:** Git Flow estricto, esquema inicial PostgreSQL con RLS y RPCs `SECURITY DEFINER`, Realtime, PWA (`vite-plugin-pwa`) y `<VersionBadge />` anti-caché.
- [x] **Fase 2 (v0.2.0) — Autenticación OTP y Gestión de Perfil:** Login sin contraseña por Email OTP, shell Mobile-First, sanitización (`sanitizeText`, `safeImageUrl`), bucket `avatars` (WebP) y soporte Web Push VAPID.
- [x] **Fase 3 (v0.3.0) — Captura de Décimos y Boleto Realista:** Parser GS1-128 / Code-128 SELAE (`selaeBarcodeParser.ts`), escáner multimodal (`html5-qrcode`), `<RealisticTicketCard />`, dashboard y detalle de décimo.
- [x] **Fase 4 (v0.4.0) — Reparto de Participaciones e Invitaciones:** Gráfico Donut SVG (`OwnershipBreakdownCard.tsx`), reparto manual o a partes iguales (`CreateParticipationSheet.tsx`), códigos de 6 dígitos, QR/WhatsApp (`ShareInviteModal.tsx`), canje/rechazo y flujos de renuncia.
- [x] **Fase 5 (v0.5.0) — Liquidación de Premios y Escrutinio SELAE:** Edge Function `check-prizes` con motor histórico 2020–2025, `<PrizeCheckCard />`, confirmación de cobro, estado `LIQUIDADO` y auditoría inmutable.
- [x] **Fase 6 (v0.6.0) — Web Push en Background y Auditoría Global:** Service Worker (`push-sw.js`), Edge Function `send-push`, trigger `pg_net` en `notifications`, bandeja `AlertsPage.tsx` y centro `AuditPage.tsx`.
- [x] **Fase 7 (v1.0.0 a v1.0.115) — Evolución de Producto, Sistema Visual OLED y Certificación Legal:**
  - Navegación unificada de 3 pestañas (`Décimos`, `Premios`, `Alertas`), identidad visual **4 MILLS** y sistema OLED *Titanio, Oro Cava y Verde Granito*.
  - Pantalla dedicada de premios (`PrizesPage.tsx`, `PrizesHeroCard.tsx`), gestos swipe en tarjetas y archivado en `ProfilePage.tsx`.
  - Módulo completo de **Certificación Legal** (`LegalCertificationTab.tsx`, `CertificateSignModal.tsx`, `SignaturePadCanvas.tsx`, `TicketPhotoCaptureModal.tsx`): prueba gráfica compartida `SHA-256`, firma electrónica con **AutoFirma** (vía `autofirma-relay`) o `.p12`/`.pfx`, firma manuscrita sin teléfono, aislamiento estricto por `participation_id`, blindaje SQL de renuncias (`trg_guard_signed_participation_renounce`) y PDF legal unificado (`legalPdfGenerator.ts`).
  - Sincronización integral de documentación (`SCREENS_GUIDE.md`, `BUSINESS_RULES.md`, `ARCHITECTURE.md`, `README.md`, `AGENTS.md`) y guardia automática de documentación en tests unitarios (`docsSync.test.ts`).

---

## 📋 Backlog / Pendientes Actuales

- Sin bloqueantes abiertos en producción (`v1.0.115`).
- Mantenimiento continuo de cobertura unitaria pura (`npm test`) y sincronización documental automática en cada PR/merge hacia `develop`.
