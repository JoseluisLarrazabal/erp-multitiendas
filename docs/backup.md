# Backup y restauración

Cumple RNF-08 (backup diario cifrado fuera de Supabase, con restauración probada) y RNF-09 (pérdida máxima de 24 h).
Plan: `docs/plan-fase-6.md`.

## Qué corre cada día

`.github/workflows/backup.yml` corre dos veces por día y a mano con "Run workflow" (ahí se elige el tipo; por defecto,
`completo`).

| Corrida | Cron (UTC) | Contenido | Tamaño | Se guarda |
|---|---|---|---|---|
| `completo` | `23 5 * * 0` (domingo) | Base de datos y fotos | unos 37 MB | 14 días |
| `base` | `23 5 * * 1-6` (lunes a sábado) | Solo la base de datos | cerca de 2 MB | 30 días |
| `base` | `23 17 * * *` (todos los días) | Solo la base de datos | cerca de 2 MB | 30 días |

La base se respalda dos veces al día; las fotos, una vez por semana.

**Por qué dos corridas.** GitHub arranca los cron con atraso: las corridas reales salieron entre 6,6 y 10 h después de
la hora programada, y entre las del 8 y del 9 de noviembre de 2026 pasaron 27 h. Con dos corridas separadas por 12 h
el hueco máximo queda en unas 15 h con ese atraso. Si GitHub salta una corrida entera, el hueco sube a unas 27 h: el
workflow no avisa de eso, hay que mirar la lista de corridas.

**Por qué dos retenciones.** Los artifacts de un repo privado cuentan contra el cupo de almacenamiento de Actions (500
MB en una cuenta Free). Una corrida completa diaria guardada 30 días ocupa 1,1 GB; con las completas semanales
guardadas 14 días (2 o 3 vivas) y las bases 30 días son unos 210 MB. Consecuencia: **el historial de fotos es de 14
días y el de la base, de 30.** Una foto borrada por error hace más de 14 días no se recupera.

**Por qué las fotos son semanales (decisión del CTO, 2026-11-10).** La cuenta Free da 2.000 minutos de Actions al mes
y el backup corre con ese mismo cupo. La corrida completa tarda de 5 a 13 minutos (bajar las fotos de a una varía de
83 a 521 s); la de base, 4. En noviembre de 2026 el CI gastó unos 1.600 minutos y quedaban unos 270 para 20 días: con
la completa diaria el cupo podía agotarse antes de fin de mes, y **sin minutos el backup deja de correr**. No se paga
por minutos. Costo aceptado: en una pérdida total de Supabase se pierden las fotos subidas desde el último domingo
(hasta 7 días, más el atraso de GitHub); los datos no cambian, se siguen copiando dos veces al día. Las fotos viven
en Supabase Storage: en el uso normal no se pierde ninguna. Se revisa el 2026-12-01, cuando el cupo se renueva: sin
el gasto de CI de noviembre la completa diaria cabe (270 a 510 minutos al mes); volver es cambiar los cron y la
retención en `backup.yml`.

Los pasos:

1. `scripts/backup/respaldar.sh`: `supabase db dump` en tres archivos, `roles.sql`, `schema.sql` y `data.sql`. `data.sql`
   incluye `auth.users` y `auth.identities`: los usuarios vuelven con el backup.
2. `scripts/backup/destino-efimero.sh`: levanta en el runner una Supabase vacía con la base, auth y storage (sus
   migraciones crean las tablas de `auth` y `storage` que el dump llena).
3. `scripts/backup/restaurar.sh`: restaura los tres archivos en una sola transacción, como `postgres` (el mismo usuario
   que da un proyecto Supabase), con los triggers apagados (`session_replication_role = replica`) para que el kardex no
   se recalcule dos veces. Filtra dos cosas que `postgres` no puede ejecutar y no hacen falta: `GRANT SET ON PARAMETER`
   de `roles.sql` (lo crea la plataforma) y los `COPY` sin filas.
4. `scripts/backup/verificar.sh`: cuenta las filas de cada tabla en `data.sql` y exige el mismo `count(*)` en la base
   restaurada (todas las tablas con filas, de `public`, `auth` y `storage`); exige que `auth.users` esté en el dump; y
   `stock` igual a la suma del kardex. Compara contra el dump y no contra producción en vivo, así una venta que entra
   durante el backup no da un falso fallo. Si algo no cuadra, el workflow falla.
5. `scripts/backup/respaldar-fotos.sh`: baja todos los archivos del bucket privado `productos` (fotos de productos) con la
   API REST de Storage y la clave `service_role` a `fotos/<negocio_id>/<producto_id>.<ext>`, dentro del mismo directorio
   del dump (va en el mismo `.age`). Corre antes del paso 4; rechaza nombres de objeto con `..` o `//`; cualquier error de
   descarga falla el workflow. **Si faltan los secretos `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`, el backup de la base
   sigue y este paso se omite con un `::warning::`** (la corrida queda verde pero con anotación amarilla: revisar).
   Solo corre en la corrida `completo`. `scripts/backup/verificar-fotos.sh` (paso propio, también solo en `completo`) exige que el número de archivos en `fotos/` sea igual al de
   filas de `storage.objects` del bucket `productos` en `data.sql`; si no, el workflow falla. Los logs muestran solo
   cantidades, nunca nombres.
6. Cifra el dump con `age` y la clave pública `scripts/backup/destinatario-age.txt`. Sube solo el `.age` como artifact
   `erp-backup-AAAA-MM-DDTHHMMZ-<completo|base>` (fecha y hora UTC del cifrado), que GitHub guarda 7 o 30 días según el
   tipo.

El dump en claro solo existe dentro del runner. Los logs muestran nombres de tabla y números, nunca filas.

Un backup que no restaura no cuenta: el paso 4 corre en cada backup, no solo en el simulacro.

CI corre el mismo ciclo contra la base local con seed (paso 10 de `ci.yml`), subiendo antes un objeto de prueba al bucket
para ejercitar también el respaldo de fotos (la restauración de fotos no corre en CI: el destino efímero no levanta la API
de Storage), así que un cambio que rompa la restauración
falla en el PR.

## Requisitos

- Secreto `SUPABASE_DB_URL` en el repo (`gh secret set SUPABASE_DB_URL`). Debe ser la cadena **Session pooler** del
  proyecto de producción (panel de Supabase, "Connect"). La conexión directa `db.<ref>.supabase.co` es solo IPv6 y los
  runners de GitHub son IPv4.
- Secretos `SUPABASE_URL` (`https://<ref>.supabase.co`) y `SUPABASE_SERVICE_ROLE_KEY` (panel de Supabase, Settings >
  API; `gh secret set SUPABASE_URL`, `gh secret set SUPABASE_SERVICE_ROLE_KEY`) para respaldar las fotos. Opcionales para
  que el backup de la base corra, pero sin ellos las fotos no se respaldan. La `service_role` solo se usa en el workflow y
  en `scripts/backup/`, vía variable de entorno; nunca en `web/`.
- La clave privada `age` vive fuera del repo, en la máquina del CTO (`~/.config/erp-multitiendas/backup-age.key`) y en
  una copia offline. **Si se pierde, ningún backup se puede leer.**

## Restaurar a mano

Para un simulacro, o para recuperar producción.

```bash
# 1. Bajar el artifact (Actions > Backup diario > la corrida) y descomprimir el zip. Sin -n baja el único artifact de
#    la corrida, se llame como se llame; queda en ~/restauracion/erp-backup-<fecha>T<hora>Z-<tipo>/.
gh run download <run-id> -D ~/restauracion

# 2. Descifrar y desempaquetar.
cd ~/restauracion
age -d -i ~/.config/erp-multitiendas/backup-age.key erp-backup-*/*.tar.age | tar -xf -

# 3a. Simulacro: restaurar en una Supabase local vacía y verificar contra el dump.
cd "<repo>"
destino=$(scripts/backup/destino-efimero.sh /tmp/destino erp-restauracion 54521)
scripts/backup/restaurar.sh ~/restauracion "$destino"
scripts/backup/verificar.sh ~/restauracion "$destino"
(cd web && pnpm exec supabase stop --workdir /tmp/destino --no-backup)

# 3b. Recuperación real: crear un proyecto Supabase nuevo (docs/despliegue.md hasta antes de db push),
#     restaurar con su cadena de conexión y apuntar Vercel a él.
scripts/backup/restaurar.sh ~/restauracion "<url del proyecto nuevo>"

# 3c. Fotos (solo si el backup es `completo`; uno `base` no trae fotos/): con el proyecto ya restaurado, subir los archivos al bucket `productos` (upsert). El bucket lo crean las
#     migraciones; la clave va por entorno, no por argumento.
SUPABASE_SERVICE_ROLE_KEY=<service_role del proyecto> scripts/backup/restaurar-fotos.sh ~/restauracion https://<ref>.supabase.co

# 4. Borrar el dump en claro.
rm -rf ~/restauracion
```

Para recuperar producción entera hacen falta dos artifacts cuando el más reciente es `base`: ese para la base de datos
y el último `completo` (el del domingo anterior: hasta una semana más viejo) para las fotos. Una foto subida entre
los dos se pierde; el producto queda sin foto y se vuelve a cargar.

La URL de producción lleva contraseña: el CTO la escribe en su terminal, nunca en un chat ni en un archivo del repo.

## Qué no cubre

- **Otros buckets de Storage**: solo se respalda `productos`. Si se crea otro bucket con archivos, hay que sumarlo.
- **Configuración del proyecto** (auth, Edge Functions): se recrea con `docs/despliegue.md`.

## Tiempos

| Medición | Valor | Dónde |
|---|---|---|
| Dump (6,4 MB, base local con seed) | 6 s | local |
| Levantar el destino efímero | 30 s | local |
| Restauración | menos de 1 s | local |
| Paso 10 de CI completo | 38 s | local, simulado |
| Simulacro con datos reales de producción (backup cifrado de 1,6 MB) | 50 s: descarga 4 s, descifrado menos de 1 s, destino 44 s, restauración 1 s, verificación 1 s | local, 2026-11-04 |
| Respaldo de fotos (2 archivos de prueba, base local) | menos de 1 s | local |
| Corrida `completo` real con fotos (292 fotos, 37 MB; artifact cifrado 37 MB) | 602 s: dump 88 s, fotos 398 s (descarga de a una), restauración y verificación 77 s, cifrado 1 s, subida 2 s | GitHub Actions, run 41961859964, 2026-11-05 |
