#!/usr/bin/env bash
# Uso: verificar-fotos.sh <dump-dir>
# Si existe <dump-dir>/fotos, exige que su número de archivos sea igual al de filas de storage.objects del bucket `productos` en data.sql.
# Imprime solo cantidades. Sin fotos/ no hace nada (el paso de fotos pudo omitirse por falta de secretos).
set -euo pipefail

[ $# -eq 1 ] || { echo "Uso: $0 <dump-dir>" >&2; exit 1; }
[ -d "$1/fotos" ] || { echo "Fotos: sin respaldo, no se verifica"; exit 0; }

# La posición de bucket_id sale de la cabecera del COPY, no se asume.
filas=$(awk -F'\t' '
  /^COPY "?storage"?\."?objects"? \(.*\) FROM stdin;$/ { c = $0; sub(/^[^(]*\(/, "", c); sub(/\).*$/, "", c); gsub(/"/, "", c); k = split(c, col, ", "); for (i = 1; i <= k; i++) if (col[i] == "bucket_id") b = i; dentro = 1; next }
  dentro && $0 == "\\." { dentro = 0; next }
  dentro && $b == "productos" { n++ }
  END { print n + 0 }
' "$1/data.sql")
archivos=$(find "$1/fotos" -type f | wc -l)
echo "Fotos: $archivos archivos, $filas filas en storage.objects (productos)"
[ "$archivos" -eq "$filas" ] || { echo "VERIFICACION DE FOTOS FALLIDA" >&2; exit 1; }
echo "FOTOS OK"
