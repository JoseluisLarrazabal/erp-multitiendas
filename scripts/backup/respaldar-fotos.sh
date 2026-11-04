#!/usr/bin/env bash
# Uso: respaldar-fotos.sh <dir-salida>
# Baja todos los objetos del bucket privado `productos` a <dir-salida>/fotos/<ruta> (API REST de Storage).
# Entorno: SUPABASE_URL (https://<ref>.supabase.co) y SUPABASE_SERVICE_ROLE_KEY. La clave nunca se imprime ni va en argv.
# Imprime solo cantidades, nunca nombres de archivo. Cualquier error de listado o descarga aborta con código != 0.
set -euo pipefail

[ $# -eq 1 ] || { echo "Uso: $0 <dir-salida>" >&2; exit 1; }
: "${SUPABASE_URL:?falta SUPABASE_URL}" "${SUPABASE_SERVICE_ROLE_KEY:?falta SUPABASE_SERVICE_ROLE_KEY}"
base="${SUPABASE_URL%/}/storage/v1"
mkdir -p "$1/fotos"
destino=$(cd "$1/fotos" && pwd)

# curl lee las cabeceras de un descriptor, así la clave no aparece en `ps`.
cu() { curl --fail --silent --show-error --retry 3 -H @<(printf 'Authorization: Bearer %s\napikey: %s\n' "$SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY") "$@"; }
uri() { jq -rn --arg r "$1" '$r | split("/") | map(@uri) | join("/")'; }

# Recorre el bucket por prefijos (cola). Una entrada con id null es una carpeta; las demás son objetos. Pagina con limit/offset.
objetos=$(mktemp)
trap 'rm -f "$objetos"' EXIT
pendientes=("")
pagina=100
while [ ${#pendientes[@]} -gt 0 ]; do
  prefijo=${pendientes[0]}
  pendientes=("${pendientes[@]:1}")
  offset=0
  while :; do
    resp=$(cu -X POST "$base/object/list/productos" -H 'Content-Type: application/json' \
      -d "$(jq -n --arg p "$prefijo" --argjson l "$pagina" --argjson o "$offset" '{prefix:$p,limit:$l,offset:$o,sortBy:{column:"name",order:"asc"}}')")
    n=$(jq 'length' <<<"$resp")
    [ "$n" -gt 0 ] || break
    while IFS=$'\t' read -r carpeta nombre; do
      ruta=${prefijo:+$prefijo/}$nombre
      # Quien sube controla el nombre del objeto: no puede escapar de <dir-salida>/fotos.
      case "/$ruta/" in */../*|*/./*|*//*) echo "ERROR: ruta de objeto no permitida en el bucket" >&2; exit 1 ;; esac
      if [ "$carpeta" = "true" ]; then pendientes+=("$ruta"); else printf '%s\n' "$ruta" >> "$objetos"; fi
    done < <(jq -r '.[] | [(.id == null), .name] | @tsv' <<<"$resp")
    [ "$n" -ge "$pagina" ] || break
    offset=$((offset + pagina))
  done
done

total=$(wc -l < "$objetos")
while IFS= read -r ruta; do
  mkdir -p "$destino/$(dirname "$ruta")"
  cu -o "$destino/$ruta" "$base/object/productos/$(uri "$ruta")"
done < "$objetos"

bajados=$(find "$destino" -type f | wc -l)
[ "$bajados" -eq "$total" ] || { echo "ERROR: listados $total, descargados $bajados" >&2; exit 1; }
echo "Fotos respaldadas: $bajados archivos ($(du -sh "$destino" | cut -f1))"
