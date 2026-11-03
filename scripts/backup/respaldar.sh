#!/usr/bin/env bash
# Uso: respaldar.sh <db-url> <dir-salida>
# Vuelca roles.sql, schema.sql y data.sql (guía oficial de Supabase: backup-restore). Se corre desde cualquier cwd.
# La URL es secreta: nunca se imprime.
set -euo pipefail

[ $# -eq 2 ] || { echo "Uso: $0 <db-url> <dir-salida>" >&2; exit 1; }
url=$1
salida=$2
raiz=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p "$salida"
salida=$(cd "$salida" && pwd)

cd "$raiz/web"
sb() { pnpm --silent exec supabase "$@" --workdir ..; }

sb db dump --db-url "$url" -f "$salida/roles.sql" --role-only
sb db dump --db-url "$url" -f "$salida/schema.sql"
sb db dump --db-url "$url" -f "$salida/data.sql" --use-copy --data-only

for f in roles schema data; do
  [ -s "$salida/$f.sql" ] || { echo "ERROR: $f.sql quedó vacío" >&2; exit 1; }
done
echo "Respaldo completo: roles.sql schema.sql data.sql"
