#!/usr/bin/env bash
# Borra las pruebas (todo lo transaccional con fecha >= --desde) y deja inventario y configuración. Ver docs/plan-limpieza-pruebas.md.
# Uso: limpiar-pruebas.sh --desde <ISO con zona, p. ej. 2026-11-10T08:00:00-04:00> [--aplicar] (--linked | --db-url <url> | --local)
# Seco por defecto (solo cuenta y hace rollback). Con --aplicar exige CONFIRMAR=<ref del proyecto> (CONFIRMAR=local en local).
# --linked: usa supabase/.temp/pooler-url (supabase link) + SUPABASE_DB_PASSWORD. Se corre una sola vez, antes del paralelo.
set -euo pipefail

uso() { echo "Uso: $0 --desde <ISO con zona> [--aplicar] (--linked | --db-url <url> | --local)" >&2; exit 1; }
raiz=$(cd "$(dirname "$0")/../.." && pwd)
desde='' aplicar=false destino='' url=''
while [ $# -gt 0 ]; do
  case $1 in
    --desde) [ $# -ge 2 ] || uso; desde=$2; shift 2 ;;
    --aplicar) aplicar=true; shift ;;
    --linked | --local) [ -z "$destino" ] || uso; destino=$1; shift ;;
    --db-url) { [ $# -ge 2 ] && [ -z "$destino" ]; } || uso; destino=$1; url=$2; shift 2 ;;
    *) uso ;;
  esac
done
{ [ -n "$desde" ] && [ -n "$destino" ]; } || uso
# Con zona explícita (Z o ±hh:mm): sin ella el corte dependería de la zona horaria del servidor.
[[ $desde =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}[T\ ][0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)$ ]] \
  || { echo "ERROR: --desde debe ser ISO con zona (2026-11-10T08:00:00-04:00)" >&2; exit 1; }

case $destino in
  --local) url='postgresql://postgres:postgres@127.0.0.1:54421/postgres'; ref=local ;;
  --linked)
    ref=$(tr -d '[:space:]' < "$raiz/supabase/.temp/project-ref" 2>/dev/null) || ref=''
    [ -n "$ref" ] || { echo "ERROR: falta supabase/.temp/project-ref (supabase link)" >&2; exit 1; }
    base=$(tr -d '[:space:]' < "$raiz/supabase/.temp/pooler-url" 2>/dev/null) || base=''
    [ -n "$base" ] || { echo "ERROR: falta supabase/.temp/pooler-url (supabase link)" >&2; exit 1; }
    url=$base
    export PGPASSWORD="${SUPABASE_DB_PASSWORD:?falta SUPABASE_DB_PASSWORD}" ;;
  --db-url)
    if [[ $url =~ @(127\.0\.0\.1|localhost)[:/] ]]; then ref=local
    elif [[ $url =~ postgres\.([a-z0-9]{20})@ ]] || [[ $url =~ @db\.([a-z0-9]{20})\.supabase\.co ]]; then ref=${BASH_REMATCH[1]}
    else echo "ERROR: no pude sacar el ref del proyecto de la URL" >&2; exit 1; fi ;;
esac

# Antes de conectar: sin la confirmación exacta no se toca nada.
if [ "$aplicar" = true ] && [ "${CONFIRMAR:-}" != "$ref" ]; then
  echo "ERROR: --aplicar exige CONFIRMAR=$ref (la corrida en seco no lo necesita)" >&2
  exit 1
fi

echo "Destino: $ref | desde: $desde | modo: $([ "$aplicar" = true ] && echo APLICAR || echo seco)"
psql --no-psqlrc --quiet --variable ON_ERROR_STOP=1 --variable "desde=$desde" --variable "aplicar=$aplicar" \
  --file "$raiz/scripts/limpieza/limpiar-pruebas.sql" --dbname "$url"
