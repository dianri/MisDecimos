# 🎟️ MisDecimos

**MisDecimos** es una plataforma Web PWA (Progressive Web App) diseñada para la gestión segura, custodia compartida, certificación legal y reparto transparente de participaciones de décimos de Lotería Nacional (sorteos extraordinarios oficiales de **Lotería de Navidad** y **El Niño**) entre amigos, familiares y peñas. Incluye **certificación legal de custodia** mediante Certificado Digital (**AutoFirma** / `.p12` / `.pfx`), **Firma Manuscrita** y generación de **Documento Legal PDF** unificado.

---

## 🗺️ Índice Rápido de Navegación

### 📚 Documentación y Decisiones del Proyecto

| Documento | Descripción |
| :--- | :--- |
| [Guía de Pantallas y Flujos de Usuario](./docs/SCREENS_GUIDE.md) | Qué hace cada vista, modal y botón de la aplicación. |
| [Reglas de Negocio y Decisiones Funcionales](./docs/BUSINESS_RULES.md) | Fórmulas de reparto, estados del décimo, renuncias y liquidación. |
| [Arquitectura Técnica y Base de Datos](./docs/ARCHITECTURE.md) | Esquema ER de las tablas, catálogo de RPCs, GS1-128 y Edge Functions. |
| [Estado del Proyecto y Roadmap](./docs/STATUS.md) | Fases completadas, versión activa y trazabilidad de releases. |
| [Reglas de Agentes y Git Flow](./AGENTS.md) | Normas de ingeniería, flujo Git estricto y concurrencia multi-agente. |
| [Historial de Versiones (Changelog)](./CHANGELOG.md) | Registro cronológico detallado de cambios por versión. |

### 🖥️ Acceso Directo al Código por Pantalla / Módulo

| Módulo / Pantalla | Componente / Archivo Fuente | Descripción |
| :--- | :--- | :--- |
| **Login y OTP** | [`src/pages/LoginPage.tsx`](./src/pages/LoginPage.tsx) · [`src/context/AuthContext.tsx`](./src/context/AuthContext.tsx) | Autenticación OTP por email, reintento `email`/`signup` y gestión de tokens. |
| **Shell y Navegación** | [`src/components/layout/AppShell.tsx`](./src/components/layout/AppShell.tsx) | Cabecera unificada con logotipo **4 MILLS**, BottomNav de 3 pestañas (`Décimos`, `Premios`, `Alertas`) y campana de alertas con punto de prioridad. |
| **Anti-Caché PWA** | [`src/components/common/VersionBadge.tsx`](./src/components/common/VersionBadge.tsx) | Badge visual dinámico, diagnóstico y purga de caché/SW en 1 clic. |
| **Dashboard (Décimos)** | [`src/pages/TicketsPage.tsx`](./src/pages/TicketsPage.tsx) | Listado unificado de **Décimos** y **Participaciones** activas con gestos swipe y botón flotante `Añadir`. |
| **Premios** | [`src/pages/PrizesPage.tsx`](./src/pages/PrizesPage.tsx) · [`src/components/tickets/PrizesHeroCard.tsx`](./src/components/tickets/PrizesHeroCard.tsx) | KPIs de *Décimos Activos* y *Total Premios* e historial de escrutinio (`Todos`, `Premiados`, `Sin premio`). |
| **Tarjeta de Listado** | [`src/components/tickets/TicketListItemCard.tsx`](./src/components/tickets/TicketListItemCard.tsx) | Ficha resumen con distintivo interactivo **`SIN FIRMAR` / `FIRMADO`** hacia `?tab=certification` y acciones rápidas (`Compartir`, `Comprobar sorteo`). |
| **Alta de Décimos** | [`src/components/tickets/TicketFormModal.tsx`](./src/components/tickets/TicketFormModal.tsx) | Modal de captura (manual vs escaneo) y llamada a RPC `create_ticket`. |
| **Escáner GS1-128 / QR** | [`src/components/tickets/BarcodeScannerModal.tsx`](./src/components/tickets/BarcodeScannerModal.tsx) · [`src/lib/selaeBarcodeParser.ts`](./src/lib/selaeBarcodeParser.ts) | Cámara con linterna, selector de foto y parser de códigos de SELAE. |
| **Canje de Invitaciones** | [`src/components/tickets/InviteClaimModal.tsx`](./src/components/tickets/InviteClaimModal.tsx) | Previsualización y asignación/rechazo de participaciones por código o QR. |
| **Detalle del Décimo** | [`src/pages/TicketDetailPage.tsx`](./src/pages/TicketDetailPage.tsx) | Vista de **3 pestañas** (`Reparto`, `Certificación Legal`, `Historial`) con custodia protegida. |
| **Boleto Realista** | [`src/components/tickets/RealisticTicketCard.tsx`](./src/components/tickets/RealisticTicketCard.tsx) | Boleto vectorial con `SELLO DIGITAL` interactivo (`SIN FIRMAR` / `FIRMADO`) hacia certificación y activador oculto de 5 toques en `NÚMERO / SERIE / FRACCIÓN`. |
| **Certificación Legal** | [`src/components/tickets/LegalCertificationTab.tsx`](./src/components/tickets/LegalCertificationTab.tsx) · [`src/components/tickets/TicketPhotoCaptureModal.tsx`](./src/components/tickets/TicketPhotoCaptureModal.tsx) | Pestaña unificada con prueba gráfica compartida (`SHA-256`), Certificado Digital, Firma Manuscrita desplegable, solicitud de firma al depositario y descarga de PDF único. |
| **Firma Electrónica y Trazos** | [`src/components/tickets/CertificateSignModal.tsx`](./src/components/tickets/CertificateSignModal.tsx) · [`src/components/tickets/SignaturePadCanvas.tsx`](./src/components/tickets/SignaturePadCanvas.tsx) | Modal de firma con AutoFirma (escritorio y móvil) o archivo `.p12 / .pfx` y lienzo táctil manuscrito. |
| **Criptografía y PDF Legal** | [`src/lib/digitalSignature.ts`](./src/lib/digitalSignature.ts) · [`src/lib/legalCustody.ts`](./src/lib/legalCustody.ts) · [`src/lib/legalPdfGenerator.ts`](./src/lib/legalPdfGenerator.ts) | Procesamiento X.509/PKCS#7/PKCS#12 (`node-forge`), aislamiento por `participation_id` y generación del Certificado Legal PDF con `pdf-lib`. |
| **Comprobador de Premios**| [`src/components/tickets/PrizeCheckCard.tsx`](./src/components/tickets/PrizeCheckCard.tsx) | Consulta de premios en vivo, desglose de IRPF y confirmación de cobro. |
| **Cuadro de Propiedad** | [`src/components/tickets/OwnershipBreakdownCard.tsx`](./src/components/tickets/OwnershipBreakdownCard.tsx) | Gráfico Donut SVG (`100% Distribuido`), lista de cotitulares y renuncias. |
| **Reparto y Cuotas** | [`src/components/tickets/CreateParticipationSheet.tsx`](./src/components/tickets/CreateParticipationSheet.tsx) | Reparto manual o a partes iguales con absorción de redondeos. |
| **Compartir Invitación** | [`src/components/tickets/ShareInviteModal.tsx`](./src/components/tickets/ShareInviteModal.tsx) | Generación de enlace web, PIN de 6 dígitos, código QR y botón WhatsApp. |
| **Línea de Auditoría** | [`src/components/tickets/TicketAuditTimeline.tsx`](./src/components/tickets/TicketAuditTimeline.tsx) | Historial inmutable de eventos por décimo. |
| **Bandeja de Alertas** | [`src/pages/AlertsPage.tsx`](./src/pages/AlertsPage.tsx) | Notificaciones Realtime, marcado masivo y botones directos de renuncia. |
| **Centro de Auditoría** | [`src/pages/AuditPage.tsx`](./src/pages/AuditPage.tsx) | Las 4 Reglas de Oro, buscador global y filtrado por categorías. |
| **Perfil y Ajustes** | [`src/pages/ProfilePage.tsx`](./src/pages/ProfilePage.tsx) | Edición de perfil, avatar WebP, interruptor Push y test de notificación. |
| **Servicio Web Push** | [`src/services/push/pushSubscription.ts`](./src/services/push/pushSubscription.ts) · [`public/push-sw.js`](./public/push-sw.js) | Suscripción VAPID y manejador de notificaciones del Service Worker. |
| **Instalador PWA** | [`src/components/pwa/PwaInstallBanner.tsx`](./src/components/pwa/PwaInstallBanner.tsx) | Prompt nativo en Android y tutorial guiado en iOS Safari. |
| **Edge Functions y Motor** | [`supabase/functions/autofirma-relay/`](./supabase/functions/autofirma-relay/index.ts) · [`supabase/functions/check-prizes/`](./supabase/functions/check-prizes/) · [`send-push/`](./supabase/functions/send-push/index.ts) · [`src/lib/historicalDraws.ts`](./src/lib/historicalDraws.ts) | Relay AutoFirma efímero, comprobación oficial con motor histórico 2020-2025 y Web Push asíncrono. |
| **Migraciones SQL** | [`supabase/migrations/`](./supabase/migrations/) | Migraciones PostgreSQL (tablas, RLS, triggers y RPCs transaccionales). |

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18+, Vite 6, TypeScript, Tailwind CSS, Lucide React, `vite-plugin-pwa`.
- **Criptografía, PDF y Testing:**
  - `node-forge`: procesamiento de certificados X.509 y firmas PKCS#7/PKCS#12 (`.p12` / `.pfx` y retorno AutoFirma).
  - `pdf-lib`: generación íntegra en cliente del Documento Legal de Custodia PDF.
  - Web Crypto API (`SHA-256`): huella criptográfica de la fotografía del anverso del décimo.
  - Tests unitarios puros con Node.js Test Runner (`node --test --experimental-strip-types`, sin `jsdom`).
- **Backend:** Supabase Cloud (`xmdghpyfrblmtjtevtru`):
  - Base de datos PostgreSQL con políticas Row-Level Security (RLS) estrictas.
  - Funciones transaccionales RPC en PL/pgSQL (`SECURITY DEFINER`).
  - Triggers y suscripciones Realtime.
  - Web Push nativo mediante suscripciones VAPID y Edge Functions.
- **Fuentes de Datos de Lotería:** API pública de resultados (El País / SELAE) y fallback `loteriasapi.com`.

---

## 📦 Estructura del Proyecto

```text
├── .agent/
│   └── workflows/              # Workflows de inicio y finalización de tareas
├── docs/
│   ├── ARCHITECTURE.md         # Modelo ER, catálogo de RPCs y diseño Web Push
│   ├── BUSINESS_RULES.md       # Reglas de negocio inmutables
│   ├── SCREENS_GUIDE.md        # Manual funcional de pantallas y flujos
│   └── STATUS.md               # Panel vivo del estado del proyecto
├── public/
│   ├── push-sw.js              # Service Worker para eventos Web Push nativos
│   └── badge-mono.png          # Badge monocromo para notificaciones
├── src/
│   ├── components/
│   │   ├── common/             # VersionBadge anti-caché y modales
│   │   ├── layout/             # AppShell, Header y BottomNav fijo
│   │   ├── pwa/                # PwaInstallBanner nativo e instrucciones iOS
│   │   └── tickets/            # Escáner GS1-128, boleto realista, Certificación Legal (AutoFirma, firma manuscrita), Donut SVG, premios y auditoría
│   ├── context/
│   │   └── AuthContext.tsx     # Sesión OTP y persistencia de deep-links
│   ├── lib/
│   │   ├── __tests__/          # Suite de tests unitarios puros (node --test)
│   │   ├── digitalSignature.ts # Parsing X.509, PKCS#7/PKCS#12 (node-forge) y SHA-256
│   │   ├── legalCustody.ts     # Aislamiento por participation_id y validaciones legales
│   │   ├── legalPdfGenerator.ts# Generación del Documento Legal PDF (pdf-lib)
│   │   ├── sanitize.ts         # Sanitización XSS y validación de URLs
│   │   ├── selaeBarcodeParser.ts # Parser de códigos de barras GS1-128 SELAE
│   │   └── supabase.ts         # Cliente Supabase singleton
│   ├── pages/
│   │   ├── LoginPage.tsx       # Login OTP por Email con soporte de pegado
│   │   ├── TicketsPage.tsx     # Dashboard unificado de Décimos y Participaciones
│   │   ├── PrizesPage.tsx      # KPIs de Décimos Activos, Total Premios e historial
│   │   ├── InvitePage.tsx      # Canje directo de invitaciones por enlace (/invite/:token)
│   │   ├── TicketDetailPage.tsx# Detalle de 3 pestañas (Reparto, Certificación Legal, Historial)
│   │   ├── AlertsPage.tsx      # Pestaña Alertas con Realtime
│   │   ├── AuditPage.tsx       # Centro de Auditoría y Reglas de Oro
│   │   └── ProfilePage.tsx     # Mi Perfil, subida WebP, archivados y switch Web Push
│   ├── services/
│   │   └── push/               # Suscripción VAPID y detección de plataforma
│   ├── types/
│   │   └── database.types.ts   # Tipos generados de Supabase
│   ├── App.tsx                 # Enrutador principal de autenticación
│   └── main.tsx                # Bootstrap de React
├── supabase/
│   ├── functions/
│   │   ├── autofirma-relay/    # Relay efímero HTTPS para firma móvil AutoFirma
│   │   ├── check-prizes/       # Comprobación oficial de premios y motor histórico
│   │   └── send-push/          # Envío asíncrono de notificaciones Web Push
│   └── migrations/             # Migraciones SQL secuenciales
├── AGENTS.md                   # Normas obligatorias de gobernanza y Git Flow
├── CHANGELOG.md                # Registro de cambios (Keep a Changelog)
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## ⚙️ Variables de Entorno

Crear un archivo `.env` en la raíz (puedes copiar de `.env.example`):

```bash
VITE_SUPABASE_URL=https://xmdghpyfrblmtjtevtru.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZGdocHlmcmJsbXRqdGV2dHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjU2NzIsImV4cCI6MjExMDM0MTY3Mn0.W8VjcQB4nV8IPZGCKsAiZEF-xIza_CZMRdw8LY3f-QM
VITE_VAPID_PUBLIC_KEY=BJEnxKuSifaT3qA_Go4HgQ-TUhDy2_f_BowWw6e-SpMLfRNan7ly83swkhQYQ8bnetdwWC8a6RbMSB8lUoh_4b8
```

---

## ☁️ Despliegue en Producción (Vercel)

La aplicación está completamente optimizada para desplegarse en **Vercel** como Mobile-First PWA:

1. **Configuración del Proyecto en Vercel:**
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
2. **Variables de Entorno en Vercel Dashboard (`Settings` -> `Environment Variables`):**
   - `VITE_SUPABASE_URL` = `https://xmdghpyfrblmtjtevtru.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZGdocHlmcmJsbXRqdGV2dHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjU2NzIsImV4cCI6MjExMDM0MTY3Mn0.W8VjcQB4nV8IPZGCKsAiZEF-xIza_CZMRdw8LY3f-QM`
   - `VITE_VAPID_PUBLIC_KEY` = `BJEnxKuSifaT3qA_Go4HgQ-TUhDy2_f_BowWw6e-SpMLfRNan7ly83swkhQYQ8bnetdwWC8a6RbMSB8lUoh_4b8`
3. **Mecanismo Anti-Caché y SPA:**
   - El archivo `vercel.json` garantiza que todas las rutas profundas (`/invite/:token`, `/billetes/:id`, etc.) se sirvan limpiamente sin errores 404.
   - Las cabeceras HTTP `Cache-Control: public, max-age=0, must-revalidate` sobre `sw.js`, `push-sw.js` y `manifest.webmanifest` aseguran que las actualizaciones se sirvan de inmediato a los clientes móviles sin retención en CDN ni navegadores.

---

## 🚀 Scripts Disponibles

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Ejecutar suite de tests unitarios (node --test --experimental-strip-types)
npm test

# Verificación de tipos TypeScript
npm run typecheck

# Compilar para producción (incluye PWA)
npm run build

# Previsualizar build de producción
npm run preview

# Respaldo obligatorio de base de datos previo a migraciones SQL
npm run db:backup
```

---

## 🛡️ Gobernanza y Flujo de Trabajo

Este proyecto implementa **Git Flow estricto** y reglas de gobernanza multi-agente detalladas en [AGENTS.md](AGENTS.md). Toda modificación debe partir de `develop` en ramas `feature/<nombre>` o `fix/<nombre>`.
