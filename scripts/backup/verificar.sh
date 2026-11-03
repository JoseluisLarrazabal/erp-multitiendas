#!/usr/bin/env bash
# Uso: verificar.sh <dump-dir> <db-url-restaurada>
# Compara las filas de cada bloque COPY de data.sql (public, auth, storage) con count(*) exacto de esa tabla en la restaurada,
# y exige stock = suma del kardex. Sin consultar el origen: no hay carrera con escrituras posteriores al dump.
# Imprime solo nombres de tabla y números: nunca filas ni URLs. Sale != 0 si algo no cuadra.
set -euo pipefail
export LC_ALL=C # sort y join deben ordenar igual en ambos lados

[ $# -eq 2 ] || { echo "Uso: $0 <dump-dir> <db-url-restaurada>" >&2; exit 1; }
dump=$1/data.sql
url=$2
[ -s "$dump" ] || { echo "ERROR: falta $dump" >&2; exit 1; }

# Con --use-copy cada fila es una línea entre `COPY <tabla> (...) FROM stdin;` y `\.`. Salida: "esquema.tabla<TAB>filas<TAB>"esquema"."tabla"".
tablas=$(awk '
  /^COPY .* FROM stdin;$/ { q = $0; sub(/^COPY /, "", q); sub(/ \(.*$/, "", q); t = q; gsub(/"/, "", t); n = 0; dentro = 1; next }
  dentro && $0 == "\\." { printf "%s\t%d\t%s\n", t, n, q; dentro = 0; next }
  dentro { n++ }
' "$dump" | sort)

# Sin esto un dump vacío o truncado "verificaría" cero tablas.
grep -q '^auth.users	' <<<"$tablas" || { echo "ERROR: auth.users no está en el dump" >&2; exit 1; }
grep -q '^public\.' <<<"$tablas" || { echo "ERROR: ninguna tabla public en el dump" >&2; exit 1; }

# Las tablas vacías en el dump no se comparan: restaurar.sh no las carga y algunas (storage.buckets_vectors) postgres ni puede leerlas.
esperado=$(awk -F'\t' '$2 > 0 { print $1 " " $2 }' <<<"$tablas")
vacias=$(awk -F'\t' '$2 == 0' <<<"$tablas" | wc -l)
# Sin ON_ERROR_STOP: una tabla que falta en la restaurada sale como FALTA en vez de abortar.
restaurado=$(awk -F'\t' '$2 > 0 { printf "select '\''%s'\'', count(*) from %s;\n", $1, $3 }' <<<"$tablas" | psql "$url" -Atq -F ' ' | sort)

fallos=0
if [ "$esperado" = "$restaurado" ]; then
  echo "Conteos: $(wc -l <<<"$esperado") tablas con filas iguales ($vacias vacías sin comparar)"
else
  fallos=1
  echo "Conteos distintos (tabla dump/restaurada):"
  join -a1 -a2 -e FALTA -o 0,1.2,2.2 <(echo "$esperado") <(echo "$restaurado") | awk '$2 != $3 {print "  " $1 " " $2 "/" $3}'
fi

difs=$(psql "$url" -v ON_ERROR_STOP=1 -Atq -c "select count(*) from public.stock s where cantidad <> (select coalesce(sum(m.cantidad), 0) from public.movimientos_inventario m where m.producto_id = s.producto_id and m.ubicacion_id = s.ubicacion_id)")
echo "Stock distinto de sum(kardex): $difs"
[ "$difs" = "0" ] || fallos=1

if [ "$fallos" -ne 0 ]; then echo "VERIFICACION FALLIDA" >&2; exit 1; fi
echo "VERIFICACION OK"
