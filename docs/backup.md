# Backup y restauración

Cumple RNF-08 (backup diario fuera de Supabase) y RNF-09 (restauración probada). Plan: `docs/plan-fase-6.md`.

## Qué corre cada día

`.github/workflows/backup.yml`, a las 03:00 de La Paz (`0 7 * * *` UTC), y a mano con "Run workflow".

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
   `scripts/backup/verificar-fotos.sh` (dentro del paso 4) exige que el número de archivos en `fotos/` sea igual al de
   filas de `storage.objects` del bucket `productos` en `data.sql`; si no, el workflow falla. Los logs muestran solo
   cantidades, nunca nombres.
6. Cifra el dump con `age` y la clave pública `scripts/backup/destinatario-age.txt`. Sube solo el `.age` como artifact
   `erp-backup-AAAA-MM-DD`, que GitHub guarda 30 días.

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
# 1. Bajar el artifact (Actions > Backup diario > la corrida > erp-backup-AAAA-MM-DD) y descomprimir el zip.
gh run download <run-id> -n erp-backup-AAAA-MM-DD -D ~/restauracion

# 2. Descifrar y desempaquetar.
cd ~/restauracion
age -d -i ~/.config/erp-multitiendas/backup-age.key erp-backup-AAAA-MM-DD.tar.age | tar -xf -

# 3a. Simulacro: restaurar en una Supabase local vacía y verificar contra el dump.
cd "<repo>"
destino=$(scripts/backup/destino-efimero.sh /tmp/destino erp-restauracion 54521)
scripts/backup/restaurar.sh ~/restauracion "$destino"
scripts/backup/verificar.sh ~/restauracion "$destino"
(cd web && pnpm exec supabase stop --workdir /tmp/destino --no-backup)

# 3b. Recuperación real: crear un proyecto Supabase nuevo (docs/despliegue.md hasta antes de db push),
#     restaurar con su cadena de conexión y apuntar Vercel a él.
scripts/backup/restaurar.sh ~/restauracion "<url del proyecto nuevo>"

# 3c. Fotos: con el proyecto ya restaurado, subir los archivos al bucket `productos` (upsert). El bucket lo crean las
#     migraciones; la clave va por entorno, no por argumento.
SUPABASE_SERVICE_ROLE_KEY=<service_role del proyecto> scripts/backup/restaurar-fotos.sh ~/restauracion https://<ref>.supabase.co

# 4. Borrar el dump en claro.
rm -rf ~/restauracion
```

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
| Corrida diaria real con fotos (292 fotos, 37 MB; artifact cifrado 37 MB) | 602 s: dump 88 s, fotos 398 s (descarga de a una), restauración y verificación 77 s, cifrado 1 s, subida 2 s | GitHub Actions, run 41961859964, 2026-11-05 |
