# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.0.57] - 2026-11-25

### Changed
- **Terminología Unificada a "Décimos" en Toda la Interfaz (`AppShell.tsx`, `TicketsPage.tsx`, `TicketDetailPage.tsx`, `AlertsPage.tsx`, `inviteService.ts`):**
  - Sustituida la palabra **"billetes" / "billete"** por **"décimos" / "décimo"** en toda la UI visible: pestaña de navegación **Décimos**, cabecera **Mis Décimos Compartidos**, KPI **Décimos Activos**, estado vacío **Sin décimos archivados**, botones **Archivar décimo / Desarchivar décimo**, enlace **Ver décimo** en alertas y mensajes de error, manteniendo intactas las rutas internas (`/billete/:id`, `/billetes/:id`) para compatibilidad de enlaces y Web Push.
- **Botón Único Centrado `Añadir` y Acceso Manual en Escáner (`TicketsPage.tsx`, `BarcodeScannerModal.tsx`):**
  - Unificados los botones de alta en un único botón verde corporativo centrado (**`Añadir`**, `bg-emerald-700 hover:bg-emerald-800 text-white`) que abre directamente el escáner de cámara.
  - Sustituido dentro del modal de cámara (`TICKET_BARCODE`) el botón inferior *"Subir foto del código"* por **"Añadir décimo manual"**, cerrando la cámara y abriendo el formulario manual al instante.
- **Acciones Rápidas en Cada Tarjeta de Décimo (`TicketListItemCard.tsx`, `TicketsPage.tsx`, `TicketDetailPage.tsx`, `OwnershipBreakdownCard.tsx`, `cardQuickActions.ts`):**
  - **Botón `Compartir`:** Reemplaza el texto derecho de la fila de fecha; si el décimo no tiene participaciones ni invitaciones pendientes navega con `openCreateShare: true` abriendo directamente el modal de crear participación, y si ya tiene participaciones abre la ficha del décimo.
  - **Botón `Comprobar sorteo`:** Reemplaza el texto inferior izquierdo (*"Solo tú"* / *"Compartido con..."*); valida si el sorteo ya se ha celebrado (`draw_date <= hoy` en `Europe/Madrid`) o ejecuta la Edge Function `check-prizes` con estado de carga y toast informativo.

### Added
- **Tests Unitarios de Acciones Rápidas (`src/lib/__tests__/cardQuickActions.test.ts`):**
  - Cobertura de navegación del botón `Compartir` (con y sin participaciones previas), validación de fecha de `Comprobar sorteo` y formateo de respuestas (premiado, `0 €` sin premio y no disponible).

## [1.0.56] - 2026-11-25

### Added
- **Batería de Pruebas Unitarias para Casos Límite (`historicalDraws.test.ts`, `prizeDistribution.test.ts`):**
  - **Premios SELAE:** Validación de aproximaciones circulares en extremos (`00000` ↔ `99999`), normalización de entradas atípicas (espacios, >5 dígitos, cadena vacía), acumulación válida (centena 1.º + 2 últimas cifras 2.º = `200 €`), absorción de reintegro en Navidad (`100 €` sin duplicar `20 €`) y no solapamiento de extracciones de 4 y 2 cifras en El Niño.
  - **Reparto y Métricas:** Verificación de reparto exacto con decimales periódicos (`33.33%`, `33.33%`, `33.34%`) sin pérdida de céntimos por redondeo, exclusión estricta de estados `PENDIENTE`, `CANCELADA` y `RENUNCIADA` en contadores activos/premios, y cálculo fraccionado para el custodio (`40%` de `1.000 €` = `400 €`).

### Fixed
- **Validación Estricta de Número de Décimo (`src/lib/historicalDraws.ts`, `supabase/functions/check-prizes/historicalDraws.ts`):**
  - Rechazo seguro de entradas vacías (`""`), no numéricas o mayores de 5 dígitos (`!/^\d{1,5}$/`) devolviendo `found: false` y `0` céntimos en lugar de rellenar con ceros erróneamente, con redespliegue de `check-prizes` en Supabase.

### Changed
- **Ergonomía Táctil y Primer Pliegue Móvil (`src/pages/TicketDetailPage.tsx`, `src/components/tickets/OwnershipBreakdownCard.tsx`):**
  - Ampliado el botón de retroceso (`handleBack`) a un área táctil mínima accesible (`min-h-[44px] min-w-[44px]`) con `aria-label="Volver atrás"`.
  - Selector de pestañas (**Propiedad y Reparto** / **Historial**) maquetado en `grid grid-cols-2` simétrico con altura táctil `min-h-[44px]`.
  - Espaciado vertical compactado en viewports móviles (`< 640px`) en el bloque de reparto y gráfico Donut (`w-36 h-36 sm:w-44 sm:h-44`) para mantener visible la tarjeta del décimo (`RealisticTicketCard`) en el primer pantallazo.

## [1.0.55] - 2026-11-24

### Added
- **Motor Histórico Oficial de Sorteos 2020–2025 (`supabase/functions/check-prizes/historicalDraws.ts`, `src/lib/historicalDraws.ts`):**
  - **Base de Datos Oficial Histórica (2020–2025):** Integración de todos los resultados oficiales escrutados por SELAE para el Sorteo Extraordinario de Navidad (22 de diciembre) y Sorteo de El Niño (6 de enero) desde 2020 hasta 2025 inclusive.
  - **Motor Matemático Oficial de Escrutinio (`evaluateHistoricalDraw`):**
    - Evaluación exhaustiva de premios mayores: El Gordo / 1.º premio, 2.º premio, 3.º premio, 4.º premios (Navidad), 5.º premios (Navidad).
    - Aproximaciones anterior y posterior (±1) al 1.º y 2.º premio.
    - Centenas completas (primeros 3 dígitos) de los premios mayores (1.º, 2.º, 3.º y 4.º en Navidad; 1.º y 2.º en El Niño).
    - Terminaciones de 4 cifras, 3 cifras y 2 cifras (con reglas oficiales de acumulación y no-solapamiento de SELAE).
    - Reintegros oficiales (última cifra del 1.º premio en Navidad; 3 reintegros oficiales en El Niño).
  - **Arquitectura Híbrida de 3 Niveles en Edge Function `check-prizes`:**
    - *Nivel 1 (Simulación controlada):* Exclusivo para el propietario custodio en entorno de pruebas.
    - *Nivel 2 (Archivo Histórico Integrado 2020–2025):* Escrutinio exacto e inmediato mediante el motor oficial integrado, persistiendo el resultado en `public.tickets` (`status = 'VALIDADO'`), registrando evento inmutable en `public.audit_events` y despachando notificaciones Web Push.
    - *Nivel 3 (Sorteos en directo y futuros 2026+):* Control temporal mediante `DRAW_NOT_HELD_YET` y consulta a API oficial en directo.
  - **Fixtures Estandarizados y Batería de Tests Unitarios (`src/lib/__fixtures__/historicalTickets.ts`, `src/lib/__tests__/historicalDraws.test.ts`):**
    - 11 casos de prueba cubriendo premios mayores (El Gordo 79432 en 2025 y 72897 en 2020, 2.º premio 70048 y 06766, 1.º premio de El Niño 78908), aproximaciones, centenas, dos últimas cifras, reintegros, boletos no premiados (0 €) y normalización de números.

### Changed
- **Visualización de Resultados y Categorías en la Interfaz (`src/components/tickets/PrizeCheckCard.tsx`):**
  - Muestra la categoría oficial del premio (ej. *"Resultado Oficial · El Gordo (1.º premio)"*, *"Resultado Oficial · Reintegro"*) tanto en tiempo real tras la comprobación como de forma persistente al cargar el billete.
  - Confirmación nítida para billetes no premiados (*"Comprobado · Sin premio en el sorteo oficial del DD/MM/AAAA"*), identificando la fuente como *"Archivo Oficial Histórico"*.
  - Mantenimiento del banner de aviso ámbar exclusivamente para sorteos con escrutinio no disponible (`HISTORICAL_UNAVAILABLE`).

## [1.0.54] - 2026-11-19

### Changed
- **Reordenación de la Estructura Vertical en el Detalle del Décimo (`src/pages/TicketDetailPage.tsx`, `docs/SCREENS_GUIDE.md`):**
  - **Bloque de Propiedad y Reparto en Primera Posición:**
    - El bloque de pestañas (**`Propiedad y Reparto`** e **`Historial`**) junto con su contenido activo (`OwnershipBreakdownCard` y `TicketAuditTimeline`) se sitúa inmediatamente debajo de la cabecera superior fija (*"Detalles del Décimo"*), permitiendo a los usuarios visualizar el gráfico de distribución, los cotitulares, cuotas y acciones de cesión sin necesidad de hacer scroll vertical.
  - **Boleto Realista, Comprobador y Acciones a Continuación:**
    - Se reubica inmediatamente después (con espaciado vertical armónico):
      1. La tarjeta visual del décimo (`RealisticTicketCard`), conservando el listener interactivo de 5 pulsaciones sobre el *"MISDECIMOS SELLO DIGITAL"* para el panel de diagnóstico.
      2. La fila de metadatos (`FECHA SORTEO` y `ORIGEN: Escáner GS1-128 / Manual`).
      3. El comprobador oficial de premios (`PrizeCheckCard`) y banners informativos de escrutinio.
      4. El panel de diagnóstico *"Modo Prueba de Premio"* para custodios.
      5. Los botones de gestión (`Archivar billete`, `Eliminar`) y el aviso de *Protección de cotitulares*.
  - **Actualización de Documentación:**
    - Actualizado `docs/SCREENS_GUIDE.md` con la nueva jerarquía vertical del detalle de billete.

## [1.0.53] - 2026-11-19

### Fixed
- **Restauración de Emojis Ricos en Mensaje de Invitación de WhatsApp (`src/lib/shareHelper.ts`, `src/lib/__tests__/whatsappShare.test.ts`):**
  - **Recuperación de los Emojis Originales (`🎟️`, `🔑`, `👉`):**
    - En `buildWhatsAppShareMessage`, se sustituyen los símbolos planos BMP (`★`, `•`, `→`) restableciendo los emojis ricos mediante secuencias de escape Unicode explícitas en UTF-8:
      - `\u{1F3AB}` para el décimo y porcentaje (🎟️).
      - `\u{1F511}` para el código PIN de 6 dígitos (🔑).
      - `\u{1F449}` para el enlace interactivo de reclamación (👉).
    - Se recupera la apariencia visual colorida original en clientes móviles de mensajería (Android e iOS).
    - Se mantiene la copia preventiva automática al portapapeles en escritorio para asegurar el pegado con formato íntegro en WhatsApp Desktop.
  - **Pruebas Unitarias Actualizadas (`src/lib/__tests__/whatsappShare.test.ts`):**
    - Validación de presencia de los tres emojis oficiales y ausencia total de caracteres de reemplazo corruptos `\uFFFD`.
    - Total de 105 tests unitarios superados al 100%.

## [1.0.52] - 2026-11-19

### Fixed
- **Símbolos Seguros del Plano BMP para Compartir por WhatsApp (`src/lib/shareHelper.ts`, `src/lib/__tests__/whatsappShare.test.ts`):**
  - **Sustitución de Emojis de 4 Bytes por Símbolos BMP (3 Bytes, `<= 0xFFFF`):**
    - En `buildWhatsAppShareMessage`, se sustituyen los emojis suplementarios de 4 bytes (`\u{1F3AB}`, `\u{1F511}`, `\u{1F449}`) por símbolos Unicode seguros del Plano Básico Multilingüe:
      - `\u2605` (★) para destacar el décimo y el porcentaje cedido.
      - `\u2022` (•) para el código PIN de 6 dígitos.
      - `\u2192` (→) para el enlace web directo de reclamación.
    - Se elimina de raíz la alteración que el servidor web `api.whatsapp.com/send` efectuaba al recibir caracteres de 4 bytes codificados en pares subrogados UTF-16, transformándolos erróneamente en el carácter de sustitución `\uFFFD` ().
  - **Batería de Pruebas Unitarias Reforzada (`src/lib/__tests__/whatsappShare.test.ts`):**
    - Nueva prueba que itera sobre cada unidad de código y punto de código del mensaje generado para verificar formalmente que ningún carácter excede `0xFFFF`, que no existen pares subrogados (`0xD800` a `0xDFFF`) y que no aparece `\uFFFD`.
    - Total de 106 pruebas unitarias ejecutadas con 100% de éxito.

## [1.0.51] - 2026-11-19

### Fixed
- **Bloqueo de Navegación y Marcado de Lectura para Décimos Renunciados en Alertas y Detalle (`AlertsPage.tsx`, `TicketDetailPage.tsx`, `renouncedAlerts.ts`):**
  - **Inhabilitación de Navegación desde la Bandeja de Alertas (`AlertsPage.tsx`, `renouncedAlerts.ts`):**
    - Carga reactiva de los `ticket_id` de participaciones con `status === 'RENUNCIADA'` (y `role !== 'PROPIETARIO'`) para el usuario autenticado.
    - Extracción universal y tipada del identificador de décimo en notificaciones mediante `extractTicketIdFromNotification()` (vía `ticket_id`, `metadata.ticket_id` o `action_url` con soporte para `/billetes/`, `/billete/`, `/decimos/` y `/tickets/`).
    - En alertas asociadas a décimos renunciados:
      - Se suprime la navegación hacia `/billete/:id` al pulsar sobre la tarjeta o cualquier botón secundario.
      - Se sustituye el enlace interactivo *"Ver billete"* por la insignia fija `Participación renunciada · Sin acceso` (`bg-gray-100 text-gray-500 border-gray-200/80` con icono `Ban`).
      - Se ocultan los botones de acción de solicitud de renuncia (`isWaiverRequest`), impidiendo reinteracciones ambiguas en cuotas ya extinguidas.
      - Al pulsar sobre la tarjeta de alerta, esta se marca como leída en Supabase (`is_read = true`) y muestra un toast informativo ámbar: *"Ya renunciaste a esta participación; no tienes acceso al décimo."*, manteniéndose en la pantalla de alertas sin transferir foco.
  - **Marcado Automático de Notificaciones al Renunciar (`AlertsPage.tsx`, `TicketDetailPage.tsx`):**
    - Al aceptar la renuncia desde la propia alerta (`respond_share_waiver`), se marcan atómicamente todas las notificaciones pendientes vinculadas a dicho décimo (`ticket_id`) para el usuario como leídas (`is_read = true`).
    - Al renunciar voluntariamente desde el detalle del décimo (`TicketDetailPage.tsx`), se marcan como leídas todas las notificaciones del usuario para ese `ticket_id` antes de redirigir a `/?tab=participaciones`.
    - Blindaje estricto del renderizado en `TicketDetailPage.tsx`: si un usuario no propietario no tiene participación activa (`status === 'ACEPTADA'` o `'PENDIENTE'` con porcentaje mayor a 0), se retorna un estado de carga mientras se ejecuta la redirección, evitando cualquier parpadeo o visualización accidental del billete.
  - **Batería de Pruebas Unitarias (`src/lib/__tests__/renouncedAlerts.test.ts`):**
    - 6 nuevos tests unitarios verificando la extracción de `ticket_id` (directo, metadata y patrones de URL), detección precisa de décimos renunciados y bloqueo selectivo de navegación en `canNavigateToTicketFromAlert()` (total de 105 tests unitarios en la suite general, todos aprobados al 100%).

## [1.0.50] - 2026-11-19

### Fixed
- **Redirección Automática y Protección de Acceso tras Renuncia de Participación (`TicketDetailPage.tsx`, `OwnershipBreakdownCard.tsx`, `TicketsPage.tsx`):**
  - **Salida Automática Inmediata a Participaciones tras Renunciar:**
    - Tanto en renuncias voluntarias del participante (`renounce_own_participation`) como al aceptar una solicitud de renuncia del custodio (`respond_share_waiver` con `accept = true`), la aplicación ya no permanece en la ficha del décimo.
    - Se redirige de forma inmediata a `/?tab=participaciones` con `replace: true`, eliminando `/billetes/:id` del historial del navegador para evitar reentradas accidentales al pulsar el botón Atrás en Android o el navegador.
    - Se muestra el toast informativo de confirmación: *"Has renunciado a la participación. El décimo se ha retirado de tus participaciones."*.
  - **Protección de Entrada Directa a Billetes Renunciados (`TicketDetailPage.tsx`):**
    - Si un usuario que ya no es propietario ni cuenta con participación activa (`ACEPTADA` o `PENDIENTE`) intenta abrir directamente `/billetes/:id` (por ejemplo, desde una notificación previa o enlace antiguo), la ficha bloquea la visualización, muestra el aviso *"Ya no tienes acceso a este décimo porque renunciaste a tu participación."* y redirige de inmediato a `/?tab=participaciones` con `replace: true`.
  - **Batería de Pruebas Unitarias (`src/lib/__tests__/renounceNavigation.test.ts`):**
    - 6 nuevos tests unitarios verificando la evaluación de acceso (propietario, cotitular activo, cuota renunciada, usuario ajeno), la construcción de acciones de redirección con `replace: true` y la confirmación de exclusión total de participaciones renunciadas en listados y métricas (99 tests unitarios en total con 100% de éxito).

## [1.0.49] - 2026-11-19

### Fixed
- **Apertura Directa de la Ficha del Décimo Reclamado y Retorno a Participaciones (`src/services/inviteService.ts`, `InvitePage.tsx`, `TicketsPage.tsx`, `TicketDetailPage.tsx`):**
  - **Retorno Consistente de `ticket_id` en Servicios de Reclamación (`src/services/inviteService.ts`):**
    - Módulo centralizado con funciones tipadas `previewInvite()`, `claimInvite()` y `rejectInvite()`.
    - Garantía de que `claimInvite()` devuelve de forma estricta y obligatoria el identificador del décimo (`ticket_id`) y el porcentaje asignado tras confirmar la participación en la base de datos (`accept_pending_invite` RPC).
  - **Apertura Inmediata del Décimo y Sustitución de Historial (`TicketsPage.tsx`, `InvitePage.tsx`):**
    - Tras reclamar con éxito una participación (mediante enlace web `/invite/:id`, introducción del código de 6 dígitos o escaneo de código QR):
      - Cierra el modal de forma inmediata y limpia el código activo.
      - Muestra el toast contextual de confirmación (*"¡Participación del X% reclamada correctamente!"*).
      - Sustituye la entrada actual en el historial del navegador (`/invite/:id` o `/`) por `/?tab=participaciones` mediante `window.history.replaceState` y `setSearchParams({ tab: 'participaciones' }, { replace: true })`.
      - Navega inmediatamente a la ficha del décimo (`/billetes/:id`) transmitiendo `state: { fromTab: 'participaciones', claimMessage: '...' }`.
  - **Experiencia de Usuario en el Detalle del Décimo (`TicketDetailPage.tsx`):**
    - Captura en el arranque el mensaje `claimMessage` desde el historial y lo renderiza en un banner verde esmeralda superior de confirmación.
    - `handleBack()` adaptativo: si el usuario pulsa el botón Volver o el botón Atrás nativo de Android, regresa limpiamente a `/?tab=participaciones` respetando el historial o derivando por `fromTab: 'participaciones'`, asegurando que nunca vuelva a una invitación ya consumida ni caiga en la pestaña **Décimos**.
  - **Batería de Pruebas Unitarias (`src/lib/__tests__/claimShareNavigation.test.ts`):**
    - 6 nuevos tests unitarios certificando la preparación de estados de navegación post-reclamación, prioridad de `fromTab: 'participaciones'` en retornos y compatibilidad con direct entry (93 tests unitarios en total superados).

## [1.0.48] - 2026-11-19

### Fixed
- **Compartición por WhatsApp con Unicode Seguro y Respaldo Desktop (`src/lib/shareHelper.ts`, `ShareInviteModal.tsx`):**
  - **Erradicación de Caracteres Corruptos (`\uFFFD`):**
    - Sustitución de emojis literales susceptibles de alteración por escapes Unicode directos y robustos:
      - `\u{1F3AB}` para décimo/billete (🎟️).
      - `\u{1F511}` para código/llave PIN de 6 dígitos (🔑).
      - `\u{1F449}` para llamada a la acción / enlace (👉).
    - Centralizada la generación del texto oficial en `buildWhatsAppShareMessage()` y la URL en `buildWhatsAppShareUrl()`.
  - **Respaldo para WhatsApp Escritorio en macOS y Windows:**
    - Al pulsar *"Enviar por WhatsApp"*, el contenido íntegro del mensaje (con porcentaje, número de billete, sorteo, código de 6 dígitos y URL) se copia automáticamente al portapapeles (`navigator.clipboard?.writeText`).
    - Se despliega un banner de aviso contextual y tranquilizador en el modal informando al usuario: *"Abriendo WhatsApp… Mensaje completo copiado al portapapeles. Si WhatsApp Escritorio solo pega el enlace, usa Pegar (Ctrl+V / ⌘V) para incluir los detalles y el código de 6 dígitos."*
  - **Fallback Robusto en Web Share API:**
    - En caso de no soporte o cancelación en `navigator.share()`, el flujo deriva limpiamente al mismo manejador con apertura de WhatsApp y copia al portapapeles.
  - **Batería de Pruebas Unitarias (`src/lib/__tests__/whatsappShare.test.ts`):**
    - 3 nuevos tests unitarios certificando la ausencia de `\uFFFD`, presencia de todos los campos obligatorios, manejo de nulos y fidelidad en la codificación y decodificación URI con preservación de emojis (87 tests unitarios en total con 100% de éxito).

## [1.0.47] - 2026-11-19

### Fixed
- **Armonización Visual del Banner de Histórico No Disponible (`src/components/tickets/PrizeCheckCard.tsx`):**
  - **Sustitución de la Paleta Gris Neutro por Ámbar/Naranja:**
    - Reemplazadas las clases neutras en gris pizarra (`bg-slate-50 border-slate-200/90 text-slate-800`) por la paleta de aviso ámbar/naranja coherente con el sistema de alertas de la aplicación:
      - Contenedor principal: `bg-amber-50/90 border border-amber-300/80 rounded-2xl p-4 shadow-xs flex items-start gap-3`.
      - Icono temático `CalendarOff`: Enmarcado en una caja suave `w-8 h-8 rounded-xl bg-amber-100 border border-amber-200/80 text-amber-600 shadow-xs`.
      - Título jerárquico (**"Histórico no disponible"**): `text-sm font-semibold text-amber-950`.
      - Texto descriptivo explicativo: `text-xs leading-relaxed text-amber-900/90`.
  - **Consistencia Visual en Comprobaciones de Premios:**
    - Garantizada la cohesión cromática entre todos los avisos informativos (sorteo futuro, sorteo en curso e histórico archivado no disponible en proveedor oficial).

## [1.0.46] - 2026-11-19

### Fixed
- **Captura Global y Fiabilidad del Prompt de Instalación PWA (`src/main.tsx`, `usePwaInstall.ts`, `ProfilePage.tsx`, `vite.config.ts`, `manifest.webmanifest`):**
  - **Captura Temprana Global en Arranque (`src/main.tsx`):**
    - Registrado el listener `beforeinstallprompt` a nivel de módulo en `src/main.tsx` antes del renderizado de React, almacenando el evento nativo en `window.__deferredPwaPrompt` y emitiendo el evento personalizado `pwa-deferred-prompt-ready`.
    - Garantiza que la oportunidad de instalación nativa no se pierda aunque el navegador dispare el evento mientras el usuario navega en `/` antes de acceder a la pantalla de Perfil.
  - **Corrección de Falso Positivo Standalone tras Desinstalación en Android:**
    - Erradicada la comprobación estática de `localStorage.getItem('misdecimos_pwa_installed') === 'true'` en `isStandaloneMode()`, la cual bloqueaba permanentemente la visibilidad del botón de instalación tras desinstalar la PWA y abrir Chrome móvil.
    - La comprobación se fundamenta de forma estricta y dinámica en el modo de visualización real (`display-mode: standalone`, `navigator.standalone` y `document.referrer.startsWith('android-app://')`).
  - **Comportamiento Mejorado en la Pantalla de Perfil (`ProfilePage.tsx`):**
    - Si la aplicación está abierta en modo standalone nativo (`isStandalone === true`): Muestra el indicador *"Aplicación instalada en este dispositivo"* con check verde.
    - Si la aplicación no está en modo standalone (`isStandalone === false`): Muestra de forma incondicional el botón interactivo *"Instalar aplicación en tu dispositivo"* (tanto en móviles como en ordenadores).
    - **Lanzamiento Nativo o Fallback a Modal de Instrucciones:**
      - Si `deferredPrompt` nativo está disponible: Lanza el diálogo oficial de instalación con un solo toque (`await deferredPrompt.prompt()`).
      - Si `deferredPrompt` es `null` (periodo de enfriamiento de Chrome Android tras desinstalación o navegador iOS Safari): Despliega un modal accesible con instrucciones claras paso a paso adaptadas al dispositivo detectado (menú ⋮ en Android Chrome, botón Compartir en iOS Safari, o barra de direcciones en Escritorio), con integración al botón Atrás de Android vía `useModalBackHandler`.
  - **Conformidad Estricta de Iconos en Manifiesto PWA (`vite.config.ts` y `manifest.webmanifest`):**
    - Declarados explícitamente `purpose: 'any'` para `pwa-192x192.png` y `pwa-512x512.png`, y `purpose: 'maskable'` para `pwa-512x512.png`, superando todas las validaciones de instalabilidad de Google Chrome y Android.
  - **Batería de Pruebas Unitarias (`pwaInstall.test.ts`):** 4 nuevos tests unitarios certificando la detección de modo standalone, clasificación de dispositivos (Android, iOS, Desktop), captura y limpieza de `window.__deferredPwaPrompt`, y activación de fallback modal ante ausencia de prompt nativo (84 tests unitarios totales superados).

## [1.0.45] - 2026-11-19

### Added
- **Modernización Integral de la Identidad Visual de Marca y Recursos de Aplicación (`public/*`, `AppShell.tsx`, `LoginPage.tsx`, `vite.config.ts`, `index.html`):**
  - **Nuevo Emblema de Alta Seguridad y Orfebrería:**
    - Isotipo basado en un squircle superelíptico continuo (`n = 4.70`) con gradiente esmeralda (`#2E6146` a `#183E2C`), bisel lumínico y medallón perimetral de orfebrería dorada con cenefas de seguridad y eslabones concéntricos.
    - Boleto troquelado en forma de 'D' con perforaciones de matriz en su margen izquierdo y dientes de engranaje en su curvatura, custodiando una rosa de los vientos / estrella náutica de 4 puntas facetada en relieve 3D.
  - **Generación y Optimización de Assets Multi-Plataforma en `public/`:**
    - `public/pwa-192x192.png`: Renderizado antialiased a 192x192 px con transparencia exterior del squircle y micro-máscara de enfoque, empleado en la cabecera de la aplicación, pantalla de inicio de sesión y notificaciones Web Push.
    - `public/pwa-512x512.png`: Renderizado de alta resolución a 512x512 px para instalación PWA en Android, splash screens y lanzadores de escritorio.
    - `public/apple-touch-icon.png`: Icono de 180x180 px con fondo verde esmeralda sólido (`#22573F`) en las esquinas, previniendo el renderizado de esquinas negras de iOS SpringBoard.
    - `public/favicon.ico`: Fichero multi-resolución (16x16, 32x32, 48x48 y 64x64 px) con realce de contraste y nitidez adaptado a pestañas de escritorio en Windows/macOS.
    - `public/favicon.svg`: Icono vectorial escalable de alta definición con el medallón dorado, el boleto troquelado y la estrella facetada.
    - `public/masked-icon.svg`: Silueta vectorial en monocromo negro para Safari Pinned Tabs en macOS.
    - `public/badge-mono.png`: Silueta monocroma con canal alfa para la barra de estado de notificaciones en Android 5+.
  - **Actualización de la Interfaz de Usuario:**
    - Cabecera fija en [`AppShell.tsx`](src/components/layout/AppShell.tsx): Sustituido el icono genérico de billete por la imagen oficial del nuevo isotipo `/pwa-192x192.png` (`w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-xs`).
    - Pantalla de inicio de sesión en [`LoginPage.tsx`](src/pages/LoginPage.tsx): Sustituido el contenedor rosa genérico por el emblema oficial `/pwa-192x192.png` (`h-16 w-16 rounded-2xl shadow-md object-contain`).
  - **Configuración de PWA y Pre-Caché:**
    - Enriquecida la lista de `includeAssets` en [`vite.config.ts`](vite.config.ts) incorporando `favicon.svg` y `badge-mono.png`, elevando la precaché de Workbox a 24 elementos (1565,47 KiB).
    - Añadido enlace directo a favicon `.ico` en [`index.html`](index.html) para compatibilidad universal en navegadores de escritorio.

## [1.0.44] - 2026-11-19

### Added
- **Unificación de la Cabecera Superior en Dispositivos Móviles y Escritorio (`src/components/layout/AppShell.tsx`):**
  - **Logotipo y Marca MisDecimos a la Izquierda (Común Móvil y Escritorio):**
    - En todos los anchos de pantalla (`w-full flex items-center justify-between gap-2`), el logotipo corporativo (caja verde `#2E6146` con icono de décimo en blanco) y el texto `MisDecimos` se posicionan fijos arriba a la izquierda.
    - Funciona como enlace interactivo directo al inicio (`/` / pestaña `billetes`), ejecutando `window.scrollTo({ top: 0, behavior: 'smooth' })` si el usuario ya se encuentra en la pantalla principal.
  - **Acceso a Perfil Reubicado a la Esquina Superior Derecha en Móviles (`< 768px`):**
    - Botón compacto con avatar circular (`w-8 h-8 rounded-full border border-lottery/30`) y nombre de usuario truncado (`max-w-[110px] sm:max-w-[140px]`), omitiendo la dirección de email en la cabecera móvil para evitar colisiones y desbordamientos en pantallas estrechas.
    - Mantiene el anillo/fondo resaltado verde esmeralda (`bg-[#2E6146]/[0.08] ring-1 ring-[#2E6146]/30`) cuando el usuario está en las vistas de **Perfil** o **Auditoría**.
  - **Cabecera de Escritorio (`>= 768px`):**
    - Conserva intacto el menú horizontal a la derecha con accesos a **Billetes** y **Alertas** (con badge dinámico de notificaciones sin leer), separador vertical sutil (`h-6 w-px bg-gray-200`) y botón de perfil de escritorio.
  - **Preservación de la Navegación Móvil Inferior (`md:hidden`):**
    - La barra inferior (`BottomNav`) continúa sirviendo como navegación primaria ergonómica para el pulgar entre **Billetes** y **Alertas**.

## [1.0.43] - 2026-11-19

### Added
- **Flujo de Solicitud y Confirmación de Cobro de Premios por Cotitular (`OwnershipBreakdownCard.tsx`, `prizeService.ts`, `prizePayoutHelper.ts`, RPCs `request_prize_payout_confirmation` y `confirm_prize_payout_received`):**
  - **Columnas de Seguimiento en Base de Datos:** `prize_payout_requested_at` y `prize_payout_requested_by` en `public.ownership_shares` aplicadas vía migración inmutable `20261119051800_prize_payout_confirmation_flow.sql` en Supabase Cloud (`xmdghpyfrblmtjtevtru`).
  - **RPC Transaccional `request_prize_payout_confirmation`:** Valida que el invocador sea el custodio legal del décimo con premio, registra la fecha/hora de solicitud en la participación, emite el evento de auditoría inmutable `SOLICITUD_CONFIRMACION_COBRO` con metadatos del importe proporcional y envía una notificación con deep link en `public.notifications` (disparando Web Push nativo en Android).
  - **RPC Transaccional `confirm_prize_payout_received`:** Permite al cotitular titular de la cuota confirmar la recepción de su parte del premio, actualizando `prize_paid_confirmed = true`, emitiendo `COBRO_PREMIO_CONFIRMADO`, notificando al custodio y liquidando de forma automática el décimo (`LIQUIDADO`) cuando todas las cuotas han confirmado.
  - **Limpieza Automática en Simulaciones:** Actualizada la RPC `reset_ticket_prize_simulation` para reiniciar limpiamente `prize_payout_requested_at` y `prize_payout_requested_by`.
  - **Recuperación del Menú Contextual de Tres Puntos (`MoreVertical`) para el Custodio:**
    - Visible para el custodio en cada tarjeta de cotitular aceptada que figure como `PENDIENTE DE COBRO` en décimos premiados.
    - Acción *"Solicitar confirmación de cobro"* (o *"Reenviar solicitud de cobro"* si ya se emitió).
    - Banner informativo en ámbar suave: *"Solicitud de confirmación de cobro enviada. Esperando respuesta del participante."*
  - **Confirmación con un Toque para el Cotitular:** Botón interactivo destacado en verde esmeralda *"Confirmar cobro recibido (X,XX €)"* visible para el participante en su tarjeta de cotitular.
  - **Batería de Pruebas Unitarias (`prizePayoutConfirmation.test.ts`):** 6 nuevos tests unitarios validando la visibilidad del menú de cobro, la alternancia a *"Reenviar"*, la presencia del banner de espera, el botón de confirmación del cotitular y su ocultación tras liquidar (80 tests unitarios totales superados).

## [1.0.42] - 2026-11-19

### Added
- **Diseño Celebratorio y Destacado de Tarjetas Premiadas en el Listado Principal (`TicketListItemCard.tsx`, `ticketCardHelper.ts`, `TicketsPage.tsx`):**
  - **Acabado Visual Ganador con Borde y Halo:**
    - Reemplazado el fondo blanco plano por un degradado sutil dorado y esmeralda (`bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/75`).
    - Borde dorado reforzado (`border-2 border-amber-400/85`) con halo suave y sombra enriquecida (`ring-2 ring-amber-300/25 shadow-md shadow-amber-900/5`).
    - Franja superior degradada de acento continuo (`from-amber-400 via-yellow-400 to-emerald-500`).
  - **Iconografía y Badge Ganador:**
    - Icono superior izquierdo en caja dorada con trofeo (`bg-amber-100 text-amber-700 border border-amber-300/80`).
    - Badge dinámico de estado sustituido por **`¡PREMIADO!`** (o **`LIQUIDADO`**) en degradado dorado/ámbar (`bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold tracking-wide shadow-sm`) con icono `Sparkles`.
  - **Banner de Premio Integrado:**
    - Recuadro resaltado en verde esmeralda (`bg-emerald-600/10 border border-emerald-500/25 rounded-2xl px-3.5 py-2.5`) con icono `Trophy` que resalta de forma prioritaria el importe correspondiente al usuario en fuente mono de 16 px (ej. **`750,00 € tuyos`**) y el premio total del billete (`Décimo: 1.000,00 €`).
    - Tratamiento transparente y neutro para participaciones con renuncia formal (`Cuota: Renunciada (0,00 €)`).
  - **Consistencia Multidimensional:** Visualización idéntica aplicada transversalmente en las tres pestañas (**Décimos**, **Participaciones** y **Archivados**).
  - **Batería de Pruebas Unitarias (`winningTicketCard.test.ts`):** 7 nuevos tests unitarios validando estados pendientes, no premiados, ganadores activos, 100% custodio, liquidados y archivados (74 tests unitarios totales superados).

## [1.0.41] - 2026-11-19

### Added
- **Flujo Completo de Premios, Simulación Controlada y Trazabilidad Transaccional (`check-prizes` v5, `prizeService.ts`, `TicketDetailPage.tsx`, `OwnershipBreakdownCard.tsx`, RPC `reset_ticket_prize_simulation`):**
  - **Tubería de Simulación en Edge Function (`check-prizes` v5):**
    - Parámetro `simulatedPrizePerDecimo`: Permite simular premios oficiales (ej. 1.000 €) verificando que el solicitante sea estrictamente el propietario (`ticket.owner_id === user.id`).
    - Invoca la función RPC transaccional `record_ticket_prize_check`, que calcula la distribución exacta en céntimos y euros exclusivamente entre participaciones con estado `ACEPTADA`, inserta el evento inmutable `PREMIO_REGISTRADO` en `public.audit_events` incluyendo `shares_breakdown` en sus metadatos y dispara notificaciones en `public.notifications` con Web Push nativo y deep links a la ficha del décimo.
  - **Función RPC Transaccional de Restablecimiento (`reset_ticket_prize_simulation`):**
    - RPC `SECURITY DEFINER` en PostgreSQL que restablece atómicamente `prize_amount_cents = 0`, el estado a `PENDIENTE`, resetea confirmaciones de cobro de cotitulares y registra el evento inmutable `SIMULACION_PREMIO_RESTABLECIDA` en `public.audit_events`.
    - Integrado en `check-prizes` v5 con parámetro `resetSimulation: true` restringido al propietario custodio.
  - **Panel de Diagnóstico "Modo Prueba de Premio" en `TicketDetailPage.tsx`:**
    - Visible exclusivamente para el custodio propietario cuando `import.meta.env.DEV === true` o tras pulsar 5 veces consecutivas sobre el componente interactivo `"MISDECIMOS SELLO DIGITAL"` en el décimo realista.
    - Botón **"Simular premio (1.000 €)"**: activa el premio, actualiza las cuotas en euros y notifica a cotitulares.
    - Botón **"Restablecer"**: devuelve el décimo a su estado original sin premio.
  - **Desglose de Premios y Participaciones Renunciadas en `OwnershipBreakdownCard.tsx`:**
    - Visualización en euros del premio proporcional correspondiente para el propietario y cada cotitular aceptado cuando `prize_amount_cents > 0`.
    - Muestra explícita de participaciones renunciadas con `0%`, `0,00 €` y estado *"Renuncia formal registrada en auditoría"*.
  - **Batería de Pruebas Unitarias (`prizeDistribution.test.ts`):** 4 nuevos tests que certifican el reparto proporcional, la exclusión de cuotas pendientes o renunciadas y el ciclo de simulación y reseteo (67 tests unitarios totales superados).

## [1.0.40] - 2026-11-19

### Fixed
- **Validación Estricta de Año y Gestión de Sorteos Históricos en Comprobación de Premios (`check-prizes` v4, `prizeService.ts`, `PrizeCheckCard.tsx`, `prizeCheckerValidation.ts`):**
  - **Eliminación del Falso Positivo "Sorteo en curso":** Corregido el mapeo indiscriminado de respuestas vacías o `error: 1` / `status: 0` a "sorteo en curso" para billetes con fecha de sorteo pasada (`draw_date < today`, ej. Navidad 2020 `2020-12-22`).
  - **Validación Cronológica y de Año en la Edge Function (`check-prizes` v4):**
    - Sorteos futuros (`draw_date > today` o antes del inicio oficial CET): Retorna inmediatamente `code: 'DRAW_NOT_HELD_YET'` indicando la fecha futura de celebración.
    - Sorteos del día de hoy en celebración (`draw_date === today`): Si el proveedor indica escrutinio no cerrado (`status === 0`), devuelve `code: 'DRAW_IN_PROGRESS'`.
    - Sorteos históricos de años anteriores (`draw_date < today`): Si el proveedor oficial no dispone de base de datos histórica para ese año específico, devuelve el estado específico `code: 'HISTORICAL_UNAVAILABLE'` con el mensaje claro: *"No hay resultados históricos disponibles en el proveedor oficial para el sorteo del DD/MM/AAAA."*.
    - Si el proveedor confirma el resultado oficial (tanto `0 €` como `> 0 €`), persiste el resultado en `public.tickets` (`status = 'VALIDADO'`), inserta evento en `audit_events` y despacha notificaciones a los cotitulares con cuota aceptada.
  - **Aislamiento en Memoria Caché:** Clave de caché compuesta `${effectiveDrawDate}:${drawType}:${number}` para prevenir colisiones entre billetes del mismo número en distintos años.
  - **Mejora Visual en la Ficha de Detalle (`PrizeCheckCard.tsx`):**
    - **Histórico no disponible:** Banner informativo neutro en gris pizarra (`bg-slate-50 border-slate-200 text-slate-800`), permitiendo seguir archivando o gestionando el décimo con normalidad sin alarmar al usuario con un error de red.
    - **Sorteo futuro / en curso:** Aviso informativo en ámbar (`bg-amber-50`).
    - **Comprobado sin premio:** Estado nítido *"Sin premio en el sorteo oficial del DD/MM/AAAA"*.
    - **Comprobado con premio:** Tarjeta destacada en verde esmeralda con el premio total y el desglose de la cuota personal.
  - **Batería de Pruebas Unitarias (`prizeCheckerValidation.test.ts`):** Cobertura automatizada de fechas futuras, horas de inicio peninsulares CET, sorteos en curso, sorteos históricos sin proveedor y comprobaciones con y sin premio (10 nuevos tests unitarios).

## [1.0.39] - 2026-11-19

### Added
- **Cabecera de Escritorio con Logotipo/Marca a la Izquierda y Perfil a la Derecha (`AppShell.tsx`):**
  - **Identidad de Marca e Inicio en Escritorio (`>= 768px`):** Incorporado en la esquina superior izquierda un botón interactivo (`aria-label="Ir a la pantalla principal"`) compuesto por el isotipo corporativo en verde `#2E6146` (`w-9 h-9 rounded-xl` con icono de décimo en blanco) y el texto de marca **"MisDecimos"** (`text-lg font-bold tracking-tight text-gray-900`), que navega directamente a la pantalla principal (`/`) o ejecuta scroll suave hacia arriba si el usuario ya se encuentra en ella.
  - **Reubicación de Navegación y Perfil a la Derecha en Escritorio:**
    - Agrupación en horizontal a la derecha de los accesos principales **Billetes** y **Alertas** (con badge dinámico en tiempo real de notificaciones no leídas).
    - Inclusión de un separador vertical sutil (`h-6 w-px bg-gray-200 mx-1`).
    - Botón compacto de usuario (avatar circular de 32 px + nombre de usuario), conservando el anillo y fondo verde activo (`bg-[#2E6146]/[0.08] ring-1 ring-[#2E6146]/30`) cuando se navega a `/perfil` o `/auditoria`, y optimizando el espacio visual al omitir el correo en ordenadores.
  - **Preservación Integral en Móvil (`< 768px`):** Mantenida intacta la disposición móvil con el bloque completo del usuario a la izquierda (avatar, nombre y correo) y la navegación centralizada en la barra inferior.

### Fixed
- **Parser Oficial SELAE de 20 Dígitos y Autodetección de Sorteo y Fecha (`selaeBarcodeParser.ts`, `TicketFormModal.tsx`):**
  - **Estructura Canónica SELAE `1 + 3 + 1 + 2 + 3 + 6 + 4`:** Corregida la descomposición del código de barras de Lotería Nacional (Code-128 / GS1-128 / ITF) con la expresión regular `/(?:01)?5(\d{3})(\d{1})(\d{2})(\d{3})(\d{6})(\d{4})/`:
    - Dígito 1 (`5`): Identificador del juego oficial de Lotería Nacional en SELAE.
    - Dígitos 2..4 (`drawCode`, 3 dígitos): Número de sorteo del año (`102` = Navidad, `002` = El Niño).
    - Dígito 5 (`yearDigit`, 1 dígito): Último dígito del año, resolviendo el año completo en la década (`fullYear = 2020 + Number(yearDigit)`: `0` → `2020`, `5` → `2025`, `6` → `2026`, etc.).
    - Dígitos 6..7 (`fraction` / `fraccion`, 2 dígitos): Fracción del décimo (`01`..`10`).
    - Dígitos 8..10 (`series` / `serie`, 3 dígitos): Serie del décimo (`001`..`185`).
    - Dígitos 11..16 (`rawNumber`, 6 dígitos): Número del décimo con cero inicial; extracción canónica de 5 dígitos mediante `slice(-5)` (`049307` → `49307`, `088008` → `88008`, `002320` → `02320`).
    - Dígitos 17..20 (`checkDigits`, 4 dígitos): Dígitos de control y seguridad.
  - **Autodetección Inteligente de Tipo y Fecha de Sorteo:**
    - `drawCode === '102'`: Asignación automática de `drawType = 'NAVIDAD'`, `drawDate = `${fullYear}-12-22`` y `drawName = `Sorteo Extraordinario de Navidad ${fullYear}``.
    - `drawCode === '002'`: Asignación automática de `drawType = 'EL_NINO'`, `drawDate = `${fullYear}-01-06`` y `drawName = `Sorteo Extraordinario de El Niño ${fullYear}`` (resolviendo el fallo previo en décimos de El Niño con prefijo `5002...`).
    - Sorteos ordinarios: Preserva `drawCode` y año `fullYear` con fallback seguro sin bloquear el escaneo ni la confirmación visual.
  - **Sincronización Total en `TicketFormModal.tsx`:**
    - Actualización explícita y bidireccional tanto en la precarga externa (`initialScannedData`) como en el escaneo interno de cámara (`handleBarcodeScanned`).
    - Ampliado `handleDrawTypeChange` con parámetros opcionales `(type, explicitDate, explicitName)` para preservar la fecha y denominación extraídas del código de barras sin que se sobrescriban con los valores por defecto del año en curso.
    - Autocompletado simultáneo de `number`, `serie`, `fraccion`, `drawType` (botón Navidad / El Niño seleccionado activamente), `drawDate` y `ticketPrice` (20,00 €).
  - **Batería de Pruebas Unitarias Exhaustiva (`selaeBarcodeParser.test.ts`):** Verificación de los tres décimos reales de producción (`5102502115>0493073567`, `5002001002>0880082456`, `5102607065>0023205830`), variantes con identificadores AIM GS1 (`]C1`) y prefijos alternativos.

### Fixed
- **Gráfico Donut SVG Sólido con Arcos Continuos sin Solapamiento (`OwnershipBreakdownCard.tsx`, `ownershipSegments.ts`):**
  - **Sustitución de Trazos Discontinuos por Arcos Sólidos:** Reemplazados los 50 segmentos radiales ("rayitas") por un anillo Donut continuo y estilizado dibujado mediante elementos `<circle>` SVG (`viewBox="0 0 160 160"`, centro `(80, 80)`, radio `r = 62` y grosor `strokeWidth="15"`).
  - **Cálculo Exacto con `strokeDasharray` y `strokeDashoffset`:**
    - Círculo base completo (`100%`) en gris suave (`#E5E7EB`) representando cuotas no asignadas o disponibles.
    - Arcos sólidos continuos (`strokeLinecap="butt"`, rotados `-90°` para iniciar a las 12 en punto) por cada categoría con porcentaje `> 0`, acumulando el desplazamiento exacto sin solapamiento:
      - **Propietario** (`#2E6146`): longitud `(ownerPercent / 100) * circumference`, `strokeDashoffset={0}`.
      - **Cotitulares** (`#2563EB`): longitud `(coOwnersPercent / 100) * circumference`, `strokeDashoffset={-ownerLength}`.
      - **Pendientes** (`#D97706`): longitud `(pendingPercent / 100) * circumference`, `strokeDashoffset={-(ownerLength + coOwnersLength)}`.
  - **Animación Fluida:** Añadida clase `transition-all duration-500 ease-out` a los arcos para transiciones suaves al actualizar cuotas o canjear participaciones.
  - **Preservación Integral:** Mantenidos intactos el texto central (`X% DISTRIBUIDO`), la leyenda inferior y la privacidad de invitaciones pendientes cuando `!isOwner`.
  - **Cobertura de Pruebas Unitarias (`ownershipDonutSegments.test.ts`):** Verificación de cálculos de arcos, offsets continuos, circunferencias y omisión de categorías con 0%.

## [1.0.36] - 2026-11-19

### Fixed
- **Preservación de Pestaña Activa al Retroceder desde Detalle de Décimo (`TicketsPage.tsx`, `TicketDetailPage.tsx`, `useSearchParams.ts`, `useAndroidBackNavigation.ts`):**
  - **Sincronización de Pestaña con URL (`?tab=...`):** Creado hook ligero `useSearchParams` (`src/hooks/useSearchParams.ts`) para sincronizar reactivamente la pestaña activa (**Décimos**, **Participaciones**, **Archivados**) con `window.location.search` (`/?tab=participaciones` y `/?tab=archivados`).
  - **Actualización sin Contaminación del Historial:** La selección de pestañas actualiza el parámetro mediante `{ replace: true }` y almacena `fromTab` y `subTab` en el estado de historial, evitando entradas redundantes en la pila del navegador.
  - **Respaldo Explícito en Selección de Décimo:** Al abrir la ficha de un décimo, `TicketsPage` transmite `state: { fromTab: activeTab }` en `navigateTo`.
  - **Retorno Preciso y Unificado (`handleBack` en `TicketDetailPage`):**
    - Con historial previo (`idx > 0`): invoca `onBack()` / `window.history.back()`, restaurando la URL anterior (`/?tab=participaciones` o `/?tab=archivados`) e igualando el comportamiento del botón superior de interfaz con el botón/gesto físico Atrás de Android.
    - En accesos directos sin historial (`idx === 0` / cold start / push): deriva automáticamente a `/?tab=participaciones` si el usuario autenticado es cotitular (`owner_id !== user.id`) o a `/` si es el propietario.
  - **Batería de Pruebas Unitarias (`activeTabBackNavigation.test.ts`):** Verificación de resolución de pestañas con URL params, fallbacks de historial y derivación de retorno según rol.

## [1.0.35] - 2026-11-19

### Added
- **Deep-Linking Directo al Décimo desde Notificaciones Web Push en Android (`send-push` v3, `push-sw.js`, `AppShell.tsx`, `useAndroidBackNavigation.ts`):**
  - **Inclusión de `ticket_id` y `notification_id` en el Payload:** Actualizada la Edge Function `send-push` (v3) y el trigger de base de datos `trigger_send_push_notification` para resolver el identificador de décimo (desde `NEW.ticket_id` o `metadata->>'ticket_id'`) y construir la URL canónica directa `/billetes/:id` (con fallback a `/alertas`), empaquetando `ticketId`, `ticket_id`, `notificationId` y `notification_id` en las opciones de notificación Web Push.
  - **Soporte de Navegación en Service Worker (`public/push-sw.js`):** Gestionado tanto el arranque en frío (`clients.openWindow(fullUrl)`) como la app activa o en segundo plano (`matchingClient.focus()` + `matchingClient.postMessage` + `matchingClient.navigate(fullUrl)`).
  - **Recepción React y Marcado Silencioso en `AppShell.tsx`:** Añadido listener de `navigator.serviceWorker` para el mensaje `PUSH_NOTIFICATION_CLICK`. Permite navegación instantánea mediante `navigateTo` y marcado de lectura automático y silencioso en Supabase (`is_read = true`) para la notificación pulsada.
  - **Resolución Universal de Rutas y Alias (`parseRouteFromPath` en `useAndroidBackNavigation.ts`):** Soporte en el arranque de la PWA para rutas de décimos en plural, singular e inglés (`/billetes/:id`, `/billete/:id`, `/decimos/:id`, `/decimo/:id`, `/tickets/:id`, `/ticket/:id`), extrayendo el ID limpio y abriendo `TicketDetailPage` directamente con compatibilidad total con el botón Atrás de Android.
  - **Cobertura de Pruebas Unitarias (`pushDeeplinkRouting.test.ts`):** Verificación automatizada de resolución de URLs absolutas, relativas, alias, query params y hashes.

## [1.0.34] - 2026-11-19

### Fixed
- **Gráfico Donut Segmentado de Alta Precisión sin Solapamiento (`OwnershipBreakdownCard.tsx`, `ownershipSegments.ts`):**
  - **Eliminación del Solapamiento de Trazos Naranjas:** Sustituidos los arcos continuos y discontinuos `<circle>` superpuestos por un anillo de 50 segmentos radiales discretos (`<line>`) distribuidos uniformemente cada 7,2° alrededor del centro, comenzando a las 12 en punto (-90°).
  - **Asignación Determinista y Exclusiva de Color:** Cada segmento radial se evalúa en función de su cuota proporcional:
    - Verde corporativo (`#2E6146`) para el Propietario.
    - Azul (`#2563EB`) para Cotitulares aceptados.
    - Naranja / Ámbar (`#D97706`) para Invitaciones pendientes (o segmento neutro en vista de cotitular).
    - Gris suave (`#E5E7EB`) para el remanente disponible / sin asignar.
  - **Garantía de Visibilidad de Cuotas Mínimas:** Implementado algoritmo proporcional con suelo de 1 segmento para cualquier tramo `> 0`, evitando mezclas cromáticas entre secciones y garantizando trazos limpios, estables y continuos.
  - **Módulo y Cobertura de Pruebas (`ownershipSegments.ts`):** Extraída la lógica pura de cálculo geométrico con pruebas unitarias exhaustivas en `ownershipDonutSegments.test.ts`.

## [1.0.33] - 2026-11-19

### Fixed
- **Reparación Integral del Pipeline de Entrega Web Push en Android (`send-push`, `public/push-sw.js`, `pushNotifications.ts`):**
  - **Corrección de Error 401 en Trigger PostgreSQL (`trigger_send_push_notification`):** Inyectadas las cabeceras `apikey` y `Authorization: Bearer <anon_key>` en `net.http_post` (`pg_net`) para autenticar ante Kong/API Gateway de Supabase, resolviendo el bloqueo permanente donde las notificaciones creadas en base de datos nunca alcanzaban la Edge Function `send-push`. Omitidos registros de tipo `PUSH_TEST` en el trigger para evitar duplicidades.
  - **Sincronización Silenciosa de Suscripciones en el Cliente (`syncPushSubscription`):** Creado el módulo `src/lib/pushNotifications.ts` con gestión unificada de claves VAPID, detección de plataforma y resincronización automática de `registration.pushManager.getSubscription()` en `AppShell.tsx` tras el inicio de sesión o apertura de la PWA cuando `Notification.permission === 'granted'`.
  - **Blindaje del Service Worker (`push-sw.js`):** Estandarizados los iconos y badges a `/pwa-192x192.png`, resolución de URLs absolutas con `new URL(targetUrl, self.location.origin).href` y navegación inteligente en `notificationclick` con apertura o enfoque condicional a `/alertas`.
  - **Mejora del Botón de Prueba en Perfil (`ProfilePage.tsx`):** Verificación previa de permisos en el sistema operativo, resincronización activa de la suscripción antes del envío y feedback verídico sin falsos positivos mostrando el número exacto de dispositivos alcanzados o el motivo técnico de error.
  - **Actualización de la Edge Function (`send-push` v2):** Despacho firmado a todas las suscripciones activas del usuario, auto-limpieza de suscripciones revocadas (HTTP 404/410) y respuesta estructurada `{ success, sent, failed, errors, deactivatedCount }`.
  - **Vista de Compatibilidad en Base de Datos:** Creada la vista `public.push_subscriptions` sobre `public.web_push_subscriptions` con `security_invoker = on`.

## [1.0.32] - 2026-11-19

### Changed
- **Simplificación de la Navegación Principal y Centralización de Auditoría (`AppShell.tsx`, `ProfilePage.tsx`, `AuditPage.tsx`):**
  - Simplificado el menú de navegación (`NAV_ITEMS`) tanto en escritorio como en la barra inferior móvil, reduciéndolo a las 2 secciones esenciales de uso frecuente: **Billetes** (`/`) y **Alertas** (`/alertas` con contador en tiempo real de notificaciones no leídas).
  - Integrado indicador visual activo en el botón de usuario de la cabecera (`isProfileActive` con sutil anillo `ring-1 ring-[#2E6146]/30` y fondo `bg-[#2E6146]/[0.08]`) al encontrarse en las vistas de Perfil o Auditoría.
  - Movido el acceso al **Centro de Auditoría y Trazabilidad** dentro de la pantalla de **Perfil** (`ProfilePage.tsx`) a través de una tarjeta interactiva destacada con icono de garantía criptográfica (`ShieldCheck`), chevron de navegación y descripción detallada.
  - Añadido botón de retorno *"Volver a Perfil"* en la parte superior de `AuditPage.tsx` para una transición fluida entre ambas secciones.
  - Preservada la ruta canónica `/auditoria` y compatibilidad total con el historial de navegación hacia atrás en Android.

## [1.0.31] - 2026-11-19

### Added
- **Navegación Adaptativa Híbrida Escritorio y Móvil (`AppShell.tsx` y `TicketsPage.tsx`):**
  - Unificada la estructura de secciones (`NAV_ITEMS`) con las 4 rutas clave (`Billetes`, `Alertas`, `Auditoría` y `Perfil`).
  - Implementada barra de navegación horizontal en la cabecera para pantallas de escritorio (`md:flex` en `<header>`), con iconos de 16 px, etiquetas en línea, estado activo en verde corporativo y contador dinámico de alertas no leídas.
  - Ocultada la barra de navegación inferior en escritorio (`md:hidden`) preservando la barra flotante exclusivamente en dispositivos móviles (`< 768px`).
  - Ajustado el relleno inferior general (`pb-24 md:pb-10`) y la posición flotante de avisos y toasts (`bottom-20 md:bottom-6`), eliminando el espacio inferior sobrante en navegadores de PC y Mac.

## [1.0.30] - 2026-11-19

### Removed
- **Eliminación de la Campana de Alertas en Cabecera de Billetes (`TicketsPage.tsx` y `AppShell.tsx`):**
  - Eliminado el botón flotante de campana (`Bell`) y su badge de no leídas de la tarjeta superior de la pantalla principal, suprimiendo la duplicidad visual con la pestaña permanente de **Alertas** en la barra inferior móvil.
  - Limpiadas las consultas redundantes de conteo de notificaciones (`checkAlerts`), estados y propiedades sin uso en `TicketsPage.tsx`.

## [1.0.29] - 2026-11-19

### Changed
- **Centralización de Cierre de Sesión y Optimización de Cabecera (`AppShell.tsx` y `ProfilePage.tsx`):**
  - Eliminado el botón «Salir» de la cabecera superior fija para evitar pulsaciones accidentales en pantallas táctiles móviles.
  - Expandido el botón táctil del usuario en la cabecera para ocupar todo el ancho disponible (`w-full`), mejorando la legibilidad del nombre, correo y avatar.
  - Centralizada la acción de cierre de sesión en la pantalla de **Perfil** (`ProfilePage.tsx`) con botón dedicado con icono `LogOut`, estilo de advertencia diferenciado en rojo suave, confirmación previa y estado de carga durante el proceso de salida.

## [1.0.28] - 2026-11-19

### Added
- **Selector Dual Cámara / Galería para Foto de Perfil (`ProfilePage.tsx`):**
  - Implementado menú inferior (*Action Sheet / Bottom Sheet*) al tocar el círculo del avatar o la insignia de cámara, con jerarquía `z-50`, fondo oscurecido, margen seguro `safe-area-inset-bottom` y gestión del botón Atrás de Android con `useModalBackHandler`.
  - Doble input de archivo desacoplado:
    - `cameraInputRef`: input con `capture="user"` para abrir directamente la cámara fotográfica del móvil.
    - `galleryInputRef`: input estándar para explorar la galería o archivos guardados en el dispositivo.
  - Opción contextual para eliminar la foto actual (`handleRemoveAvatar`) restableciendo el avatar por defecto.
  - Actualizado el texto descriptivo inferior: *"Toca para hacerte una foto o elegir de la galería"*.

## [1.0.27] - 2026-11-19

### Fixed
- **Ajuste Visual de la Cabecera de Billetes Compartidos (`TicketsPage.tsx`):**
  - Eliminado el subtítulo redundante *"MisDecimos · Trazabilidad Asegurada"* de la tarjeta superior de la pantalla principal.
  - Alineada verticalmente la fila del título *"Mis Billetes Compartidos"* y el botón de notificaciones (`flex items-center justify-between gap-3`), logrando un espaciado más limpio y compacto antes del panel de métricas.

## [1.0.26] - 2026-11-19

### Added
- **Acceso Rápido a Perfil desde el Avatar de Cabecera (`AppShell.tsx`):**
  - Convertido el bloque de usuario de la cabecera superior (avatar circular de 40 px, nombre y correo) en un control táctil accesible (`button[type="button"]`) con feedback de interacción (`hover:bg-black/[0.03]`, `active:scale-[0.98]`).
  - Navegación directa a la pantalla de **Perfil** (`/perfil`) preservando el historial para el botón Atrás nativo de Android y navegadores.
  - Comportamiento de desplazamiento suave (*smooth scroll to top*) cuando el usuario ya se encuentra en `/perfil`.
  - Aislamiento completo del botón lateral *"Salir"* para evitar eventos anidados o clics accidentales.

## [1.0.25] - 2026-11-19

### Fixed
- **Ciclo de Vida de Cámara y Recuperación Automática de Segundo Plano (`BarcodeScannerModal.tsx`):**
  - **Estabilización de Dependencias:** Guardados callbacks externos (`onScanSuccess`, `onClose`) en `useRef` para que el efecto de activación dependa exclusivamente de `isOpen`, eliminando reinicios no deseados o fallos espurios al mover el dispositivo, reorientar la pantalla o recibir re-renders del componente padre.
  - **Limpieza Profunda de Hardware (`forceReleaseCamera`):** Detención y limpieza de `Html5Qrcode` con parada explícita e iteración sobre todos los elementos `<video>` del DOM para detener todas sus pistas `MediaStreamTrack` (`track.stop()`) y desacoplar `srcObject`, garantizando la liberación total del sensor físico en Android.
  - **Gestión Automática de Segundo Plano (`visibilitychange`):** Suspensión silenciosa de la cámara al minimizar la PWA o apagar la pantalla (`hidden`), y reactivación automática transparente al regresar (`visible`) tras 350 ms de estabilización de hardware.
  - **Supervisión de Interrupciones de SO (`track.onended` / `track.onmute`):** Detección proactiva de cortes del flujo por parte del sistema operativo para relanzar la sesión limpia sin dejar fotogramas congelados.
  - **Reintento Inteligente y Diagnóstico Visual:** Hasta 2 reintentos automáticos separados por 450 ms ante errores transitorios (`NotReadableError`, `AbortError`). Ocultación del visor congelado en caso de error y ejecución garantizada de `forceReleaseCamera` al pulsar *"Reintentar cámara"*.

## [1.0.24] - 2026-11-19

### Added
- **Escáner de Cámara Inteligente y Polimórfico (`scanPayloadClassifier.ts` y `BarcodeScannerModal.tsx`):**
  - Creado clasificador puro `classifyScannedPayload` capaz de identificar y enrutar polimórficamente:
    - Códigos QR de invitaciones/participaciones: URLs completas (`/invite/`, `/claim/`, `/reclamar/`, parámetros de consulta `token`, `code`, `invite`), identificadores UUID, tokens directos y códigos PIN alfanuméricos de 6 caracteres.
    - Códigos de barras 1D de décimos SELAE: desglose oficial de 20 dígitos (`51`/`01` + sorteo + fracción + serie + número) o números directos de 5 dígitos con alta confianza (`parseSelaeBarcode`).
    - Cargas útiles JSON con claves de invitación (`inviteCode`, `token`, `pin`).
  - Habilitados formatos 1D y 2D simultáneos (`CODE_128`, `ITF`, `EAN_13`, `CODE_39`, `QR_CODE`) en `BarcodeScannerModal` tanto para la cámara en vivo como para la subida de imágenes desde galería.
  - Diseñada guía visual unificada con láser de escaneo que abarca cómodamente tanto códigos de barras horizontales como códigos QR cuadrados.
  - Sistema de aviso inline no intrusivo (`warningMsg`) ante códigos no reconocidos: la cámara no se interrumpe ni se cierra, permitiendo al usuario reorientar la cámara hacia el décimo o QR sin fricción.
- **Enrutamiento Automático Multimodal (`TicketsPage.tsx`, `TicketFormModal.tsx` y `InviteClaimModal.tsx`):**
  - Si el usuario escanea un código QR desde el botón de añadir décimo, la aplicación detecta automáticamente la invitación y abre de inmediato `InviteClaimModal` precargando y verificando el código.
  - Soporte recíproco: si se escanea un código de barras de décimo desde el escáner de invitaciones, la app lo detecta y redirige a `TicketFormModal` precargando número, serie, fracción y sorteo.
  - Suite de pruebas unitarias exhaustiva (`scanPayloadClassifier.test.ts`) cubriendo 25 aserciones de detección y robustez.

## [1.0.23] - 2026-11-19

### Fixed
- **Detección Avanzada de PWA Instalada y Optimización Anti-Redundancia (`usePwaInstallPrompt.ts` y `PwaInstallBanner.tsx`):**
  - Añadido soporte para `navigator.getInstalledRelatedApps()` asíncrono e integrado `"id": "/"` y `"related_applications"` en `vite.config.ts` y `public/manifest.webmanifest`.
  - Suprimida la visualización automática de la guía manual (tres puntos) en navegadores Chromium cuando `deferredPrompt` es `null`, evitando falsos avisos cuando la app ya está instalada.
  - Unificados los botones inferiores del modal en una única acción clara (*«Instalar aplicación»* con `deferredPrompt` o *«Entendido»* en guías manuales) acompañada de *«No volver a mostrar»*, guardando el flag `misdecimos_pwa_prompt_dismissed` en `localStorage` con un solo clic.
- **Feedback Instantáneo (0 ms) y Cierre Inmediato al Reclamar Participación (`InviteClaimModal.tsx` y `TicketsPage.tsx`):**
  - Estado de carga inmediato (`isSubmitting`) al pulsar *«Reclamar X%»* o *«Rechazar participación»*, deshabilitando todos los controles y mostrando el spinner *"Reclamando..."* / *"Rechazando..."*.
  - Eliminados los `setTimeout` y pantallas intermedias dentro del modal, ejecutando el cierre inmediato (`onClose()`) tras la respuesta exitosa de la RPC y actualizando los datos en segundo plano (`loadTickets()`).
  - Toast verde de confirmación en la pantalla principal (*"¡Participación del X% añadida a tus billetes!"* o *"Invitación rechazada"*).

## [1.0.22] - 2026-11-19

### Security
- **Privacidad Estricta de Invitaciones Pendientes en Base de Datos y UI (`pending_invites`):**
  - **Endurecimiento de RLS (`20261119000003_restrict_pending_invites_to_owner.sql`):** Reemplazada la política `pending_invites_select` en PostgreSQL para que únicamente puedan consultar filas el propietario del décimo (`created_by = auth.uid() OR is_ticket_owner(ticket_id)`) y el usuario que ya aceptó dicha invitación (`accepted_by_user_id = auth.uid()`).
  - **Aislamiento en `TicketDetailPage.tsx`:** Si el usuario no es el propietario del décimo (`ticket.owner_id !== user.id`), no se solicitan ni transmiten invitaciones pendientes (`pendingInvites = []`).
  - **Aislamiento en `OwnershipBreakdownCard.tsx`:** Las tarjetas amarillas de invitaciones pendientes, los códigos PIN de 6 dígitos, y los botones *"Ver QR / Compartir"*, *"Eliminar"* y *"Cancelar todas las pendientes"* solo se renderizan si `isOwner === true`.
  - **Vista Neutra Agregada en Donut y Leyenda:** Para cotitulares terceros (`!isOwner`), las cuotas no asignadas o pendientes se visualizan como un segmento agregado neutro (*"Sin asignar / Pendiente (X%)"*), sin exponer ningún detalle, nombre, PIN ni código QR de invitaciones pendientes.

## [1.0.21] - 2026-11-19

### Fixed
- **Exclusión Estricta de Participaciones Renunciadas en Billetes Activos y Totales (`ticketMetrics.ts` y `TicketsPage.tsx`):**
  - Creado el módulo puro `ticketMetrics.ts` con la función `classifyUserTickets` para asegurar que las participaciones donde el usuario no es propietario y su cuota está en `status === 'RENUNCIADA'` (o `percentage <= 0`) queden estrictamente excluidas de:
    - El contador superior **BILLETES ACTIVOS** (`totalActivosCount`).
    - El sumatorio de premios **TOTAL PREMIOS** (`totalPremiosGanados`).
    - La pestaña de listado **Mis Participaciones** (`misParticipaciones`).
    - La pestaña de listado **Archivados** (`misArchivados`).
  - Mantenida la inmutabilidad y persistencia de eventos en el registro de auditoría (`audit_events`) y la visibilidad de la cuota reintegrada al 100% en el panel del custodio propietario.
  - Añadida suite completa de pruebas unitarias (`ticketMetrics.test.ts`) validando los escenarios de cálculo, renuncia voluntaria y filtrado reactivo.

## [1.0.20] - 2026-11-19

### Fixed
- **Estructura Exacta 2 + 3 + 2 + 3 + 6 + 4 en Código de Barras SELAE (`selaeBarcodeParser.ts`):**
  - Implementado el desglose canónico oficial de 20 dígitos verificado en billetes físicos de Lotería Nacional:
    - `Prefijo de juego (2 dígitos):` `51` (Navidad / El Niño) o `01` (estándar).
    - `Código sorteo / año (3 dígitos, pos 2..5):` `drawYearCode` (ej. `026` → año 2026).
    - `Fracción (2 dígitos, pos 5..7):` `fraction` / `fraccion` (ej. `07` → 7ª).
    - `Serie (3 dígitos, pos 7..10):` `series` / `serie` (ej. `065` → 65ª).
    - `Número del décimo (6 dígitos, pos 10..16):` número de 6 dígitos con 0 inicial, extrayendo los 5 últimos con `.slice(-5)` (ej. `002320` → `02320`, `087671` → `87671`).
    - `Dígitos de control (4 dígitos, pos 16..20):` `checkDigits` (ej. `5830`, `9833`).
  - Limpieza exhaustiva de caracteres no numéricos (`raw.replace(/\D/g, '')`), eliminando separadores como `>` o prefijos AIM GS1 (`]C1`).
  - Actualizada la suite de pruebas unitarias (`selaeBarcodeParser.test.ts`) validando los dos códigos reales de producción (`5102607065>0023205830` y `51020101100876719833`).

## [1.0.19] - 2026-11-19

### Fixed
- **Padding Vertical y Safe-Area en Cabecera Superior (`AppShell.tsx`):**
  - Eliminada la altura fija restrictiva (`h-15`) y aplicado padding vertical dinámico `pt-[calc(0.875rem+env(safe-area-inset-top))] pb-3.5 px-4 sm:px-6`.
  - Asegurada una separación superior mínima garantizada de 14 px (`0.875rem`) en pantallas de escritorio y dispositivos móviles sin notch (donde `safe-area-inset-top` reporta `0px`), eliminando la sensación de encajonamiento vertical del avatar.
  - Incrementado el tamaño del avatar del usuario a `w-10 h-10` (40x40 px) con sombra suave y separación clara de 14 px (`gap-3.5`) respecto al bloque de nombre y correo.
  - Ajustado el botón *"Salir"* con centrado vertical y proporciones táctiles ergonómicas (`shrink-0 px-3 py-2 rounded-xl flex items-center gap-1.5`).

## [1.0.18] - 2026-11-19

### Fixed
- **Prevención de Cierre en Cascada por Popstate (`useModalBackHandler.ts`):**
  - Implementada una pila global de modales activos (`activeModalStack`) y un contador de llamadas programáticas (`programmaticBackCount`).
  - Cuando un modal hijo (como `BarcodeScannerModal`) se cierra por código al escanear exitosamente o por interfaz, su `window.history.back()` es absorbido por el contador sin disparar eventos de cierre sobre el modal padre (`TicketFormModal`).
  - Solo el modal situado en la cima de la pila (`activeModalStack`) responde a la pulsación física del botón 'Atrás' de Android.
- **Handoff Completo desde Botón Rápido de Cámara (`TicketsPage.tsx` y `TicketFormModal.tsx`):**
  - Al pulsar el botón cuadrado verde de cámara en `TicketsPage`, se abre de forma directa `BarcodeScannerModal` en modo `TICKET_BARCODE`.
  - Al detectar el código, se cierra el escáner y se abre inmediatamente `TicketFormModal` en la pestaña de datos manuales (`initialTab="manual"`), pasándole la prop `initialScannedData`.
  - Los campos (número, serie, fracción, sorteo y fecha) se rellenan automáticamente mostrando el banner verde *"Código leído correctamente — Verifica los datos antes de guardar"*.
  - Si el usuario abre el escáner desde dentro de `TicketFormModal`, el modal permanece abierto en pantalla con todos los campos completados al finalizar la lectura.

## [1.0.17] - 2026-11-19

### Added
- **Instalador y Guía PWA Multiplataforma (`usePwaInstallPrompt.ts` y `PwaInstallBanner.tsx`):**
  - Implementado sistema de instalación contextual e inteligente para navegadores móviles y de escritorio (Android, iOS/iPadOS, macOS Safari y navegadores basados en Chromium / otros).
  - **Detección Standalone Completa:** Verifica `display-mode: standalone`, `navigator.standalone === true`, referrers de Android app y persistencia local `misdecimos_pwa_installed` para omitir avisos automáticos si la app ya fue instalada.
  - **Adaptación Visual por Plataforma:**
    - **Chromium / Android:** Captura global de `beforeinstallprompt` y botón de instalación nativa en un solo clic con `deferredPrompt.prompt()`.
    - **iOS / iPadOS:** Guía visual interactiva paso a paso con iconos de compartir (`Share`), añadir a pantalla de inicio (`PlusSquare`) y confirmación.
    - **macOS Safari:** Instrucciones claras para añadir la aplicación al Dock desde el menú Archivo o botón Compartir de Safari.
    - **Escritorio Otros:** Orientación para instalar desde el icono de la barra de direcciones o menú del navegador.
  - **Control de Frecuencia Estricto (Máximo 3 Avisos):**
    - Se activa tras 2,5 segundos al cargar la app.
    - Máximo 1 aviso por sesión (`sessionStorage`).
    - Límite estricto de 3 cancelaciones en `localStorage` (`misdecimos_pwa_install_prompt_count`). Al alcanzar 3 o descartar, nunca más se muestra automáticamente.
  - **Coordinación con PushPermissionModal:** Exclusión mutua que impide que el instalador PWA y el modal de notificaciones push se abran a la vez.
  - **Acceso Manual en Perfil (`ProfilePage.tsx`):** Botón *"Instalar aplicación en tu dispositivo"* siempre disponible, que abre el sheet correspondiente sin restricciones de frecuencia.
  - **Tests Unitarios Automatizados (`pwaInstallPrompt.test.ts`):** Cobertura de detección de plataformas, gestión de contadores y comprobación de modo standalone.

## [1.0.16] - 2026-11-19

### Fixed
- **Corrección de Offset en Extracción de Número SELAE (`src/lib/selaeBarcodeParser.ts`):**
  - Solucionado el fallo que provocaba que al escanear un código de barras de 20 dígitos de SELAE (ej. `51020101100876719833`) se asignase erróneamente `02010` (código del sorteo) como número del décimo.
  - Implementada la extracción matemática exacta de la especificación estándar de SELAE:
    - Prefijo del juego: 2 dígitos (`51` o `01`).
    - Código de sorteo: 5 dígitos (posiciones 2..7, ej. `02010`).
    - Fracción: 2 dígitos (posiciones 7..9, ej. `11`).
    - Serie: 3 dígitos (posiciones 9..12, ej. `008`).
    - Número del décimo: 5 dígitos (posiciones 12..17, ej. `76719`).
    - Dígitos de control: 3 dígitos (posiciones 17..20, ej. `833`).
  - Empleo de la regex canónica `/(?:51|01)(\d{5})(\d{2})(\d{3})(\d{5})(\d{3})/` extrayendo el número real en el grupo 4, la fracción en el grupo 2 y la serie en el grupo 3.
  - Compatibilidad de propiedades duales (`number`/`ticketNumber`, `serie`/`series`, `fraccion`/`fraction`).
  - Eliminación de fallbacks hardcoded ficticios: ante códigos no reconocidos, devuelve `isValid: false`, `number: ''` y un mensaje descriptivo en `errorMessage`.
  - Añadida suite de pruebas unitarias automatizadas (`src/lib/__tests__/selaeBarcodeParser.test.ts`) con 6 tests verificados vía `npm test`.

### Added
- **Banner de Confirmación Post-Escaneo (`TicketFormModal.tsx`):**
  - Tras escanear satisfactoriamente un décimo, el modal cambia automáticamente a la pestaña de datos manuales con todos los campos cumplimentados y muestra un banner en verde esmeralda: *"Código leído correctamente — Verifica los datos antes de guardar"*.

## [1.0.15] - 2026-11-19

### Added
- **Onboarding Inteligente de Permisos Push (`usePushPermissionPrompt.ts`):**
  - Implementado sistema no intrusivo para la solicitud de permisos Web Push en PWA.
  - **Disparador 1 (Primera entrada):** Se abre automáticamente a los 1,5 segundos de cargar la app si el usuario no tiene permisos activos y el contador de descartes es 0 (`dismissals === 0`).
  - **Disparador 2 (Notificación no leída):** Se abre contextualizado si el usuario tiene alertas sin leer (`unreadCount > 0`), no tiene push activo y `dismissals < 3`.
  - **Límite Estricto de 3 Cancelaciones:** Al alcanzar 3 descartes o si el permiso fue denegado en el navegador (`denied`), nunca más se vuelve a molestar al usuario con diálogos automáticos.
- **Modal Adaptado a Móvil y Aviso de Gestión en Perfil (`PushPermissionModal.tsx`):**
  - Modal accesible (`z-50` sobre `BottomNav` con soporte de botón Atrás nativo) detallando los beneficios de recibir alertas de participaciones, sorteos y premios.
  - Al descartar ("Ahora no" o botón `X`), incrementa `dismissals` en `+1` y muestra un aviso flotante durante 5 segundos informando que no recibirá notificaciones en ese dispositivo e incluyendo un acceso directo a **Perfil**.
  - Si el usuario activa manualmente las notificaciones push desde la pantalla de Perfil (`ProfilePage.tsx`), el contador de descartes se restablece automáticamente a 0.

## [1.0.14] - 2026-11-19

### Added
- **Renuncia Voluntaria de Participación por el Cotitular (`renounce_own_participation`):**
  - Implementada función RPC transaccional `SECURITY DEFINER` en PostgreSQL que permite a cualquier participante con cuota aceptada (`status = 'ACEPTADA'`, `role = 'PARTICIPANTE'`) renunciar voluntariamente a su porcentaje mientras el décimo no esté liquidado ni premiado pendiente de cobro.
  - Reintegración atómica e inmediata de la cuota al propietario registrador (`role = 'PROPIETARIO'`) garantizando la suma inmutable del 100,00% de la propiedad.
  - Marcado de la participación en estado `RENUNCIADA` con `0.00%`, resolución automática de solicitudes de renuncia previas y registro inmutable en `public.audit_events` (`RENUNCIA_VOLUNTARIA_PARTICIPANTE`).
  - Despacho automático de notificación interna y Web Push (`PARTICIPANT_WAIVED`) al custodio del décimo.
- **Botón y Diálogo de Confirmación en Interfaz (`OwnershipBreakdownCard.tsx`):**
  - Añadido el botón *"Renunciar a mi participación"* con icono `LogOut` en estilo suave rojo (`bg-rose-50 text-rose-700`) en la tarjeta del participante autenticado.
  - Diálogo modal de confirmación (`z-50` sobre `BottomNav`) con advertencia clara de irreversibilidad, cálculo del importe equivalente en euros y protección mediante `useModalBackHandler`.
- **Línea Temporal de Auditoría (`TicketAuditTimeline.tsx`):**
  - Soporte e icono temático para eventos de auditoría `RENUNCIA_VOLUNTARIA_PARTICIPANTE`.

## [1.0.13] - 2026-11-19

### Added
- **Gestión Nativa del Botón Atrás en Android y PWA (`useAndroidBackNavigation.ts`):**
  - Implementado gestor global del evento `window.onpopstate` que evita el cierre abrupto de la aplicación al pulsar el botón o gesto físico de retroceso en dispositivos móviles.
  - **Mecanismo Centinela en Ruta Raíz (`exitGuard`):** En la pantalla principal (`/`), se mantiene un estado centinela en `window.history`. Al pulsar "Atrás" por primera vez, se intercepta la salida, se muestra un aviso flotante y se abre una ventana de seguridad de 2,5 segundos.
  - **Toast Flotante de Confirmación de Cierre:** Notificación flotante elegante situada por encima de `BottomNav` (`z-50`) con el texto *"Pulsa atrás de nuevo para cerrar la aplicación"*. Si el usuario pulsa atrás por segunda vez dentro de los 2,5s, se permite la salida de la PWA; si no, el aviso se oculta y la guardia centinela se re-arma automáticamente.
  - **Retorno Natural en Rutas Secundarias:** En pantallas internas (`/alertas`, `/auditoria`, `/perfil`, `/billetes/:id`), pulsar Atrás regresa de manera fluida a la pantalla anterior mediante el historial (`idx > 0`). Si el usuario accedió por enlace profundo o notificación sin historial (`idx === 0`), redirige limpiamente a la raíz `/` en lugar de cerrar la aplicación.
- **Soporte de Botón Atrás para Diálogos Modales y Bottom Sheets (`useModalBackHandler.ts`):**
  - Cierre automático e individualizado al pulsar Atrás para todos los modales de la app: `TicketFormModal`, `CreateParticipationSheet`, `BarcodeScannerModal`, `ShareInviteModal`, `InviteClaimModal` y el modal de diagnóstico de `<VersionBadge />`.
  - Empuja un estado `{ modalOpen: true, modalKey }` al abrirse y lo retira limpiamente con `window.history.back()` si el usuario lo cierra mediante la interfaz (`X`, backdrop o botón cancelar), evitando desincronizaciones en la pila de historial.
- **Conservación de Historial en Navegación por Pestañas (`AppShell.tsx`):**
  - Eliminado el comportamiento `replace: true` en la barra inferior (`BottomNav`); cada cambio de sección genera una entrada en el historial de navegación para permitir una vuelta atrás consistente.

## [1.0.12] - 2026-11-19

### Fixed
- **Bloqueo de Comprobación Previa al Sorteo (`PrizeCheckCard.tsx`):**
  - Validación temporal contra la hora oficial de inicio del sorteo en hora peninsular española (`Europe/Madrid` CET): Navidad (22 de diciembre a las 09:00 CET) y El Niño (6 de enero a las 12:00 CET).
  - Si el sorteo aún no se ha celebrado (`now < drawStart`), se deshabilita el botón de comprobación con el texto *"Disponible el DD/MM/YYYY"* y el icono `CalendarClock`.
  - Reemplazo del recuadro *"Sin premio"* por una tarjeta informativa ámbar destacada: *"El sorteo aún no se ha realizado. Se celebrará el [fecha] (faltan X días). Podrás comprobar si tiene premio a partir de ese día."*
- **Blindaje en Backend / Edge Function (`check-prizes/index.ts`):**
  - Verificación estricta de la fecha y hora oficial de inicio en servidor. Si `now < drawStart`, devuelve código `DRAW_NOT_HELD_YET` sin mutar el estado del billete en la base de datos ni registrar auditorías erróneas.
  - Gestión defensiva de la API durante la celebración del sorteo: si la API responde con sorteo no concluido (`error: 1` o `status === 0`), devuelve código `DRAW_IN_PROGRESS` sin marcar el décimo como `VALIDADO` o sin premio.
- **Normalización de Base de Datos (`20261119000001_reset_future_validated_tickets.sql`):**
  - Migración aplicada en Supabase Cloud restableciendo a estado `PENDIENTE` todos los décimos de sorteos futuros que hubieran sido marcados indebidamente como `VALIDADO` con `prize_amount_cents = 0` en comprobaciones previas.
- **Soporte en Frontend (`prizeService.ts`):**
  - Actualizada la interfaz `CheckPrizeResult` con campos `ok`, `code` y `message` para notificar al usuario sobre estados previos o en curso del sorteo.


### Fixed
- **Botón de Cámara Ergonómico y Verde en Dashboard (`TicketsPage.tsx`):**
  - Ajustado el botón cuadrado de acceso rápido a la cámara a 54x54 px (`min-h-[54px] w-[54px]`) con fondo verde institucional `#2E6146` (`bg-[#2E6146] hover:bg-[#244d37]`) e icono `Camera` en blanco puro de 24 px (`w-6 h-6`, `strokeWidth={2.2}`).
  - Estilizado el botón principal izquierdo en fondo blanco con doble borde verde corporativo y altura idéntica de 54 px con el texto *"Añadir décimo manual"*.
- **Desbloqueo de Menú Contextual en Participantes Aceptados (`OwnershipBreakdownCard.tsx`):**
  - Eliminado `overflow-hidden` de las tarjetas de cotitulares para evitar el recorte del menú de opciones flotante (`...`).
  - Asignado dinámicamente `relative z-30` a la fila activa y `z-40` al desplegable flotante con posicionamiento `right-0 top-full mt-1.5 min-w-[200px]`.
  - Ampliada el área táctil del botón interno a `py-2.5 px-3.5` e implementado listener de cierre automático al hacer clic o tocar fuera (`mousedown` y `touchstart`).
- **Documentación de Pantallas (`docs/SCREENS_GUIDE.md`):** Actualizada la descripción de la botonera de Dashboard y del menú contextual en el cuadro de propiedad.

## [1.0.10] - 2026-11-19

### Fixed
- **Jerarquía `z-index` Global sobre `BottomNav` (`AppShell.tsx`):**
  - Ajustado el nivel de capa de la barra de navegación inferior (`BottomNav`) a `z-30` (igualado a la cabecera superior), asegurando que todos los modales y bottom sheets con `z-50` o superior cubran por completo toda la interfaz sin solapamientos.
- **Estructura Flex con Scroll Interno y Botón Fijo en `CreateParticipationSheet.tsx`:**
  - Rediseñada la tarjeta modal con altura dinámica `max-h-[88dvh] flex flex-col overflow-hidden` respetando las barras dinámicas del navegador móvil (Chrome/Safari).
  - Cabecera fija (`shrink-0`) con título, porcentaje disponible y botón de cierre.
  - Cuerpo central con scroll vertical interno suave (`flex-1 overflow-y-auto overscroll-contain px-5 py-4`).
  - Pie fijo de acción (`shrink-0 border-t border-gray-100 bg-white px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`) garantizando que el botón de confirmación permanezca visible y accesible en cualquier resolución y dispositivo.
- **Auditoría y Blindaje de Modales en Móvil:**
  - Aplicado el patrón `flex flex-col max-h-[90dvh]` con cuerpo `overflow-y-auto` y pie `shrink-0` con `env(safe-area-inset-bottom)` en `TicketFormModal.tsx`, `ShareInviteModal.tsx`, `InviteClaimModal.tsx` y `BarcodeScannerModal.tsx`.
- **Documentación de Pantallas (`docs/SCREENS_GUIDE.md`):** Actualizada la especificación de `BottomNav` y `<CreateParticipationSheet />`.

## [1.0.9] - 2026-11-16

### Added
- **Acceso Rápido a Escáner por Cámara en Dashboard (`TicketsPage.tsx`):**
  - Añadido un botón cuadrado `aspect-square` con icono `Camera` destacado a la derecha de la acción "Añadir décimo".
  - Al pulsar el botón de cámara, activa directamente el escáner de códigos GS1-128 con la cámara trasera sin pasos intermedios.
  - Soportada la prop `initialTab?: 'scanner' | 'manual'` en `TicketFormModal.tsx`, permitiendo abrir directamente en modo escáner inmediato o en modo datos manuales según el botón pulsado.
  - Elevado el índice de apilamiento en `BarcodeScannerModal.tsx` a `z-[60]` para garantizar prioridad visual absoluta sobre cualquier diálogo modal.
- **Documentación de Pantallas (`docs/SCREENS_GUIDE.md`):** Actualizada la descripción de la sección "Añadir un Décimo" con el botón principal verde y el botón rápido de cámara.

## [1.0.8] - 2026-11-16

### Changed
- **Auto-Actualización Silenciosa e Inmediata de la PWA (`vite.config.ts`, `VersionBadge.tsx`):**
  - Eliminado por completo el banner flotante de "Nueva versión disponible — Pulsa para actualizar y aplicar cambios".
  - Configurado `registerType: 'autoUpdate'` con `skipWaiting: true`, `clientsClaim: true` y `cleanupOutdatedCaches: true` en Workbox.
  - Implementada comprobación periódica de nuevas versiones cada 60 segundos y al recuperar el foco de la ventana (`visibilitychange`).
  - Añadido disparador automático de actualización en `onNeedRefresh()` (`updateServiceWorker(true)`) y recarga limpia transparente de una sola vez vía el listener `controllerchange` en `navigator.serviceWorker`.
  - Mantenido el modal de diagnóstico técnico y purga de caché manual en `<VersionBadge />`.
- **Documentación de Arquitectura y Pantallas (`docs/ARCHITECTURE.md`, `docs/SCREENS_GUIDE.md`, `AGENTS.md`):** Actualizados los documentos técnicos detallando el nuevo ciclo de vida de la PWA.

## [1.0.7] - 2026-11-16

### Changed
- **Pestaña "Partes iguales" como primera opción por defecto (`CreateParticipationSheet.tsx`):**
  - Invertido el orden visual de las pestañas en el selector superior: ahora *Partes iguales* se sitúa en la primera posición (izquierda) y *Porcentaje manual* en la segunda (derecha).
  - Inicialización inteligente del modo: si el custodio conserva el 100% de la cuota (sin participaciones previas), la hoja se abre automáticamente en *Partes iguales*; si ya existen participaciones parciales previas, conmuta de forma automática a *Porcentaje manual*.
  - En *Porcentaje manual*, se predetermina un valor inicial del 20% (o el máximo disponible) en lugar del 1%, adaptado al reparto habitual de participaciones.
- **Documentación de Pantallas (`docs/SCREENS_GUIDE.md`):** Actualizado el manual de pantallas reflejando la nueva disposición de pestañas y comportamiento por defecto de `<CreateParticipationSheet />`.

## [1.0.6] - 2026-11-16

### Fixed
- **Gestión de Invitaciones no Reclamadas en Décimos Validados (`OwnershipBreakdownCard.tsx`):**
  - Habilitado el botón visible **"Eliminar"** (con icono de papelera en rojo) en cada invitación `PENDIENTE` para el propietario sin importar si el décimo se encuentra en estado `PENDIENTE`, `VALIDADO` o `ARCHIVADO` (salvo `LIQUIDADO`), devolviendo de forma inmediata el `%` a la cuota del propietario.
  - Añadido el botón masivo **"Cancelar todas las pendientes (recuperar X%)"** cuando existen 2 o más invitaciones pendientes, ejecutando la nueva RPC atómica `cancel_all_pending_invites`.
  - Mantenido disponible el botón inferior **"Añadir participación"** tanto en estado `PENDIENTE` como en `VALIDADO` mientras el propietario conserve cuota libre.
- **Eliminación de Décimos Validados sin Terceros (`TicketDetailPage.tsx`):**
  - Habilitado el botón **"Eliminar décimo"** para el propietario tanto en estado `PENDIENTE` como en `VALIDADO` siempre que no existan cuotas de terceros con `status = 'ACEPTADA'`.
- **RPCs y Políticas RLS en Supabase:**
  - Creada y aplicada la migración `20261116000008_allow_cancel_invites_in_validated_tickets.sql` que flexibiliza `cancel_pending_invite` y define la función RPC `cancel_all_pending_invites(p_ticket_id UUID)`.

## [1.0.5] - 2026-11-16

### Changed
- **Exclusividad de Sorteos Extraordinarios (Navidad y El Niño):** Simplificado el selector de sorteos en `TicketFormModal.tsx` eliminando las opciones de Jueves y Sábado, dejando una cuadrícula limpia de 2 opciones: **Navidad** (`NAVIDAD`, fecha 22 de diciembre, 20,00 €) y **El Niño** (`EL_NINO`, fecha 6 de enero, 20,00 €).
- **Ajuste en Parser GS1-128 (`selaeBarcodeParser.ts`):** Restringido el tipado y clasificación automática de códigos de barras exclusivamente a `NAVIDAD` y `EL_NINO`, fijando el importe oficial de 20,00 €.
- **Migración de Plantillas de Sorteo (`draw_templates`):** Aplicada la migración `20261116000007_only_navidad_and_nino_templates.sql` desactivando cualquier plantilla ajena a Navidad y El Niño y asegurando que las plantillas oficiales se muestren con el motor vectorial realista nativo.
- **Actualización Normativa en Documentación:** Reflejada la exclusividad de sorteos en `docs/BUSINESS_RULES.md` y `docs/SCREENS_GUIDE.md`.

## [1.0.4] - 2026-11-16

### Fixed
- **Fallback Reactivo Anti-Imagen Rota en Décimo Realista (`RealisticTicketCard.tsx`):** Añadido estado reactivo `imageLoadError` con manejador `onError` en la etiqueta de imagen y reset por URL, garantizando que si una imagen de plantilla no existe o falla su carga, el componente conmuta de forma automática e imperceptible al diseño vectorial completo de Lotería Nacional (orla guilloché, capilla artística con sello digital, tipografía matricial y código GS1-128).
- **Limpieza de URLs en Plantillas de Sorteo (`draw_templates`):** Aplicada la migración `20261116000006_fix_draw_templates_urls.sql` en Supabase estableciendo `template_image_url = NULL` en las plantillas por defecto, asegurando renderizado vectorial instantáneo desde el primer milisegundo y eliminando peticiones HTTP 404 innecesarias.

## [1.0.3] - 2026-11-16

### Added
- **Manual Funcional de Pantallas (`docs/SCREENS_GUIDE.md`):** Documentación exhaustiva y detallada de cada pantalla, modal y control de la aplicación (Login OTP, AppShell, Dashboard de Billetes, Detalle con boleto realista, Cuadro de Propiedad Donut SVG, Comprobador de Premios con IRPF, Bandeja de Alertas, Centro de Auditoría y Perfil/PWA) con enlaces relativos directos a los componentes de código fuente.
- **Índice de Navegación Rápida en `README.md`:** Incorporadas dos tablas interactivas con enlaces relativos Markdown para acceso inmediato a la documentación/decisiones del proyecto y acceso directo al código por pantalla o módulo funcional.
- **Actualización de Normas Multi-Agente (`AGENTS.md`):** Inclusión de `docs/SCREENS_GUIDE.md` en el protocolo de revisión obligatoria previa a merge.

## [1.0.2] - 2026-11-16

### Fixed
- **Políticas RLS y Eliminación de Recursión Infinita (`tickets`, `ownership_shares`, `pending_invites`, `audit_events`):** Creadas las funciones auxiliares `SECURITY DEFINER` `public.user_can_access_ticket(p_ticket_id UUID)` e `is_ticket_owner(p_ticket_id UUID)` en la migración `20261116000005_fix_rls_and_create_ticket.sql`, rompiendo las referencias circulares cruzadas entre las políticas RLS que bloqueaban la lectura de billetes tras su inserción en PostgreSQL y provocaban el falso estado "Décimo no encontrado."
- **Extracción Defensiva de UUID en `TicketFormModal.tsx`:** Mejorada la validación del retorno de la RPC `create_ticket` para extraer con máxima robustez el identificador del décimo (string UUID u objeto) y mostrar cualquier excepción de Supabase en pantalla en lugar de navegar con identificador vacío.
- **Relaciones PostgREST en Detalle de Décimo (`TicketDetailPage.tsx`):** Explicitada la clave foránea `profiles!ownership_shares_user_id_fkey` en la carga de participaciones y añadido mensaje descriptivo de error en pantalla en caso de fallo de consulta.

## [1.0.1] - 2026-11-16

### Fixed
- **Login OTP Robusto (Email & Signup):** Reintento automático con `type: 'signup'` en `LoginPage.tsx` si `supabase.auth.verifyOtp` con `type: 'email'` falla en cuentas de usuario recién creadas sin confirmar, permitiendo validar códigos OTP de 6 dígitos tanto en el primer registro como en inicios de sesión sucesivos.
- **Versión Dinámica en Login:** Reemplazado el texto estático `v0.2.0` en el pie de página de `LoginPage.tsx` por la constante global dinámica `v${__APP_VERSION__}` sincronizada con `package.json`.
- **Optimización de Bundles Rollup (`manualChunks`):** Configurado `build.rollupOptions.output.manualChunks` en `vite.config.ts` segregando los paquetes en chunks independientes: `vendor-react` (`react`, `react-dom`, `scheduler`), `vendor-supabase` (`@supabase/supabase-js` y librerías cliente) y `vendor-scanner` (`html5-qrcode`, `qrcode.react`), eliminando el warning de chunks superiores a 500 kB en Vercel.

## [1.0.0] - 2026-11-15

### Summary
Lanzamiento oficial de producción de **MisDecimos (v1.0.0)** — Plataforma Mobile-First PWA para la gestión transparente, custodia compartida y liquidación de participaciones de Lotería Nacional (Navidad, El Niño y sorteos semanales).

### Features de Producción
- **Arquitectura Transaccional Robusta:**
  - 12 funciones RPC (`SECURITY DEFINER`) transaccionales y triggers automáticos en Supabase PostgreSQL.
  - Reglas inmutables: Custodia bloqueada ante terceros, inmutabilidad bilateral de cuotas, integridad matemática del 100% (cero huérfanos) y liquidación de premios unánime.
- **PWA & Web Push Nativo:**
  - Service Worker con auto-actualización anti-caché y soporte offline.
  - Notificaciones Web Push cifradas vía VAPID (`public/push-sw.js` + Edge Function `send-push` + `pg_net`).
  - Banner de instalación PWA optimizado para Android y guía paso a paso para iOS Safari.
- **Captura Multimodal y Billetes Realistas:**
  - Parser oficial GS1-128 / Code-128 de SELAE con normalización OCR.
  - Escáner con cámara trasera (`html5-qrcode`) y selector de imágenes.
  - Componente `<RealisticTicketCard />` con guilloche y sellos digitales.
- **Reparto de Participaciones e Invitaciones:**
  - Cuadro de propiedad con gráfico Donut SVG interactivo.
  - Reparto por porcentaje manual o partes iguales con absorción de redondeos.
  - Invitaciones QR dinámicas (`qrcode.react`), códigos de 6 dígitos y compartición por WhatsApp.
  - Flujo formal de solicitud y respuesta de renuncias.
- **Comprobación Oficial de Premios:**
  - Edge Function `check-prizes` conectada a endpoints oficiales de El País y SELAE con caché en memoria.
  - Componente `<PrizeCheckCard />` con desglose de premios proporcionales y confirmación de cobro.
- **Trazabilidad y Notificaciones:**
  - Bandeja interactiva `Mis Notificaciones` con marcas temporales `HH:mm - DD/MM`.
  - `Centro de Auditoría y Trazabilidad` con buscador y explorador cronológico global.
- **Optimización de Despliegue en Vercel:**
  - Configuración `vercel.json` con reescrituras SPA y cabeceras anti-caché estrictas para Service Workers y manifiesto.

## [0.6.0] - 2026-11-15

### Added
- **Infraestructura Web Push VAPID Nativa:**
  - Generación de claves criptográficas VAPID persistidas de forma segura en Supabase Secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) y variable `VITE_VAPID_PUBLIC_KEY` para clientes PWA.
  - Script Service Worker (`public/push-sw.js`) integrado mediante `workbox.importScripts` que gestiona eventos `push` con badge monocromo, vibración, iconos y eventos `notificationclick` para enfocar o abrir la PWA en la URL de destino.
- **Supabase Edge Function `send-push`:**
  - Desplegada y activa con `npm:web-push`:
    - Envío en segundo plano de alertas a dispositivos activos según preferencias de perfil (`profiles.push_enabled`).
    - Auto-limpieza y desactivación de endpoints caducados o revocados por el sistema operativo (errores 404/410).
    - Modo de prueba inmediata (`{ testPush: true }`) disparado desde el perfil.
- **Trigger Asíncrono de Notificaciones y RPC de Marcado Masivo:**
  - Migración `20261115000004_push_trigger_and_audit_helpers.sql`:
    - Trigger `AFTER INSERT ON public.notifications` que invoca asíncronamente `send-push` vía `pg_net` (`net.http_post`) sin bloquear transacciones de base de datos.
    - RPC `mark_all_notifications_read`: Marca de golpe todas las alertas del usuario autenticado como leídas y actualiza el contador global.
  - Botón "Enviar notificación de prueba" en la pantalla de Perfil.
- **Pantalla `Mis Notificaciones` (`AlertsPage.tsx`):**
  - Cabecera con botón verde "Leídas todas", contador en tiempo real y navegación atrás.
  - Tarjetas de alerta con marcas temporales `HH:mm - DD/MM`, iconos contextuales (`Info`, `Trophy`, `UserPlus`, `AlertTriangle`), distinción visual para alertas no leídas y navegación directa al billete.
  - Acciones interactivas en línea para solicitudes de renuncia (`WAIVER_REQUEST`) con botones de aceptación y rechazo directo sin salir de la bandeja.
- **Centro Global de Auditoría y Trazabilidad (`AuditPage.tsx`):**
  - Sello de garantía de inmutabilidad en PostgreSQL.
  - Bloque explicativo desplegable con las 4 Reglas de Seguridad y Transaccionalidad de MisDecimos (Custodia bloqueada, inmutabilidad bilateral, integridad matemática del 100% y liquidación verificada).
  - Buscador reactivo instantáneo por número, sorteo, usuario o código y chips de filtrado por categoría (`Todos`, `Décimos`, `Participaciones`, `Renuncias`, `Premios y Cobros`).
  - Feed cronológico global con accesos directos al detalle de cada décimo.

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
