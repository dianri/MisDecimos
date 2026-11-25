# Panel de Estado del Proyecto — MisDecimos

**Versión Actual:** `1.0.75` (Producción Estable · Píldora de Versión Exclusiva en Mi Perfil)  
**Última Actualización:** 2026-11-25  
**Rama de Producción:** `main` (Tag `v1.0.75`)  
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
- [x] v1.0.39: Cabecera superior adaptativa en escritorio (`>= 768px`): logotipo corporativo y marca **MisDecimos** a la izquierda enlazando a inicio (`/`), menú de navegación (**Billetes** y **Alertas**) y perfil de usuario compacto a la derecha separados por divisor sutil, preservando sin cambios la disposición móvil (`< 768px`).
- [x] v1.0.40: Validación estricta de año y gestión de históricos en el comprobador de premios (`check-prizes` v4): eliminación del falso positivo "sorteo en curso" en billetes de años anteriores (ej. 2020), código específico `HISTORICAL_UNAVAILABLE` con aviso informativo neutro en gris pizarra, tarjeta clara *"Sin premio en el sorteo oficial del DD/MM/AAAA"*, paso explícito de `drawDate` en `prizeService.ts` y suite de tests unitarios (`prizeCheckerValidation.test.ts`).
- [x] v1.0.41: Flujo completo de premios, simulación controlada y trazabilidad transaccional (`check-prizes` v5, `prizeService.ts`, `TicketDetailPage.tsx`, `OwnershipBreakdownCard.tsx`, RPC `reset_ticket_prize_simulation`): soporte para simular premios oficiales, cálculo transaccional de cuotas con RPC `record_ticket_prize_check`, registro inmutable `PREMIO_REGISTRADO` en auditoría, notificaciones push a cotitulares, panel de diagnóstico para custodio y reparto proporcional en euros.
- [x] v1.0.42: Diseño visual celebratorio para décimos premiados en el listado (`TicketListItemCard.tsx`, `ticketCardHelper.ts`, `TicketsPage.tsx`): fondo degradado dorado/esmeralda, borde acentuado con halo suave, badge dinámico **`¡PREMIADO!`** (o **`LIQUIDADO`**), recuadro con importe del usuario y premio total del billete, aplicado coherentemente en Décimos, Participaciones y Archivados.
- [x] v1.0.43: Flujo de solicitud y confirmación de cobro de premios (`OwnershipBreakdownCard.tsx`, `prizePayoutHelper.ts`, RPCs `request_prize_payout_confirmation` y `confirm_prize_payout_received`): recuperación del menú de tres puntos para el custodio con *"Solicitar confirmación de cobro"*, banner en espera de confirmación, botón destacado con un toque para que el cotitular confirme cobro recibido y liquidación automática de décimos íntegramente pagados.
- [x] v1.0.44: Unificación estética de la cabecera superior en móvil y escritorio (`AppShell.tsx`): logotipo e isotipo corporativo de **MisDecimos** en la esquina superior izquierda como enlace interactivo directo al inicio (`/`), y acceso al perfil de usuario reubicado en la esquina superior derecha en formato compacto (avatar de 32 px + nombre hasta 110 px sin email para evitar colisiones en pantallas estrechas), manteniendo la navegación por pestañas móvil en la barra inferior.
- [x] v1.0.45: Modernización integral de la identidad visual y assets de marca (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon.svg`, `masked-icon.svg`, `badge-mono.png`): adopción del nuevo emblema de orfebrería con medallón dorado, boleto troquelado en 'D' y estrella náutica en relieve 3D sobre squircle verde esmeralda superelíptico (`n = 4.70`), integración directa en la cabecera (`AppShell.tsx`) y pantalla de login (`LoginPage.tsx`), precaché Service Worker enriquecida a 24 elementos y soporte multiplataforma garantizado sin artefactos en iOS ni Android.
- [x] v1.0.46: Captura global de `beforeinstallprompt` y fiabilidad del instalador PWA (`src/main.tsx`, `usePwaInstall.ts`, `ProfilePage.tsx`): captura inmediata desde el arranque en `window.__deferredPwaPrompt`, erradicación del falso positivo standalone por flags obsoletos en `localStorage`, visualización permanente del botón de instalación en la tarjeta de perfil cuando la app no esté en modo nativo con lanzamiento nativo a un toque (`prompt()`) o fallback a modal guiado adaptado (Android, iOS y Escritorio), y estandarización de `purpose: 'any'` y `purpose: 'maskable'` en el manifiesto PWA.
- [x] v1.0.47: Armonización visual del aviso de histórico no disponible (`PrizeCheckCard.tsx`): sustitución del recuadro neutro en gris pizarra por el estilo de aviso corporativo en degradado ámbar/naranja (`bg-amber-50/90 border-amber-300/80`), icono `CalendarOff` dentro de caja suave `bg-amber-100 text-amber-600` y tipografía jerárquica (`text-amber-950` y `text-amber-900/90`), alineando estéticamente todos los banners informativos de la aplicación.
- [x] v1.0.48: Compartición por WhatsApp con Unicode seguro y respaldo en escritorio (`src/lib/shareHelper.ts`, `ShareInviteModal.tsx`): erradicación de caracteres corruptos (`\uFFFD`) mediante escapes Unicode seguros (`\u{1F3AB}`, `\u{1F511}`, `\u{1F449}`), codificación URI limpia, copia preventiva automática del mensaje completo al portapapeles al pulsar "Enviar por WhatsApp", banner contextual informativo para WhatsApp Escritorio (macOS/Windows) para permitir pegado con ⌘V/Ctrl+V, y suite de tests unitarios (`whatsappShare.test.ts`).
- [x] v1.0.49: Flujo unificado de reclamación de participaciones y navegación contextual (`src/services/inviteService.ts`, `InvitePage.tsx`, `TicketsPage.tsx`, `TicketDetailPage.tsx`): retorno garantizado de `ticket_id` en todos los flujos de aceptación (enlace `/invite/:id`, código PIN de 6 dígitos o escáner QR), reemplazo automático del historial a `/?tab=participaciones`, navegación inmediata a la ficha del billete reclamado (`/billetes/:id`) con banner de confirmación superior, y retorno blindado (botón Atrás UI y Android) a la pestaña **Participaciones** sin volver a la invitación consumida ni derivar a **Décimos**.
- [x] v1.0.50: Redirección automática y protección de acceso tras renuncia de participación (`TicketDetailPage.tsx`, `OwnershipBreakdownCard.tsx`, `TicketsPage.tsx`): salida inmediata hacia `/?tab=participaciones` con `replace: true` tras confirmar renuncia (voluntaria o aceptando requerimiento del custodio), banner de confirmación *"Has renunciado a la participación. El décimo se ha retirado de tus participaciones."*, bloqueo y redirección de reentradas directas a décimos renunciados con toast de aviso, e invariante de exclusión total en listado activo, archivados y métricas.
- [x] v1.0.51: Bloqueo de navegación y marcado de lectura para décimos renunciados en Alertas y Detalle (`AlertsPage.tsx`, `TicketDetailPage.tsx`, `renouncedAlerts.ts`): detección reactiva de décimos renunciados (`status = 'RENUNCIADA'`), inhabilitación de apertura de ficha desde la bandeja de alertas con badge `Participación renunciada · Sin acceso`, supresión de botones de renuncia obsoletos, marcado automático como leídas de las notificaciones al renunciar o al pulsar la tarjeta con toast informativo, protección estricta en el render de `TicketDetailPage` evitando cualquier visualización no autorizada y suite de tests unitarios (`renouncedAlerts.test.ts`).
- [x] v1.0.52: Símbolos seguros del plano BMP para compartir por WhatsApp (`shareHelper.ts`, `whatsappShare.test.ts`): sustitución de emojis de 4 bytes por símbolos seguros Unicode del Plano Básico Multilingüe (`\u2605` ★, `\u2022` •, `\u2192` →, `<= 0xFFFF`) erradicando la corrupción a `\uFFFD` producida por `api.whatsapp.com/send` ante pares subrogados, con suite de pruebas unitarias verificando la conformidad estricta BMP.
- [x] v1.0.53: Restauración de emojis ricos originales en mensaje de WhatsApp (`shareHelper.ts`, `whatsappShare.test.ts`): recuperación de los emojis oficiales (`🎟️` `\u{1F3AB}`, `🔑` `\u{1F511}`, `👉` `\u{1F449}`) mediante secuencias de escape Unicode explícitas en UTF-8, garantizando la apariencia visual rica original en dispositivos móviles mientras se preserva el respaldo automático al portapapeles en escritorio.
- [x] v1.0.54: Reordenación de la estructura vertical en el detalle del décimo (`TicketDetailPage.tsx`): reubicación prioritaria del bloque de **Propiedad y Reparto** / **Historial** a la primera posición debajo de la cabecera superior, situando a continuación el boleto visual realista (`RealisticTicketCard`), metadatos técnicos, comprobador oficial de premios (`PrizeCheckCard`), panel de simulación de diagnóstico y botones de gestión, optimizando la visibilidad de cotitulares y cuotas en dispositivos móviles y escritorio.
- [x] v1.0.55: Motor histórico oficial de sorteos 2020–2025 (Navidad y El Niño): base de datos oficial integrada con escrutinio completo SELAE (premios mayores, aproximaciones, centenas, terminaciones y reintegros), arquitectura híbrida de 3 niveles en Edge Function `check-prizes` desplegada en Supabase, fixtures y suite de pruebas unitarias (`historicalDraws.test.ts` con 116 tests totales superados), y visualización de categorías oficiales y resultado verificado de 0 € en `PrizeCheckCard.tsx`.
- [x] v1.0.56: Cobertura de casos límite en premios y reparto (`historicalDraws.test.ts`, `prizeDistribution.test.ts` con 121 tests superados al 100%), validación estricta `/^\d{1,5}$/` en `historicalDraws.ts` con redespliegue de `check-prizes`, y mejoras de ergonomía táctil móvil (`>= 44px`, pestañas `grid-cols-2` y primer pliegue compacto en `TicketDetailPage.tsx` y `OwnershipBreakdownCard.tsx`).
- [x] v1.0.57: Terminología unificada a **Décimos** en toda la interfaz (`AppShell.tsx`, `TicketsPage.tsx`, `TicketDetailPage.tsx`, `AlertsPage.tsx`), botón único centrado **Añadir** con apertura directa de cámara y botón **Añadir décimo manual** en el escáner (`BarcodeScannerModal.tsx`), acciones rápidas **Compartir** y **Comprobar sorteo** en cada tarjeta (`TicketListItemCard.tsx`, `cardQuickActions.ts`), y suite de pruebas unitarias (`cardQuickActions.test.ts` con 126 tests superados al 100%).
- [x] v1.0.58: Botón `Añadir` a ancho completo (`w-full`), escáner unificado con **Tengo un código** y **Añadir décimo manual** sin subida de fotos (`BarcodeScannerModal.tsx`, `TicketFormModal.tsx`), gestos horizontales **Swipe** en tarjetas para **Archivar** y **Eliminar** con confirmación (`SwipeableTicketCard.tsx`, `swipeCardState.ts` con 131 tests superados al 100%), y limpieza visual de `TicketDetailPage.tsx` y `OwnershipBreakdownCard.tsx` (rosco por persona y eliminación de botones redundantes).
- [x] v1.0.59: Nuevo icono oficial limpio `<DecimoIcon />` sin muescas (`AppShell.tsx`, `TicketsPage.tsx`, `TicketListItemCard.tsx`), aislamiento estricto de eventos en botones **`Compartir`** (excluyendo `PROPIETARIO`/`RENUNCIADA`) y **`Comprobar sorteo`** (sin navegación al detalle), filos laterales verde/rojo (`border-l-4 border-l-emerald-600`, `border-r-4 border-r-rose-500`) como pista visual del swipe en tarjetas y suite de pruebas unitarias ampliada (132 tests superados al 100%).
- [x] v1.0.60: Reestructuración de navegación a 3 pestañas (**Décimos**, **Premios**, **Alertas** en `grid-cols-3` con `min-h-[44px]`), traslado de tarjetas KPI (`Décimos Activos` y `Total Premios`) desde `TicketsPage.tsx` a la nueva pantalla **`/premios`** (`PrizesPage.tsx`, `prizesSummary.ts`) con historial completo de escrutinio (`Todos`, `Premiados`, `Sin premio`) y suite de tests (`prizesSummary.test.ts` con 135 tests superados al 100%).
- [x] v1.0.61: Listado unificado de **Décimos** y **Participaciones** con badges identificativos (`Décimo` en verde / `Participación` en naranja), swipe de eliminación restringido a propios, botón flotante **`Añadir`** encima de `BottomNav`, restauración de **`Crear participación`** en `OwnershipBreakdownCard.tsx`, traslado de `<VersionBadge />` exclusivamente a `ProfilePage.tsx` y tests unitarios (`unifiedListAndActions.test.ts` con 137 tests superados al 100%).
- [x] v1.0.62: Pantalla principal limpia sin pestañas ni filtros (`TicketsPage.tsx`), traslado de **Décimos archivados** a **Mi Perfil** (`ProfilePage.tsx`, `archivedTickets.ts`) con desplegable `Décimos archivados (X)`, botones **Restaurar** y **Eliminar** (`min-h-[44px]`), toast *"Décimo archivado en tu cuenta. Puedes consultarlo en Mi Perfil."*, insignia `ARCHIVADO` en `TicketDetailPage.tsx` y tests unitarios (`archivedTickets.test.ts` con 140 tests superados al 100%).
- [x] v1.0.63: Aislamiento de cierre/retroceso del escáner (`useModalBackHandler.ts`, `useAndroidBackNavigation.ts`) con ventana de protección de 300 ms evitando el toast de salida, banner guiado *"Selecciona una participación para compartir"* al navegar desde `Compartir` con participaciones existentes (`selectShareToShare: true` en `TicketDetailPage.tsx`), botón táctil `min-h-[44px]` en `Ver QR / Compartir` y tests unitarios (141 tests superados al 100%).
- [x] v1.0.64: Integración de la identidad visual **4 MILLS** (bola de madera de bombo en squircle oscuro): recorte `1:1` y generación de `logo-4mills.png`, `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png`, `favicon-32x32.png` y `favicon.ico`, actualización de `vite.config.ts` e `index.html`, e integración en `AppShell.tsx`, `LoginPage.tsx` y `ShareInviteModal.tsx`.
