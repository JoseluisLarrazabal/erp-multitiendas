#!/usr/bin/env bash
# Uso: restaurar-fotos.sh <dir-con-fotos> <supabase-url>
# Sube <dir-con-fotos>/fotos/** al bucket `productos` con upsert. El bucket debe existir (lo crean las migraciones).
# Entorno: SUPABASE_SERVICE_ROLE_KEY (nunca en argv ni impresa). Imprime solo cantidades.
set -euo pipefail

[ $# -eq 2 ] || { echo "Uso: $0 <dir-con-fotos> <supabase-url>" >&2; exit 1; }
: "${SUPABASE_SERVICE_ROLE_KEY:?falta SUPABASE_SERVICE_ROLE_KEY}"
[ -d "$1/fotos" ] || { echo "ERROR: falta $1/fotos" >&2; exit 1; }
fotos=$(cd "$1/fotos" && pwd)
base="${2%/}/storage/v1"

subidos=0
while IFS= read -r -d '' f; do
  ruta=${f#"$fotos"/}
  # El bucket solo admite estos tipos; se deduce de la extensión (como al subir desde el panel), no del contenido.
  case "${ruta,,}" in *.jpg|*.jpeg) tipo=image/jpeg ;; *.png) tipo=image/png ;; *.webp) tipo=image/webp ;; *) tipo=application/octet-stream ;; esac
  uri=$(jq -rn --arg r "$ruta" '$r | split("/") | map(@uri) | join("/")')
  curl --fail --silent --show-error --retry 3 --output /dev/null -X POST \
    -H @<(printf 'Authorization: Bearer %s\napikey: %s\n' "$SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY") \
    -H "Content-Type: $tipo" -H 'x-upsert: true' \
    --data-binary "@$f" "$base/object/productos/$uri"
  subidos=$((subidos + 1))
done < <(find "$fotos" -type f -print0)
echo "Fotos restauradas: $subidos archivos"
