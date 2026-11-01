#!/usr/bin/env bash
# Desactiva (duracion p. ej. 24h) o reactiva (none) una cuenta de Auth del Supabase LOCAL.
# Vive fuera de web/ a propósito: la clave de servicio no entra en web/ ni en sus pruebas.
# Uso: scripts/e2e/banear-cuenta.sh <correo> <duracion>
set -euo pipefail

correo="${1:?uso: banear-cuenta.sh <correo> <duracion|none>}"
duracion="${2:?uso: banear-cuenta.sh <correo> <duracion|none>}"
[[ "$duracion" =~ ^(none|[0-9]+[smh])$ ]] || { echo "duracion invalida: $duracion" >&2; exit 1; }

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
salida="$(cd "$raiz/web" && pnpm exec supabase status -o env --workdir .. 2>/dev/null)"
valor() { sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" <<<"$salida" | head -n1; }
url="$(valor API_URL)"
clave="$(valor SERVICE_ROLE_KEY)"

[[ "$url" =~ ^https?://(127\.0\.0\.1|localhost)(:[0-9]+)?(/|$) ]] || { echo "se niega: la URL no es local" >&2; exit 1; }
[[ -n "$clave" ]] || { echo "no hay clave admin: ¿esta corriendo supabase?" >&2; exit 1; }

# La clave va por un descriptor de printf (builtin), no por argumentos visibles en `ps`.
api() { curl -sS --fail-with-body -H @<(printf 'apikey: %s\nAuthorization: Bearer %s\nContent-Type: application/json\n' "$clave" "$clave") "$@"; }

id="$(api "$url/auth/v1/admin/users?per_page=200" | jq -r --arg c "$correo" '.users[] | select(.email == $c) | .id')"
[[ -n "$id" ]] || { echo "cuenta $correo no existe" >&2; exit 1; }
api -X PUT "$url/auth/v1/admin/users/$id" -d "{\"ban_duration\":\"$duracion\"}" >/dev/null
