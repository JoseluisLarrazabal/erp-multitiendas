# Despliegue de producción

De un proyecto Supabase vacío a la app en Vercel. Cumple RNF-12: producción se levanta siguiendo solo este documento.
Plan: `docs/plan-fase-6.md`. Comandos desde `web/` salvo que se diga otra cosa.

**Reglas:** nunca cargar `seed.sql` fuera de local. Las contraseñas y la `service_role` las escribe el CTO en su
terminal; no van a un chat ni al repo. Antes de cada comando con `--linked`, confirmar el proyecto enlazado:
`cat ../supabase/.temp/project-ref`.

## 1. Proyecto Supabase (CTO)

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

Preview queda apuntando a staging. Redesplegar producción (Deployments > el último de `main` > Redeploy): la CSP toma el
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

## 6. Backup

```bash
gh secret set SUPABASE_DB_URL   # pegar la cadena "Session pooler" del proyecto (Connect), no la directa
gh workflow run backup.yml
gh run watch
```

Debe terminar con `VERIFICACION OK` y el artifact `erp-backup-<fecha>`. Simulacro a mano en `docs/backup.md`.

## 7. Verificación

- [ ] `/login` en la URL pública; el dueño entra y ve sus 3 negocios en el selector
- [ ] El vendedor entra directo al punto de venta
- [ ] Abrir caja, vender y cerrar caja en un equipo real
- [ ] Una foto importada se ve en la ficha del producto (CSP)
- [ ] Backup diario en verde
- [ ] Playwright sobre producción sin sesión: `/`, `/panel` y `/pos` llevan a `/login`

## Dominio (al final)

Cuando se compre (RF-TR-10): Vercel > Domains, DNS según indique Vercel, y actualizar `site_url` y
`additional_redirect_urls` en `[remotes.produccion]` antes de un nuevo `config push`.
