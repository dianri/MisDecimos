# AGENTS.md — Reglas de Ingeniería y Flujo Multi-Agente (MisDecimos)

Este documento define las normas obligatorias de arquitectura, flujo Git, documentación y concurrencia para cualquier agente de IA o desarrollador que trabaje en **MisDecimos** (`https://github.com/dianri/MisDecimos`).

## 1. Stack y Principios de Arquitectura
- **Frontend:** React + Vite + TypeScript + Tailwind CSS (Mobile-First PWA).
- **Backend:** Supabase Cloud (Proyecto ID: `xmdghpyfrblmtjtevtru`) — PostgreSQL, RLS, Funciones RPC (`SECURITY DEFINER`), Triggers PL/pgSQL, Supabase Realtime y Edge Functions (Deno/TypeScript).
- **PWA & Push:** Service Worker con soporte offline y Web Push nativo vía VAPID (iconos, badges monocromos y URLs absolutas `https://misdecimos.dianrie.com/...`).
- **Single Source of Truth (Fuente Única de Verdad):**
  - Ninguna regla crítica de negocio (cálculo de porcentajes, cesión/devolución de participaciones, estados del décimo, auditoría inmutable ni envío de notificaciones) debe depender exclusivamente del cliente React.
  - Toda mutación crítica se ejecuta mediante funciones RPC transaccionales en PostgreSQL o Edge Functions.
  - La API key de `loteriasapi.com` y las claves privadas VAPID residen **exclusivamente** en Supabase Secrets / Edge Functions, nunca en `VITE_*`.

## 2. Flujo Git Obligatorio (Git Flow Estricto)
1. **Ramas protegidas:** Prohibido hacer commits directos en `main` o `develop`.
2. **Creación de rama por petición:** Para cada nueva feature, fix o migración, crea siempre una rama nueva partiendo de `develop` actualizada:
   - `feature/<nombre-descriptivo-kebab-case>` (ej. `feature/schema-init`, `feature/ocr-scanner`, `feature/share-participations`)
   - `fix/<nombre-del-bug>`
3. **Validación previa a merge:** Antes de integrar en `develop`, el agente debe verificar obligatoriamente:
   - `npm run typecheck` (o `tsc --noEmit`) sin errores.
   - `npm run build` exitoso (incluyendo generación de Service Worker/PWA).
   - Migraciones SQL aplicadas y verificadas en Supabase (`xmdghpyfrblmtjtevtru`).
4. **Integración y limpieza:** Fusionar `feature/<nombre>` en `develop` mediante `--no-ff`, actualizar documentación y eliminar la rama temporal si ya no es necesaria.
5. **Informe final obligatorio:** Al cerrar cada tarea, el agente debe emitir en su respuesta un **Informe Técnico** detallando: rama creada/fusionada, archivos modificados/creados, cambios en BD/Edge Functions, pruebas realizadas y estado de la documentación.

## 3. Reglas de Concurrencia (Trabajo Simultáneo Multi-Agente)
Para permitir que varios agentes trabajen en paralelo sin conflictos ni sobrescrituras:
1. **Aislamiento de dominio por rama:** Cada agente opera exclusivamente en su propia rama `feature/<agente-o-modulo>` y nunca toca archivos fuera de su ámbito asignado:
   - *Agente Backend/DB:* `supabase/migrations/*`, `supabase/functions/*`, `src/types/database.types.ts`
   - *Agente UI/Core:* `src/components/*`, `src/pages/*`, `src/layouts/*`
   - *Agente PWA/Hardware (OCR/QR/Push):* `src/services/ocr/*`, `src/services/qr/*`, `src/services/push/*`, `public/sw.js`
2. **Migraciones SQL inmutables y secuenciales:**
   - Nunca editar un archivo `.sql` ya aplicado en `supabase/migrations/`.
   - Toda modificación de esquema requiere un archivo nuevo con timestamp: `YYYYMMDDHHMMSS_<descripcion>.sql`.
3. **Lockfile y dependencias:**
   - Evitar instalar paquetes npm en ramas paralelas simultáneamente. Si se añade una dependencia, integrar rápidamente en `develop` y hacer `git rebase develop` en las demás ramas activas.
4. **Regeneración de tipos:**
   - Tras cualquier cambio en PostgreSQL, regenerar `src/types/database.types.ts` desde Supabase (`xmdghpyfrblmtjtevtru`) como única fuente de tipos del frontend.

## 4. Mantenimiento Obligatorio de Documentación
Al finalizar **cada** feature (antes de hacer merge a `develop`):
1. **`CHANGELOG.md`:** Añadir una entrada bajo `[Unreleased]` (o versión correspondiente) siguiendo el estándar *Keep a Changelog* (`Added`, `Changed`, `Fixed`, `Security`, `Database`).
2. **`README.md`:** Verificar si la feature añade rutas, variables de entorno, scripts, Edge Functions o funcionalidades visibles, y actualizar `README.md` para que refleje siempre el estado real del proyecto.
3. **`AGENTS.md`:** Revisar si la implementación introduce nuevas convenciones, carpetas, servicios compartidos o reglas de arquitectura; si es así, actualizar `AGENTS.md` en el mismo commit.
