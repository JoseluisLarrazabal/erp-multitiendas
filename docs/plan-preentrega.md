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

### Plan detallado del PR 2 (Opus, 2026-11-10; arbitrado por el chairman)

**Decisiones del chairman sobre el plan** (dentro del encargo "el punto 1 y 2 quedan a tu cargo"):

1. `anular_compra` al contado: "solo sin pagos vivos" al pie de la letra impide anular toda compra al contado, porque
   su pago automático siempre está vivo, y ese es el caso de la auditoría (1.000 en vez de 100). Se revierte el pago
   automático dentro de `anular_compra` y se exige que la deuda resultante del proveedor sea mayor o igual a 0.
2. El reverso de una cuota cobrada en una caja ya cerrada sale de otra caja abierta, igual que `cancelar_reserva` y la
   devolución. El arqueo cerrado no cambia.
3. Los documentos del crédito se pueden desmarcar, con auditoría.
4. No se parte el PR (cupo de CI). M-2 va en migraciones y commits propios, al final; si la revisión lo rechaza se saca
   antes del único push.
5. Una compra con productos con serie no se anula (`ERP_COMPRA_CON_SERIES`). Límite conocido.

**Estado de producción (consulta de solo lectura, 2026-11-10):** 0 compras, 0 pagos de cuota, 0 pagos a proveedor y 0
encargados en los tres negocios. Ninguna migración de este PR choca con datos existentes. M-8 no es compatible con la
web vieja (la base pasa a exigir lote en el frial), pero el frial no tiene compras y la ventana entre `db push` y el
deploy de Vercel es de minutos.

**Reparto** (cinco subagentes Sonnet en worktrees, archivos disjuntos). Nadie toca `erp-errores.ts` ni `docs/srs.md`
(la matriz la actualiza el chairman al integrar). Nadie sube `database.types.ts`. Orden de integración: B, A, E, C, D;
después `db reset`, `pnpm db:types`, `tsc` y commit de tipos.

| Tema | Migraciones nuevas | Archivos principales |
|---|---|---|
| A. M-1 y M-7 | `20261110120000_cancelar_reserva_anular.sql` | `ventas/components/reservas-pos.tsx`, `form-reserva.tsx`, `venta-en-curso.tsx` (prop), `reservas.ts`, `creditos-pos.tsx`, `cobro-cuota.ts`; `tests/rpc-reservas.sql`; `e2e/reservas.spec.ts`, `e2e/credito.spec.ts` |
| B. Encargados | `20261110120100_solo_dueno_encargados.sql` | `admin-usuarios/index.ts`; `usuarios/domain.ts` y su test; `tests/rpc-asignar-quitar-usuario.sql`, `puede-asignar-rol.sql`, `encargados-solo-dueno.sql` (nuevo); `integracion/admin-usuarios.test.ts`; `e2e/usuarios.spec.ts` |
| C. Reverso de cuota y M-6 | `20261110120200_reverso_cuota_documentos.sql` | `creditos/{actions,schemas,domain,panel}.ts`, `components/detalle-credito.tsx` y tres componentes nuevos; `ventas/components/plan-credito.tsx`; `app/(panel)/panel/creditos/[id]/page.tsx`, `panel/layout.tsx`; `tests/rpc-reverso-cuota.sql`; `e2e/credito-reversos.spec.ts` |
| D. M-8 y reversos de compras | `20261110120300_compra_lotes_frial.sql`, `20261110120400_reversos_compras.sql` | `compras/{schemas,actions,domain,queries,panel}.ts` y componentes; páginas de compras y proveedores; `inventario/domain.ts` (etiqueta); `tests/rpc-compras-frial.sql`, `rpc-reversos-compras.sql`; `e2e/compras.spec.ts` |
| E. M-5 | ninguna | `ventas/lecturas-panel.ts` y su test, `components/{lista-ventas,detalle-venta}.tsx`, `app/(panel)/panel/ventas/[id]/page.tsx`; `e2e/ventas-especiales.spec.ts` |

**A. M-1.** `create or replace cancelar_reserva`, copiada íntegra de `20261108150000_reservas.sql:246-296`; solo se
agrega `or not tiene_permiso(negocio,'anular')` a la condición de permiso. `ReservasPos` recibe `puedeCancelar`; sin el
permiso muestra "Para cancelar la reserva, pide a un encargado." pgTAP: los bloques que cancelan como vendedor pasan a
dueño y se agrega el rechazo `ERP_SIN_PERMISO`. E2E-13: el vendedor ve el texto y ningún botón; cancela un encargado.

**A. M-7.** `reclamar_operacion` solo da `ERP_OPERACION_REPETIDA` si un intento anterior con ese id se confirmó.
Reserva: estrenar id, recargar la lista y avisar que la reserva quedó con los datos del primer intento. Cuota: tratarla
como cobrada, limpiar el pendiente, recargar y avisar que revise el saldo. Cancelación: solo cambia el texto. Textos en
`reservas.ts` y `cobro-cuota.ts` con Vitest; E2E de respuesta perdida cambiando el monto y reenviando.

**B. Encargados.** Cuatro `create or replace` copiadas de `20261101120500`, `20261101120600` y `tenencia.sql:145-169`:
`asignar_usuario` (`p_rol in ('dueno','encargado') or v_rol_actual in ('dueno','encargado')` exige dueño),
`quitar_usuario` (`v_rol_actual in ('dueno','encargado')`), `puede_asignar_rol` (`p_rol not in ('dueno','encargado') or
es_dueno`), `puede_administrar_cuenta` (por cada negocio donde el objetivo es dueño o encargado, quien llama debe ser
dueño). `puede_restablecer_clave` no se toca: su regla queda contenida. Se reusa `ERP_DUENO_PROTEGIDO`; su mensaje pasa
a nombrar también al encargado. La función `admin-usuarios` exige dueño para crear un encargado. En la web,
`rolesOfrecidos` no ofrece "Encargado" a quien no es dueño y la fila de un encargado queda sin acciones. Pruebas: caso
cruzado (X dueño de T y encargado de L; Y encargado de L y vendedor de T), integración (un encargado no crea, no
desactiva ni restablece a otro encargado; no queda cuenta huérfana) y E2E.

**C. `anular_pago_cuota(p_operacion_id, p_pago_operacion_id, p_sesion_id, p_dispositivo_id, p_motivo)`.** El
contraasiento es una fila negativa en `credito_pagos`, así saldo, FIFO de `cuotas_con_pago`, `efectivo_esperado`,
`total_qr_sesion` y `resumen_caja` quedan bien sin copiarlos. DDL: columnas `anula_operacion_id` y `motivo`; el check de
monto pasa a `(anula is null and monto>0) or (anula is not null and monto<0)`; índice único parcial
`(anula_operacion_id, medio)`. Pasos: permiso `anular` y mismo negocio; motivo de 1 a 200; `reclamar_operacion`; bloquear
sesión (`ERP_CAJA_CERRADA`) y luego crédito; ya revertido devuelve `ya_anulado`; no es el último pago vivo da
`ERP_PAGO_NO_ES_ULTIMO`; efectivo mayor que el esperado en la sesión da `ERP_EFECTIVO_INSUFICIENTE`; insertar filas
negativas por medio; un crédito `pagado` vuelve a `activo`. `detalle_credito` suma `operacion_id`, `anula_operacion_id`,
`motivo` y `ultimo_pago_id` (la web de producción ignora campos nuevos: Zod sin `strict`).

**C. M-6.** `marcar_documentos_credito(p_credito_id, p_ci, p_domicilio, p_pagare)`: permiso `gestionar_credito`, solo
`origen='venta'` y no anulado, `for update`, auditoría solo si cambió. El `<article>` del plan de cuotas pasa a
`creditos/components/plan-cuotas-imprimible.tsx`, usado por el POS y por el detalle del crédito ("Imprimir plan").

**D. M-8.** `registrar_compra` copiada íntegra de `compras.sql:169-279`. Los ítems aceptan `lote` y `vence`: en el
frial son obligatorios (lote de 1 a 40, `vence` desde hoy en La Paz); fuera del frial deben venir nulos. Con serie en el
frial, `ERP_DATOS_INVALIDOS`. Inserta en `lotes` con el `movimiento_id` de la compra.

**D. Reversos de compras.** Tipo de movimiento `anulacion_compra`; tabla `compra_anulaciones` (RLS de lectura, solo
agregar); `proveedor_pagos` con `anula_id` y `motivo`, check análogo, índice único parcial y `grant select` por columna
de las dos columnas nuevas; `deuda_proveedor` y `deudas_proveedores` excluyen compras anuladas.
`anular_pago_proveedor(p_operacion_id, p_pago_id, p_motivo)`: permisos `gestionar_compras` y `anular`, solo el último
pago vivo del proveedor. `anular_compra(p_operacion_id, p_compra_id, p_motivo)`: mismos permisos; bloquea proveedor y
luego stock (mismo orden que `registrar_compra`); rechaza series, pagos ligados que no sean el automático, deuda
resultante negativa y stock insuficiente en la ubicación; por línea inserta `anulacion_compra` y, si corresponde,
`ajuste_costo`; registra la anulación y revierte el pago automático del contado. `lotes_por_vencer` excluye lotes de
compras anuladas. La lista de compras marca "Anulada".

**E. M-5.** `detalleVenta` lee la condición, el crédito por `venta_id` y si hay reserva con ese `venta_id`. Con crédito
o reserva la página oculta Anular y Devolver y explica por qué; en crédito muestra "Inicial" y el enlace "Ver pagos del
crédito". La lista marca "Crédito" o "Reserva".

**Trampas.**

- Costo promedio: `aplicar_movimiento_a_stock` no recalcula con cantidad negativa. `anular_compra` corrige con
  `(Q·A − q·c)/(Q − q)` si `Q − q > 0` y el resultado no es negativo; si no, deja el promedio. No es exacto si hubo
  ventas o traslados después de la compra. Las ventas ya hechas conservan su costo (RN-06).
- Las filas negativas cambian el supuesto `monto > 0` de `credito_pagos` y `proveedor_pagos`: cada subagente lista
  todos los lectores (SQL y web, incluidos reportes y exportaciones) y confirma que suman o muestran bien.
- Los reversos de cuota nunca escriben en una sesión cerrada.
- `anular_credito_inicial` usa `exists credito_pagos`: un crédito con pago y reverso no se anula. Conservador; se deja.
- Copias íntegras de funciones: conservar huellas, forma de respuesta, bloqueos y grants originales.
- Los nombres de los checks automáticos se confirman en `db reset`.

**Verificación.** `scratchpad/verificar.sh` completo sobre el árbol integrado; revisión del diff por el chairman;
`/code-review`, `/ponytail-review`, `/security-review` y Opus (permisos y dinero); QA con Playwright en local de cada
tema; migraciones a producción antes del merge, con backup manual previo; un solo push.

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
