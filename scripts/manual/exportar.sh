#!/usr/bin/env bash
# Exporta cada manual de docs/manual/*.md a HTML (pandoc) y a PDF A4 (Playwright). Sale en docs/manual/dist/.
# Requiere pandoc y `pnpm --dir web install` (Chromium de Playwright instalado).
# MANUAL_DIR (opcional): otra carpeta con los .md, manual.css e img/, para probar el script sin tocar docs/manual.
set -euo pipefail

raiz="$(git rev-parse --show-toplevel)"
manual="${MANUAL_DIR:-$raiz/docs/manual}"
dist="$manual/dist"
mkdir -p "$dist"

declare -A titulos=(
  [vendedor]="Manual del vendedor"
  [lavanderia]="Manual de lavandería"
  [encargado-y-dueno]="Manual del encargado y del dueño"
  [contador]="Manual del contador"
)

for nombre in vendedor lavanderia encargado-y-dueno contador; do
  fuente="$manual/$nombre.md"
  [[ -f "$fuente" ]] || { echo "Falta $fuente" >&2; exit 1; }
  pandoc "$fuente" -s --embed-resources --css "$manual/manual.css" \
    --resource-path="$manual" --metadata pagetitle="${titulos[$nombre]}" --metadata lang=es \
    -o "$dist/$nombre.html"
  pnpm --dir "$raiz/web" exec playwright pdf --paper-format A4 \
    "file://$dist/$nombre.html" "$dist/$nombre.pdf"
  echo "OK $dist/$nombre.pdf"
done
