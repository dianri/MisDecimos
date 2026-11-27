#!/usr/bin/env bash
set -euo pipefail

# Asegurar rutas habituales de Homebrew / macOS para pg_dump y supabase CLI
export PATH="/opt/homebrew/opt/libpq/bin:/opt/homebrew/bin:/usr/local/opt/libpq/bin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Cargar variables de .env y .env.local (.env.local tiene prioridad)
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

# 2. Crear carpeta backups/ si no existe
mkdir -p "backups"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="backups/misdecimos_supabase_${TIMESTAMP}.sql"

# 3. Generar volcado completo
if [ -n "$DB_URL" ] && command -v pg_dump >/dev/null 2>&1; then
  echo "Generando backup completo de Supabase con pg_dump..."
  pg_dump --no-owner --no-privileges "$DB_URL" > "$BACKUP_FILE"
elif [ -n "$DB_URL" ] && command -v supabase >/dev/null 2>&1; then
  echo "Generando backup completo de Supabase con Supabase CLI..."
  supabase db dump --db-url "$DB_URL" -f "$BACKUP_FILE"
elif [ -z "$DB_URL" ]; then
  echo "ERROR: Falta la variable SUPABASE_DB_URL (o DATABASE_URL)." >&2
  echo "Añade la cadena de conexión de Postgres en .env.local (nunca la subas a Git):" >&2
  echo '  SUPABASE_DB_URL="postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"' >&2
  exit 1
else
  echo "ERROR: No se encontró 'pg_dump' ni 'supabase' CLI en el PATH." >&2
  echo "Instala libpq (pg_dump) en macOS con: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

# 4. Verificar que el archivo generado existe y pesa > 0 bytes
if [ ! -s "$BACKUP_FILE" ]; then
  rm -f "$BACKUP_FILE"
  echo "ERROR: El volcado '$BACKUP_FILE' no se generó o está vacío (0 bytes)." >&2
  exit 1
fi

FILE_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
echo "Backup generado correctamente: $BACKUP_FILE (${FILE_SIZE} bytes)"

# 5. Mantener automáticamente solo las 5 copias más recientes en backups/
OLD_BACKUPS="$(ls -1t backups/misdecimos_supabase_*.sql 2>/dev/null | tail -n +6 || true)"
if [ -n "$OLD_BACKUPS" ]; then
  echo "$OLD_BACKUPS" | while IFS= read -r old_file; do
    if [ -n "$old_file" ] && [ -f "$old_file" ]; then
      rm -f "$old_file"
      echo "Backup antiguo eliminado (retención máx. 5): $old_file"
    fi
  done
fi
