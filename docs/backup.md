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
5. Cifra el dump con `age` y la clave pública `scripts/backup/destinatario-age.txt`. Sube solo el `.age` como artifact
   `erp-backup-AAAA-MM-DD`, que GitHub guarda 30 días.

El dump en claro solo existe dentro del runner. Los logs muestran nombres de tabla y números, nunca filas.

Un backup que no restaura no cuenta: el paso 4 corre en cada backup, no solo en el simulacro.

CI corre el mismo ciclo contra la base local con seed (paso 10 de `ci.yml`), así que un cambio que rompa la restauración
falla en el PR.

## Requisitos

- Secreto `SUPABASE_DB_URL` en el repo (`gh secret set SUPABASE_DB_URL`). Debe ser la cadena **Session pooler** del
  proyecto de producción (panel de Supabase, "Connect"). La conexión directa `db.<ref>.supabase.co` es solo IPv6 y los
  runners de GitHub son IPv4.
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

# 4. Borrar el dump en claro.
rm -rf ~/restauracion
```

La URL de producción lleva contraseña: el CTO la escribe en su terminal, nunca en un chat ni en un archivo del repo.

## Qué no cubre

- **Archivos de Storage** (fotos de productos): el dump trae `storage.objects` (los metadatos) pero no los archivos. Hoy
  las fotos se pueden volver a importar desde la planilla. Cuando el cliente suba fotos nuevas desde el panel, hace
  falta respaldarlas aparte.
- **Configuración del proyecto** (auth, Edge Functions): se recrea con `docs/despliegue.md`.

## Tiempos

| Medición | Valor | Dónde |
|---|---|---|
| Dump (6,4 MB, base local con seed) | 6 s | local |
| Levantar el destino efímero | 30 s | local |
| Restauración | menos de 1 s | local |
| Paso 10 de CI completo | 38 s | local, simulado |
| Simulacro con datos reales de producción | no medido | pendiente tras la carga real |
