#!/usr/bin/env bash
# Genera los PNG y el favicon desde los SVG fuente de public/icons (requiere rsvg-convert e ImageMagick 6 o 7).
set -euo pipefail
command -v rsvg-convert >/dev/null || { echo "Falta rsvg-convert (librsvg)." >&2; exit 1; }
if command -v magick >/dev/null; then im=magick; elif command -v convert >/dev/null; then im=convert; else
  echo "Falta ImageMagick (magick o convert)." >&2; exit 1
fi
cd "$(dirname "$0")/../public"
rsvg-convert -w 192 -h 192 icons/icono.svg -o icons/icono-192.png
rsvg-convert -w 512 -h 512 icons/icono.svg -o icons/icono-512.png
rsvg-convert -w 512 -h 512 icons/icono-maskable.svg -o icons/icono-maskable-512.png
# iOS no admite transparencia ni esquinas redondeadas propias: usa la versión a sangre.
rsvg-convert -w 180 -h 180 icons/icono-maskable.svg -o icons/apple-touch-icon.png
rsvg-convert -w 32 -h 32 icons/icono.svg -o icons/favicon-32.png
rsvg-convert -w 16 -h 16 icons/icono.svg -o icons/favicon-16.png
"$im" icons/favicon-16.png icons/favicon-32.png favicon.ico
