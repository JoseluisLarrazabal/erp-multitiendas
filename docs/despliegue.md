# Despliegue de producción

De un proyecto Supabase vacío a la app en Vercel. Cumple RNF-12: producción se levanta siguiendo solo este documento.
Plan: `docs/plan-fase-6.md`. Comandos desde `web/` salvo que se diga otra cosa.

**Reglas:** nunca cargar `seed.sql` fuera de local. Las contraseñas y la `service_role` las escribe el CTO en su
terminal; no van a un chat ni al repo. Antes de cada comando con `--linked`, confirmar el proyecto enlazado:
`cat ../supabase/.temp/project-ref`.

## 1. Proyecto Supabase (CTO)

**Producción actual (2026-11-04):** `yfdhiuaeinfkvcegeqfy`, el ex staging, vaciado con
`pnpm exec supabase --workdir .. db reset --linked --no-seed --yes`. Ese comando borra toda la base, incluido
`auth.users`, y reaplica las migraciones: solo vale antes de cargar datos reales. Con producción en uso, nunca.

Proyecto nuevo de cero:

```bash
pnpm exec supabase projects create erp-produccion --org-id mvrgvtvszaovqvjvuwfq --region sa-east-1 \
  --db-password "$(read -rsp 'Contraseña: ' p; echo "$p")"
pnpm exec supabase link --project-ref <ref> --workdir ..
cat ../supabase/.temp/project-ref   # debe ser <ref>, no staging (yfdhiuaeinfkvcegeqfy)
```

## 2. Esquema y configuración

```bash
pnpm exec supabase --workdir .. db push --linked --dry-run   # revisar la lista: todas las migraciones, sin seed
pnpm exec supabase --workdir .. db push --linked
pnpm exec supabase --workdir .. config push                    # usa el bloque [remotes.produccion] de config.toml
pnpm exec supabase --workdir .. functions deploy admin-usuarios
```

En una actualización el orden importa: primero las migraciones, después la función `admin-usuarios` y al final la web.
La función y la web nuevas llaman a objetos que crean las migraciones; mientras no se aplican, las pantallas nuevas
fallan. Antes de `db push` en producción: backup manual en verde.

Vercel publica la web en cuanto se mergea a `main`, así que ese orden solo se cumple si las migraciones se aplican
**antes del merge**, con el PR ya revisado y el CI en verde. Vale cuando las migraciones son aditivas (objetos nuevos,
`create or replace` compatible con la web vieja), que es lo normal. Secuencia: backup manual (unos 5 a 13 minutos) →
`db push --linked --dry-run` → `db push --linked` → `functions deploy` → merge. Si una migración rompe la web vieja,
no hay orden bueno: se hace en ventana sin uso. El 2026-11-10 (PR #95) se mergeó primero y la web nueva estuvo unos
14 minutos sin sus migraciones, de madrugada.

- Las migraciones traen la matriz de permisos (`rol_permisos`) y el bucket privado `productos`.
- `config.toml` tiene `site_url` localhost para el entorno local. El bloque `[remotes.produccion]`, con el ref de
  producción, lo reemplaza por la URL pública al hacer `config push`. Sin ese bloque, producción queda con localhost
  (pasó en staging). Debe mantener `enable_signup = false` y claves de 8+ caracteres con letras y dígitos.
- `admin-usuarios` no necesita secretos propios: Supabase le inyecta URL, anon y service role.

Verificar en el panel de Supabase: Auth > URL Configuration muestra la URL pública; Auth > Providers > Email activo con
el registro cerrado.

## 3. Dueño y negocios

1. Crear la cuenta del dueño en Supabase > Authentication > Add user (con "Auto Confirm"). Contraseña: la elige el
   dueño o se la entrega el CTO en persona.
2. Alta de los 3 negocios, sus ubicaciones y la membresía del dueño (desde cualquier directorio):

```bash
ALTA_DUENO_EMAIL=... ALTA_NEGOCIO_TIENDA=... ALTA_NEGOCIO_LAVANDERIA=... ALTA_NEGOCIO_FRIAL=... \
  scripts/alta/alta-produccion.sh --linked
```

El reporte final da un `negocio_id` por negocio: guardar el de la tienda para la importación. Se puede repetir sin
duplicar nada.

## 4. Vercel

En el proyecto `erp_multitiendas`, Settings > Environment Variables, **solo en Production**:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del proyecto nuevo (Settings > API) |

Sin staging no hay previews: `web/vercel.json` apaga los deploys de toda rama que no sea `main` (`git.deploymentEnabled`). Redesplegar producción (Deployments > el último de `main` > Redeploy): la CSP toma el
origen de Supabase al construir, así que sin redespliegue el navegador bloquea las llamadas al proyecto nuevo.

## 5. Datos del cliente

Con el dueño logueado en el panel:
1. "Dispositivos": un equipo por caja (prefijo, p. ej. C1) en su ubicación.
2. "Usuarios": las cuentas del personal con su rol.
3. "Descuento": el tope (con 0 % nadie descuenta).
4. "Tipo de cambio": si hay precios en USD.

Importación de Lider con fotos (`docs/migracion-datos.md`), desde `scripts/importacion`, con `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` de producción exportadas en la terminal del CTO:

```bash
node src/main.ts --archivo <planilla.xlsx> --negocio <id de la tienda> --seco --reporte <fuera del repo>
node src/main.ts --archivo <planilla.xlsx> --negocio <id de la tienda> --produccion --esperadas 597 --reporte <fuera del repo>
node src/main.ts ... --produccion ...   # segunda corrida: 0 creados, 0 fotos subidas
```

Los precios los carga el cliente en "Precios".

## Limpieza de pruebas antes del paralelo

Se corre una sola vez, después de la capacitación y antes del paralelo (`docs/plan-limpieza-pruebas.md`). Borra todo lo
transaccional con fecha >= `--desde` (ventas, cajas, órdenes, clientes, kardex, conteos, compras, pagos a proveedores y proveedores creados en la ventana) y recalcula `stock` y la
numeración; conserva usuarios, productos, precios, fotos y auditoría. `--desde` es el inicio de la capacitación, con zona
horaria (`2026-11-10T08:00:00-04:00`). Si el stock inicial de la importación es posterior a ese corte, también se borra:
el script aborta (también en seco): elegí un `--desde` posterior a la importación.

```bash
# 1. Backup manual en verde justo antes (sección 6). Sin backup en verde no se sigue.
# 2. Seco: cuenta qué borraría y deshace. Revisar los conteos.
SUPABASE_DB_PASSWORD=... scripts/limpieza/limpiar-pruebas.sh --desde <ISO con zona> --linked
# 3. Real: exige el ref del proyecto (supabase/.temp/project-ref)
CONFIRMAR=<ref> SUPABASE_DB_PASSWORD=... scripts/limpieza/limpiar-pruebas.sh --desde <ISO con zona> --aplicar --linked
```

`--linked` lee `supabase/.temp/pooler-url` (`supabase link`); alternativa: `--db-url <session pooler>` o `--local`. Si una
aserción final falla (stock distinto del kardex, filas >= `--desde`), la transacción se deshace entera.

**Qué hacer en cada equipo (PWA).** El servidor no sabe qué navegador tiene qué contador: la app usa
`max(contador local, dispositivos.ultimo_numero)` (`use-envio.ts`, `cola-ventas.ts`), así que un contador viejo en el
navegador devolvería los números de prueba aunque el servidor quede en 0.
- Antes de limpiar: en cada equipo, caja cerrada, sin aviso de cola y todo sincronizado. Lo que quede en la cola
  (IndexedDB `erp-pos`, tabla `cola`) se envía después de limpiar y reaparece como venta.
- Después de limpiar, en cada equipo, una de dos:
  1. Borrar solo el contador: consola del navegador, `localStorage.removeItem('erp:pos:contador:<id del dispositivo>')`
     y recargar. Conserva la sesión y el equipo elegido.
  2. Borrar los datos del sitio (DevTools > Application > Clear site data). Cierra la sesión y borra la cola y el
     snapshot offline (`erp-pos`); se vuelve a entrar con la cuenta y se elige otra vez el equipo en el POS (la
     elección es `erp:pos:equipo:<negocio>` en localStorage). El equipo es una fila de `dispositivos` en el servidor:
     no se pierde ni se desregistra. El contador se repone desde `ultimo_numero` (0).
- Comprobar: la primera venta real del equipo debe ser `<prefijo>-000001` (o el siguiente al último previo que quede).

**Regla:** backup en verde justo antes, y nunca después de empezar el paralelo: esas ventas son reales.

## 6. Backup

```bash
gh secret set SUPABASE_DB_URL   # pegar la cadena "Session pooler" del proyecto (Connect), no la directa
gh workflow run backup.yml
gh run watch
```

`gh workflow run backup.yml` corre el tipo `completo` (base y fotos); con `-f tipo=base` respalda solo la base. Debe
terminar con `VERIFICACION OK` y el artifact `erp-backup-<fecha>T<hora>Z-<tipo>`. Simulacro a mano en `docs/backup.md`.

El backup de fotos necesita además los secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (`docs/backup.md`,
"Requisitos"); sin ellos la corrida queda verde con un aviso y las fotos no se respaldan.

## 7. Verificación

- [ ] `/login` en la URL pública; el dueño entra y ve sus 3 negocios en el selector
- [ ] El vendedor entra directo al punto de venta
- [ ] Abrir caja, vender y cerrar caja en un equipo real
- [ ] Una foto importada se ve en la ficha del producto (CSP)
- [ ] Backup en verde: las dos corridas del día (`base`; la del domingo a las 05:23 UTC es `completo`, con fotos)
- [ ] Playwright sobre producción sin sesión: `/`, `/panel` y `/pos` llevan a `/login`

## Dominio (al final)

Cuando se compre (RF-TR-10): Vercel > Domains, DNS según indique Vercel, y actualizar `site_url` y
`additional_redirect_urls` en `[remotes.produccion]` antes de un nuevo `config push`.
