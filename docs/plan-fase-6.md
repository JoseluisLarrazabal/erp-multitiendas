# Plan fase 6: salida

Objetivo (`docs/roadmap.md`): dejar el sistema listo para operar y firmar el acta. Requisitos RF-TR-10, RNF-08, RNF-09,
RNF-12, RF-MIG-01, RF-MIG-02. Criterios de salida de la Entrega A en `docs/plan-pruebas.md`.

**Fuera de esta fase (CTO, 2026-11-03):** el dominio se compra al final. RF-TR-10 queda abierto hasta entonces y el acta
no se firma sin él (cláusula octava).

## Decisiones (CTO, 2026-11-03)

- ~~Producción en un proyecto nuevo y limpio~~. **Reemplazado (CTO, 2026-11-04): producción es el ex staging
  `yfdhiuaeinfkvcegeqfy`, vaciado.** El 2026-11-04 se corrió `db reset --linked --no-seed`: 32 de 32 migraciones,
  0 usuarios de auth, 0 negocios, 0 ventas, 0 kardex, bucket `productos` y 106 permisos. Ya no hay staging: las
  migraciones se prueban solo en local y CI, Vercel tiene las variables solo en Production y `web/vercel.json` apaga
  los deploys de ramas que no son `main` (`git.deploymentEnabled`). Motivo probable (no verificado): el plan Free admite 2 proyectos activos y
  ya hay 2 (este y el de EleganceDominio).
- **El CTO crea el proyecto y su contraseña en su terminal.** Claude no ingresa contraseñas ni las ve. El CTO también
  carga el secreto `SUPABASE_DB_URL` (cadena "Session pooler", IPv4) con `gh secret set`.
- **Fotos en Supabase Storage**, el bucket privado `productos` que ya existe. El CTO preguntó por S3 o Cloudinary;
  recomendación: no sumar proveedor (1 GB Free alcanza; otro proveedor suma claves, CSP y URLs públicas fuera de la RLS).
- **Descarga de la planilla autorizada**: export xlsx al scratchpad, nunca al repo; se borra al terminar la carga.

## PRs

| PR | Rama | Contenido | Requisitos |
|---|---|---|---|
| 1 | `feat/backup-diario` | Workflow diario: dump de roles, esquema y datos; restauración en un Supabase efímero del runner; verificación (conteos iguales al origen, `stock` = kardex, usuarios de auth); cifrado `age` con clave pública del repo; artifact de 30 días. Scripts para restaurar a mano y cronometrar | RNF-08, RNF-09 |
| 2 | `feat/despliegue-produccion` | `docs/despliegue.md` (proyecto de cero hasta Vercel), bloque `[remotes.produccion]` en `config.toml` (la CLI lo mezcla sobre la base cuando el ref coincide; local sigue en localhost), `scripts/alta/alta-produccion.sql` corrido como `postgres` (negocios, ubicaciones, primer dueño). Se ensaya creando producción con ese documento | RNF-12 |
| 3 | `feat/importacion-fotos` | El script de importación extrae las fotos del xlsx (anclas de la hoja "Productos" a fila) y las sube al bucket por producto, sin redimensionar (máximo 341 KB). Idempotente | RF-MIG-01 |
| 4 | `docs/salida` | `docs/capacitacion.md` por rol, `docs/paralelo.md` (control diario contra el cuaderno), `docs/acta-entrega.md` (borrador) | Entrega A |

Después de los PRs 1 a 3: carga real en producción (productos, stock y fotos), conciliación, primer backup real y
simulacro cronometrado.

## Trampas

- `db.<ref>.supabase.co` es solo IPv6 y los runners de GitHub son IPv4: el backup usa el pooler en modo sesión.
- `supabase db dump --data-only` debe incluir `auth.users`; se verifica, no se supone (`docs/stack.md`).
- El dump en claro solo existe dentro del runner. Los logs muestran conteos, nunca filas.
- La clave privada `age` queda fuera del repo y fuera del contexto. Si se pierde, los backups no se pueden leer.
- `supabase link` cambia el proyecto enlazado: verificar `supabase/.temp/project-ref` antes de cada `db push`.
- La planilla trae 292 anclas y 280 imágenes únicas: hay fotos repetidas entre filas. La foto se asocia por fila al
  código interno, igual que el resto de la importación.
- Nunca cargar `seed.sql` en producción. El alta de negocios va en un script propio, sin usuarios de prueba.
- `service_role` solo en `scripts/`, por variable de entorno, nunca impresa.
- El primer dueño no puede crearse por `admin-usuarios`: `asignar_usuario` exige que el llamador ya tenga `usuarios`. Va
  por el script de alta, como `postgres` (`service_role` no tiene grants sobre `usuario_negocio` ni `dispositivos`).
- `config push` sin el bloque `[remotes.produccion]` sube `site_url` localhost, como pasó en staging.
- La CSP toma el origen de Supabase en build: cambiar las variables de Vercel exige redesplegar.

## Lo que depende del cliente o del CTO

Capacitación, 3 días de paralelo, prueba en los equipos reales con lector, conteo físico (P-17), precios en el panel,
firma del acta y compra del dominio.

## Verificación

- Backup: corrida real del workflow en verde, artifact descargado, descifrado y restaurado a mano con tiempo medido.
- Despliegue: producción creada siguiendo solo `docs/despliegue.md`; login real y rutas verificadas con Playwright.
- Carga: conciliación del script en producción sin diferencias; segunda corrida con 0 creados; fotos contadas.
- Criterios de salida: cada DB y E2E exigidos para la Entrega A tiene prueba que corre en CI.
