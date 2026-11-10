# Plan: cierre de la auditoría previa a la entrega (4 PRs)

## Contexto

`docs/auditoria-preentrega.md` (2026-11-09) dejó 6 bloqueantes de código (B-1 a B-6), 16 hallazgos medios y el paquete
de entrega en rojo. El CTO aprobó el 2026-11-09: el camino de 4 PRs y M-1 con la opción recomendada, ambos a cargo del
chairman; la consulta de colisiones de B-1 en producción; y dejó la rotación de credenciales y la compra del dominio
para cuando el producto esté listo para entregar. Objetivo: dejar el código y los documentos en estado entregable.

Resultado de la consulta autorizada (producción, solo lectura): 597 productos, 330 con código de barras, **0
colisiones**. B-1 es un defecto latente, no activo; se arregla igual.

Hallazgo nuevo al planificar B-4: los artifacts de Actions vivos suman 240 MB y crecen 37 MB por día. Si la cuenta de
GitHub es Free (500 MB), **el backup empieza a fallar hacia el 2026-11-16 aunque no se toque nada**. El plan de la
cuenta no se pudo leer; el arreglo de B-4 se diseña para caber en Free.

## Cómo se ejecuta cada PR

Rama → Opus baja el PR a pasos (hecho para el PR 1; al arrancar para el 2 y el 3) → subagentes Sonnet implementan en
paralelo sobre archivos disjuntos → el chairman revisa el diff → `/code-review` + `/ponytail-review` (+
`/security-review` y revisión de Opus en auth, RLS y dinero) → arreglos con Sonnet nuevo → verificación local con los
pasos 1 a 8 del CI → commit, push, PR (sin atribución de IA) → CI verde → merge → despliegue → verificación en
producción con Playwright → `docs/handoff.md`. Codex: no verificado (sin cuota hasta el 2026-12-03); se anota en cada PR.

Al aprobarse este plan se copia a `docs/plan-preentrega.md` y se enlaza en el handoff (reglas 8 y 8.b).

**Despliegue a producción tras cada merge con migraciones** (acción hacia afuera, queda cubierta por esta aprobación):
disparar un backup manual y esperar que termine → `supabase db push --linked --dry-run` → revisar → `db push --linked`
→ `supabase functions deploy admin-usuarios` (solo PR 1) → comprobar. Orden: migraciones, función, web. Las migraciones
son aditivas (`create or replace`, objetos nuevos); ninguna borra datos.

## PR 1: bloqueantes (`fix/bloqueantes-preentrega`)

Seis subagentes, un commit por bloqueante. Nadie toca `erp-errores.ts`. Nadie sube `database.types.ts`: el integrador
corre `pnpm db:types` una vez al final. Orden de integración: B-4, B-1, B-6, B-2, B-3, B-5.

**B-1, código repetido en el POS.** `web/src/modules/ventas/domain.ts`: `exactos` pasa a `Map<string, number[]>`
(acumula código y barras sin repetir; cubre también "ABC" contra "abc", que la base permite). `porCodigoExacto` →
`candidatosExactos(): ProductoPos[]`. `buscar` pone primero las coincidencias exactas. `use-venta.ts` `alEnter`: 1
candidato agrega; 2 o más no agrega y avisa "Ese código coincide con N productos: elige uno."
`inventario/components/selector-producto.tsx:108-114`: `filter` en vez de `find`, elige sola solo con 1 exacta.
Pruebas: `domain.test.ts` (colisión barras/código, mayúsculas, exactos primero), caso nuevo en
`tests/e2e/pos-venta.spec.ts`; E2E-08 sigue bajo 200 ms.

**B-2, conteo con reservas.** Migración `20261109130000_conteo_reservado.sql`: vista `stock_reservado (negocio_id,
producto_id, ubicacion_id, cantidad)` con `security_invoker` y `select` solo a `authenticated`; `create or replace
registrar_conteo` (copiada de `20261108130000_auditoria_entrega_a.sql:1296-1391`) donde lo esperado es `stock +
reservado activo`, leído en una sentencia aparte **después** del `for update` sobre `stock`. Trampas: conservar literal
`order by (e ->> 'producto_id')::uuid` (lo busca `supabase/tests/auditoria-entrega-a.sql:170`); si lo contado es menor
que lo reservado el stock queda negativo, se deja así y se avisa en pantalla y manual. Web: `inventario/queries.ts`
`paginaConteo` devuelve `sistema = stock + reservado` y `reservado`; `lista-conteo.tsx` y `conteo-revision.tsx`
muestran "Sistema 10 (3 reservadas)". pgTAP nuevo `supabase/tests/rpc-conteo-reservas.sql` (fixtures de
`rpc-reservas.sql`): 10 con reserva de 3 y conteo 10 → sin ajuste; cancelar → 10; conteo 9 → −1; la vista no se lee
como anon ni desde otro negocio.

**B-3, datos de la nota.** Migración `20261109130100_datos_negocio.sql`: RPC `guardar_datos_negocio(p_negocio_id,
p_nit, p_datos_nota)`, permiso `usuarios`, NIT hasta 20 caracteres, nota hasta 300 caracteres y 6 líneas, auditoría
solo si cambió. Se copia el patrón del tope de descuento (`fijar_tope_descuento`,
`app/(panel)/panel/descuento/page.tsx`, `form-tope.tsx`, `ventas/actions.ts:90-100`). Nuevos: página
`app/(panel)/panel/negocio/page.tsx`, `ventas/components/form-datos-negocio.tsx`, acción `guardarDatosNegocio`, ítem en
`panel-items.ts` y caso en `panel-nav.test.ts`. pgTAP `rpc-datos-negocio.sql`; E2E `datos-negocio.spec.ts` (guardar,
vender, ver NIT y dirección en la nota).

**B-4, backup.** `.github/workflows/backup.yml`: dos corridas, `23 5 * * *` (completa: base y fotos, retención 7 días)
y `23 17 * * *` (solo base, ~1 MB, retención 30 días); nombre con hora y tipo
(`erp-backup-<fecha>T<hhmm>Z-completo|base`); los pasos de fotos y su verificación, condicionados. Ocupa unos 290 MB
contra los 1,1 GB actuales. Pérdida máxima de datos: unas 15 h en régimen normal; 27 h si GitHub salta una corrida.
**Cambia una promesa escrita**: las fotos pasan de 30 a 7 días de historial; la base conserva 30. `docs/backup.md` y
`docs/despliegue.md` se actualizan en el mismo PR.

**B-5, contraseñas.** Migración `20261109130200_auditar_clave.sql`: amplía el check de `auditoria.accion` con
`restablecer_clave` y crea `auditar_clave(p_actor_id, p_usuario_id)` solo para `service_role`.
`supabase/functions/admin-usuarios/index.ts`: acción `restablecer_clave {usuario_id, clave}` en rama explícita antes
del baneo (hoy todo lo que no es `crear` cae al baneo), autorizada con `puede_administrar_cuenta` (un encargado no
toca a un dueño ni a sí mismo), `updateUserById({password})`, auditoría. Web: `usuarios/actions.ts`
`restablecerClave`, `acciones-fila.tsx` + `dialogo-restablecer-clave.tsx`; `boton-cambiar-clave.tsx` (solo cliente:
verifica la actual con `signInWithPassword`, cambia con `updateUser`) junto a "Cerrar sesión" en
`app/(panel)/panel/layout.tsx` y `pos-sesion.tsx`. Sin correo de recuperación (no hay SMTP), sin forzar cambio en el
próximo ingreso y sin cerrar las sesiones del destino (la API no lo permite por id; para una cuenta comprometida
existe "Desactivar"). Pruebas: `tests/integracion/admin-usuarios.test.ts` (sin permiso, negocio ajeno, encargado sobre
dueño, clave débil, ciclo clave vieja/nueva, fila de auditoría) y E2E en `usuarios.spec.ts`.

**B-6, cobro en línea que sobrevive a la recarga.** Nuevo `ventas/cobro-pendiente.ts` (patrón de `cobro-cuota.ts`) en
**`localStorage`**, clave `erp:cobros-en-linea:<negocio>:<equipo>` sin usuario, validado con Zod. No sirve
`sessionStorage` (muere con la PWA) ni el IndexedDB `datos` (se borra al cerrar sesión y traga errores). El pendiente
se guarda **antes** de enviar; si no se puede guardar, no se cobra. Tras recargar, aviso fijo "Cobro sin confirmar ·
Verificar cobro" que consulta `existeVenta` (no reenvía) y muestra la nota; si no existe y tiene menos de 60 s, no se
descarta. `cobro-cuota.ts` pasa también a `localStorage`. El cierre de caja se bloquea con cola, cobros en línea y
cuotas sin confirmar (`venta-en-curso.tsx`). `beforeunload` propio mientras hay envío o pendiente (solo sirve en
escritorio). Archivos: `cobro-pendiente.ts`, `cobro-en-linea.ts`, `use-envio.ts`, `cobro-cuota.ts`,
`components/venta-en-curso.tsx` y sus tests. E2E en `credito.spec.ts`: recargar 120 ms después de confirmar → aviso →
verificar → nota → exactamente 1 crédito.

## PR 2: Entrega B (`fix/entrega-b-preentrega`)

Opus lo baja a pasos al arrancar. Decisiones ya tomadas:

- **M-1**: `cancelar_reserva` exige además `anular` (dueño y encargado). El vendedor ve la reserva y el texto "pide a
  un encargado". pgTAP, E2E-13 y matriz del SRS al día.
- **M-2**: tres reversos por contraasiento, nunca borrado, con permiso `anular`: `anular_pago_cuota` y
  `anular_pago_proveedor` (solo el último pago, para no reabrir imputaciones) y `anular_compra` (solo sin pagos vivos y
  con stock suficiente en la ubicación). Es el cambio más grande del plan; lleva revisión de Opus y `/security-review`.
- **Encargados (decisión del CTO, 2026-11-10): solo el dueño gestiona a los encargados.** Asignar el rol
  `encargado`, cambiar el rol de un encargado, quitarlo, desactivarlo o reactivarlo y restablecer su contraseña exigen
  ser dueño del negocio. Toca `asignar_usuario`, `quitar_usuario`, `puede_asignar_rol`, `puede_administrar_cuenta`
  (y con ella `puede_restablecer_clave`), la función `admin-usuarios`, la pantalla de personal (acciones ocultas y
  opción "Encargado" fuera del selector para quien no es dueño) y la matriz del SRS. Cierra el rodeo que el PR 1 dejó
  anotado (bajar el rol, restablecer, devolver el rol). pgTAP, integración y E2E. Lleva `/security-review` y revisión
  de Opus.
- **M-5**: `/panel/ventas` distingue venta a crédito y de reserva, oculta Anular y Devolver con explicación y enlaza
  los pagos del crédito.
- **M-6**: reimprimir el plan de cuotas desde el crédito; marcar documentos después de vender.
- **M-7**: mensaje propio de `ERP_OPERACION_REPETIDA` en reserva, cuota y cancelación, con salida.
- **M-8**: la compra en el frial pide lote y vencimiento por línea, con la lógica de `registrar_entrada_lote`. No se
  oculta "Compras" en el frial.

## PR 3: operación diaria (`fix/operacion-diaria-preentrega`)

Opus lo baja a pasos al arrancar. M-9 (texto del criterio en reportes, sin cambiar cálculos), M-10, M-11, M-12
(búsquedas sin tildes), M-13 (número de documento en kardex), M-14, M-16 (barra de modos del POS a 390 px, por el
camino único de la regla 7), M-17, las pruebas que no discriminan y brechas de la sección 4, y los dos "no
concluyentes" del QA (service worker con build viejo; refresco del precio de crédito en el POS).

Añadido el 2026-11-09 (pedido del CTO, que espera que el catálogo de fotos crezca): **comprimir la foto en el navegador
antes de subirla**. Hoy `web/src/modules/catalogo/foto.ts` sube el archivo tal cual, hasta 5 MB; una foto de celular
pesa de 2 a 5 MB contra los 60 KB de promedio de las 597 importadas. Se redimensiona al lado mayor de 1.200 px y se
recodifica a WebP con `canvas` (sin dependencia nueva), con salida esperada de 50 a 150 KB; si el navegador no puede,
se sube el original. Las fotos ya guardadas no se tocan. Alivia a la vez el cupo de Supabase Storage (1 GB), el tamaño
del backup y la carga de la lista en el celular.

## PR 4: documentos (`docs/paquete-entrega`)

Los escribe el chairman: acta (punto 6 redactado con los extras; la garantía queda en blanco hasta D-01), paralelo
(limpieza, contador por equipo, extras), capacitación, despliegue, las 17 reglas faltantes en `docs/manual/` más lo
que cambian los PR 1 a 3, `docs/srs.md` (RF-INV-06, RF-VEN-05, contraseñas, RNF-09), contradicciones del handoff y
cierre de brechas en `auditoria-entrega-a.md` y `decisiones-manual.md`.

## Verificación

- Por PR: `scratchpad/verificar.sh` (lint, formato, `tsc`, Vitest, `db reset` + pgTAP, tipos sin diferencias, build,
  integración, Playwright) en verde antes del commit; CI verde antes del merge.
- QA con Playwright en local de cada arreglo, repitiendo las reproducciones de la sección 6 de la auditoría: código
  "25" repetido, 10 → reserva 3 → conteo 10, nota con dirección, recarga a 120 ms del cobro a crédito, restablecer y
  cambiar contraseña.
- Producción tras cada despliegue: `supabase migration list` igual local y remoto, deploy `READY`, `/panel` y `/pos`
  sin sesión llevan a `/login`, 0 errores de consola, 0 errores de runtime en Vercel. B-4: dos corridas reales del
  backup con el nombre y la retención nuevos.

## Fuera de este plan y no verificado

- Diferido por el CTO hasta el cierre: rotar credenciales y comprar el dominio. La objeción ya está dicha; no se repite.
- M-15 (registro de errores, RNF-16) no entra: exige elegir proveedor. Queda como límite conocido en el PR 4.
- M-3 y P-07 (interés en el prepago), P-06, P-12: preguntas al cliente. D-01, D-02, D-04: decisiones del CTO.
- No verificado: plan y cupo de GitHub (almacenamiento y minutos; el CTO lo ve en Billing); si producción tiene
  `secure_password_change=false`; QA autenticado en producción (necesita que el CTO escriba una contraseña); hardware
  real; Codex.
- Los pasos de los PR 2 y 3 son alcance y decisiones, no plan detallado: se detallan al arrancar cada uno.
