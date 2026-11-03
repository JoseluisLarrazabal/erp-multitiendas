#!/usr/bin/env bash
# Uso: restaurar.sh <dump-dir> <db-url-destino>
# Restaura en una base Supabase VACÍA (guía oficial). Una sola transacción: si algo falla, no queda nada a medias.
set -euo pipefail

[ $# -eq 2 ] || { echo "Uso: $0 <dump-dir> <db-url-destino>" >&2; exit 1; }
dir=$1
url=$2
for f in roles schema data; do
  [ -s "$dir/$f.sql" ] || { echo "ERROR: falta $dir/$f.sql" >&2; exit 1; }
done

# Quita los COPY sin filas (no insertan nada): postgres no tiene INSERT en storage.buckets_vectors, tabla de storage-api sin grant a postgres.
# Una tabla con filas sí se restaura y, si postgres no puede escribirla, falla a propósito.
vaciar_copy_sin_filas() { awk 'h != "" { if ($0 == "\\.") { h = ""; next } print h; h = "" } /^COPY .* FROM stdin;$/ { h = $0; next } { print }'; }

inicio=$SECONDS
# Se corre como `postgres` (lo único que hay en un proyecto hosted). Se descartan los GRANT SET ON PARAMETER de roles.sql:
# solo un superusuario puede darlos y la plataforma ya fija esos permisos de roles internos; ninguna otra sentencia de roles.sql lo exige.
# client_min_messages=warning calla los NOTICE de "ya existe"; los errores sí salen y ON_ERROR_STOP aborta con código != 0.
PGOPTIONS='-c client_min_messages=warning' psql --single-transaction --variable ON_ERROR_STOP=1 --quiet --output /dev/null \
  --file <(sed '/^GRANT SET ON PARAMETER/d' "$dir/roles.sql") \
  --file "$dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file <(vaciar_copy_sin_filas < "$dir/data.sql") \
  --dbname "$url"
echo "Restauración terminada en $((SECONDS - inicio)) s"
