# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
