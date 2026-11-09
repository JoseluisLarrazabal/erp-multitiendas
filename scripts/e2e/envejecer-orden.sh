#!/usr/bin/env bash
# Retrocede estado_en de una orden de lavandería del Supabase LOCAL (RF-LAV-07: "sin recoger" son las listas de más de
# 30 días). Ninguna RPC puede hacerlo (estado_en siempre es now()) y service_role no tiene UPDATE sobre ordenes, así que
# la prueba entra como superusuario al contenedor de la base local. Vive fuera de web/ a propósito.
# Uso: scripts/e2e/envejecer-orden.sh <orden_id> <dias>
set -euo pipefail

id="${1:?uso: envejecer-orden.sh <orden_id> <dias>}"
dias="${2:?uso: envejecer-orden.sh <orden_id> <dias>}"
[[ "$id" =~ ^[0-9a-f-]{36}$ ]] || { echo "id invalido: $id" >&2; exit 1; }
[[ "$dias" =~ ^[0-9]{1,4}$ ]] || { echo "dias invalido: $dias" >&2; exit 1; }

contenedor="supabase_db_$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' "$(dirname "${BASH_SOURCE[0]}")/../../supabase/config.toml" | head -n1)"
filas="$(docker exec "$contenedor" psql -U postgres -tAq \
  -c "update public.ordenes set estado_en = now() - interval '$dias days' where id = '$id' returning 1")"
[[ "$filas" = "1" ]] || { echo "la orden $id no existe" >&2; exit 1; }
