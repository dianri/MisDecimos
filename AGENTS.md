# AGENTS.md — Reglas de Ingeniería y Flujo Multi-Agente (MisDecimos)

Este documento define las normas obligatorias de arquitectura, flujo Git, documentación y concurrencia para cualquier agente de IA o desarrollador que trabaje en **MisDecimos** (`https://github.com/dianri/MisDecimos`).

## 1. Stack y Principios de Arquitectura
- **Frontend:** React 18+ + Vite + TypeScript + Tailwind CSS + `vite-plugin-pwa` (Mobile-First PWA).
- **Backend:** Supabase Cloud (Proyecto ID: `xmdghpyfrblmtjtevtru`) — PostgreSQL, RLS, Funciones RPC (`SECURITY DEFINER`), Triggers PL/pgSQL, Supabase Realtime, Storage (bucket público `avatars` con 2MB de límite) y Edge Functions (Deno/TypeScript).
- **Seguridad y Sanitización:** Toda entrada de texto de usuario (nombres, teléfonos, notas) debe pasar por `sanitizeText` (`src/lib/sanitize.ts`) antes de persistirse. Toda URL de imagen externa debe validarse mediante `safeImageUrl`.
- **PWA & Push:** Service Worker con soporte offline (`vite-plugin-pwa`) y Web Push nativo vía VAPID (iconos, badges monocromos y URLs absolutas `https://misdecimos.dianrie.com/...`).
- **Single Source of Truth (Fuente Única de Verdad):**
  - Toda la lógica crítica (creación de décimos, cálculo y cesión de porcentajes, códigos de 6 dígitos, aceptación/rechazo de invitaciones, solicitudes de renuncia, confirmación de cobro de premios y auditoría inmutable) reside **exclusivamente** en funciones RPC transaccionales (`SECURITY DEFINER`) y Edge Functions en Supabase, nunca únicamente en el cliente React.
  - La API key de `loteriasapi.com` y las claves privadas VAPID residen **exclusivamente** en Supabase Secrets / Edge Functions, nunca en variables `VITE_*`.

## 2. Flujo Git Obligatorio (Git Flow Estricto)
1. **Ramas protegidas:** Prohibido commitear directamente en `main` o `develop`.
2. **Creación de rama por tarea:** Para cada nueva feature, fix o migración, partir siempre de `develop` actualizada:
   - `feature/<nombre-descriptivo-kebab-case>` (ej. `feature/core-foundation`, `feature/ocr-scanner`, `feature/share-participations`)
   - `fix/<nombre-del-bug>`
3. **Validación previa a merge:** Antes de integrar en `develop`, es obligatorio ejecutar y validar:
   - `npm run typecheck` (o `tsc --noEmit`) con 0 errores.
   - `npm run build` exitoso (incluyendo generación de Service Worker/PWA).
   - Migraciones SQL aplicadas y verificadas en Supabase (`xmdghpyfrblmtjtevtru`).
4. **Integración y limpieza:** Fusionar `feature/<nombre>` en `develop` mediante `--no-ff`, actualizar documentación y eliminar la rama temporal si ya no es requerida.
5. **Informe final obligatorio:** Al cerrar cada tarea, emitir en la respuesta un **Informe Técnico** detallando: rama creada/fusionada, archivos modificados/creados, cambios en BD/Edge Functions, pruebas realizadas y estado de la documentación.

## 3. Control de Versiones y Sistema Anti-Caché
1. **Incremento SemVer en `package.json`:**
   - Cada feature incrementa minor (ej. `0.1.0` -> `0.2.0`).
   - Cada fix o parche incrementa patch (ej. `0.2.0` -> `0.2.1`).
2. **Badge Visual Permanente (`<VersionBadge />`):**
   - La aplicación muestra en todo momento de forma fija y discreta el componente `<VersionBadge />` con el formato `vX.Y.Z · <git-short-hash>` e indicador de estado de red (online/offline).
   - Permite abrir un modal de diagnóstico con la fecha exacta del build y un botón directo *"Forzar actualización y limpiar caché"* que desregistra Service Workers, vacía `window.caches` y recarga limpiamente.
   - El Service Worker opera en modo `autoUpdate` silencioso con `skipWaiting: true` y `clientsClaim: true`, comprobando actualizaciones periódicamente (cada 60s) y al recuperar el foco (`visibilitychange`), recargando limpiamente una sola vez de forma automática cuando el nuevo Service Worker toma el control.

## 4. Reglas Multi-Agente (Trabajo Concurrente sin Colisiones)
1. **Revisión previa obligatoria:** Todo agente debe consultar `docs/STATUS.md` y `AGENTS.md` antes de iniciar cualquier desarrollo.
2. **Aislamiento de dominio:**
   - *Agente Backend/DB:* `supabase/migrations/*`, `supabase/functions/*`, `src/types/database.types.ts`
   - *Agente UI/Core:* `src/components/*`, `src/pages/*`, `src/layouts/*`
   - *Agente PWA/Hardware:* `src/services/push/*`, `public/sw.js`
3. **Migraciones SQL inmutables y secuenciales:**
   - Prohibido editar archivos SQL ya aplicados en `supabase/migrations/`.
   - Todo cambio de esquema requiere un nuevo archivo con timestamp: `YYYYMMDDHHMMSS_<descripcion>.sql`.
4. **Regeneración de tipos TypeScript:**
   - Tras cualquier cambio en PostgreSQL, regenerar `src/types/database.types.ts` desde Supabase (`xmdghpyfrblmtjtevtru`).
5. **Cierre de tarea:**
   - Es obligatorio actualizar `CHANGELOG.md`, `README.md`, `docs/STATUS.md` y comprobar si `AGENTS.md`, `docs/ARCHITECTURE.md` o `docs/SCREENS_GUIDE.md` requieren actualización antes de integrar la rama en `develop`.

### Documentación funcional (`docs/SCREENS_GUIDE.md`)
- En ramas `fix/*`: no es necesario modificar `docs/SCREENS_GUIDE.md` salvo que cambie el comportamiento visible documentado.
- En ramas `feat/*` que añadan o modifiquen pantallas, pestañas, modales, gestos o flujos de usuario: es obligatorio actualizar la sección correspondiente de `docs/SCREENS_GUIDE.md` antes de fusionar en `develop`.

## Regla Obligatoria de Base de Datos y Backups (Supabase Cloud)
Estas normas son de estricto cumplimiento para cualquier tarea futura que implique cambios en la base de datos:
1. **Backup previo obligatorio:** Antes de crear, modificar o aplicar cualquier migración SQL (`supabase/migrations/*`), trigger, función RPC o cambio de esquema/RLS en Supabase, el agente **debe ejecutar primero `npm run db:backup`** y confirmar que el archivo `.sql` en `backups/` se ha generado correctamente y no está vacío (`> 0 bytes`). Si no puede ejecutarse por faltar `SUPABASE_DB_URL` en `.env.local`, debe detenerse y pedírsela al usuario antes de tocar la base de datos.
2. **Triggers defensivos en tablas de producción:** Cualquier trigger añadido sobre tablas ya activas en producción (`tickets`, `participations`, `ownership_shares`, `profiles`, etc.) debe comprobar en su primera línea si el registro pertenece a la nueva funcionalidad y ejecutar un **retorno inmediato (`RETURN NEW;` / `RETURN OLD;`)** para todos los registros normales de producción.
3. **Plan de reversión (Rollback):** Toda nueva migración en `supabase/migrations/` debe incluir al final un bloque comentado `-- ROLLBACK:` con las sentencias `DROP TRIGGER`, `DROP FUNCTION` y `DROP TABLE` exactas para deshacer los cambios al instante sin afectar a los datos en producción.
