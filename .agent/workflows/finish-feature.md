# Workflow: Finish Feature (`finish-feature`)

Este workflow estandariza el cierre, verificación e integración de una rama en **MisDecimos**.

## Pasos de Ejecución

1. **Validación de Calidad Técnica:**
   - Comprobación estricta de tipos de TypeScript:
     ```bash
     npm run typecheck
     ```
   - Compilación completa de producción (incluye PWA y Service Worker):
     ```bash
     npm run build
     ```
   - Si existen migraciones SQL, comprobar que se han aplicado exitosamente en Supabase (`xmdghpyfrblmtjtevtru`) y que `src/types/database.types.ts` está sincronizado.

2. **Incremento de Versión:**
   - Actualizar `package.json` con la nueva versión SemVer (`feature`: minor, `fix`: patch).

3. **Mantenimiento Documental:**
   - Registrar los cambios en `CHANGELOG.md` bajo el formato *Keep a Changelog*.
   - Actualizar `README.md` si se añadieron componentes, rutas, variables o comandos.
   - Actualizar `docs/STATUS.md` marcando la tarea como `[x] Completado` y actualizando la versión y último hash.
   - Revisar `AGENTS.md` y `docs/ARCHITECTURE.md` en caso de nuevas convenciones o esquemas.

4. **Integración Git (Git Flow):**
   - Confirmar todos los cambios en la rama feature:
     ```bash
     git add -A
     git commit -m "feat(<modulo>): <descripcion breve de la tarea>"
     ```
   - Cambiar a `develop`, sincronizar e integrar con `--no-ff`:
     ```bash
     git checkout develop
     git pull origin develop
     git merge --no-ff feature/<nombre-descriptivo-kebab-case>
     git push origin develop
     ```
   - Eliminar la rama local (y remota si se publicó):
     ```bash
     git branch -d feature/<nombre-descriptivo-kebab-case>
     ```

5. **Informe Técnico de Entrega:**
   - Emitir el informe final detallando ramas, archivos, cambios de base de datos/RPCs, pruebas y estado documental.
