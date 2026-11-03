#!/usr/bin/env bash
# Reemplaza los marcadores __X__ de alta-produccion.sql / alta-reporte.sql con variables de entorno
# (nunca del repo) y los corre con `supabase db query`, una sentencia por llamada.
# Uso, desde cualquier directorio: scripts/alta/alta-produccion.sh --local|--linked
set -euo pipefail
destino="${1:?uso: alta-produccion.sh --local|--linked}"
case "$destino" in --local|--linked) ;; *) echo "destino inválido: $destino" >&2; exit 1;; esac
dir="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$dir/../.." && pwd)"
cd "$repo/web"

correr() {
  local sql marcador var valor
  sql="$(cat "$dir/$1")"
  for par in DUENO_EMAIL:ALTA_DUENO_EMAIL NOMBRE_TIENDA:ALTA_NEGOCIO_TIENDA \
             NOMBRE_LAVANDERIA:ALTA_NEGOCIO_LAVANDERIA NOMBRE_FRIAL:ALTA_NEGOCIO_FRIAL; do
    marcador="__${par%%:*}__"; var="${par#*:}"
    valor="${!var:?falta $var}"
    # El valor va entre $p$...$p$: un '$' podría cerrarlo antes de tiempo.
    case "$valor" in *'$'*) echo "$var no puede contener '\$'" >&2; exit 1;; esac
    # Sin espacios en los bordes: el reporte filtra por nombre y el alta ya los recorta.
    valor="$(printf '%s' "$valor" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    sql="${sql//"$marcador"/"$valor"}"
  done
  # El salto de línea inicial evita que el "--" del primer comentario se lea como un flag.
  # --output-format json fijo: sin él, el formato depende de si el CLI detecta un agente de IA.
  pnpm exec supabase --workdir "$repo" --output-format json db query "$destino" "$(printf '\n%s' "$sql")"
}

correr alta-produccion.sql
correr alta-reporte.sql
