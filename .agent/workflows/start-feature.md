# Workflow: Start Feature (`start-feature`)

Este workflow estandariza la apertura de una nueva funcionalidad en **MisDecimos**.

## Pasos de Ejecución

1. **Lectura de Estado y Reglas:**
   - Consultar `docs/STATUS.md` para conocer la fase actual y las tareas pendientes.
   - Consultar `AGENTS.md` para confirmar el dominio asignado y las reglas vigentes.

2. **Preparación de Git:**
   - Asegurarse de tener un árbol de trabajo limpio (`git status`).
   - Cambiar a la rama `develop`:
     ```bash
     git checkout develop
     git pull origin develop
     ```

3. **Creación de la Rama:**
   - Crear y cambiar a la rama de la tarea con nomenclatura normalizada:
     ```bash
     git checkout -b feature/<nombre-descriptivo-kebab-case>
     ```

4. **Actualización de Estado:**
   - Marcar la tarea en `docs/STATUS.md` con el prefijo `[~] En curso` especificando la rama creada.
