#!/usr/bin/env bash
# Uso: destino-efimero.sh <dir-proyecto> <project_id> <puerto-db>
# Levanta una Supabase local (db, gotrue, storage-api) como destino de una restauración, sin migraciones ni seed del proyecto.
# Puertos usados: <puerto-db>-1 (api) .. <puerto-db>+8 (pooler). Parar con: pnpm exec supabase stop --workdir <dir> --no-backup (desde web/).
# gotrue y storage-api arrancan para que el esquema auth/storage lo creen ellos, como en un proyecto real.
set -euo pipefail

[ $# -eq 3 ] || { echo "Uso: $0 <dir-proyecto> <project_id> <puerto-db>" >&2; exit 1; }
dir=$1 id=$2 p=$3
raiz=$(cd "$(dirname "$0")/../.." && pwd)
mkdir -p "$dir"
dir=$(cd "$dir" && pwd)

cd "$raiz/web"
pnpm --silent exec supabase init --workdir "$dir" --force >/dev/null 2>&1
sed -i \
  -e "s/^project_id = .*/project_id = \"$id\"/" \
  -e "/^\[api\]/,/^\[/ s/^port = .*/port = $((p - 1))/" \
  -e "/^\[db\]/,/^\[/ s/^port = .*/port = $p/" \
  -e "s/^shadow_port = .*/shadow_port = $((p + 1))/" \
  -e "/^\[db.pooler\]/,/^\[/ s/^port = .*/port = $((p + 8))/" \
  -e "/^\[studio\]/,/^\[/ s/^port = .*/port = $((p + 2))/" \
  -e "/^\[local_smtp\]/,/^\[/ s/^port = .*/port = $((p + 3))/" \
  -e "/^\[analytics\]/,/^\[/ s/^port = .*/port = $((p + 6))/" \
  "$dir/supabase/config.toml"

pnpm --silent exec supabase start --workdir "$dir" \
  -x realtime,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor >/dev/null
echo "postgresql://postgres:postgres@127.0.0.1:$p/postgres"
