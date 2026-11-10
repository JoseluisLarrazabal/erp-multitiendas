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

### Plan detallado del PR 3 (Opus, 2026-11-10; arbitrado por el chairman)

**Decisiones del chairman al arbitrar (2026-11-10).** Numeradas como las preguntas del final.

1. La actualización se aplica sola al abrir el POS: sí. Solo antes de la primera interacción y sin cola, cobros ni
   cuotas pendientes; después, el botón como hoy. Motivo: en producción el POS abrió con la versión vieja tras el
   deploy del PR 1 y nadie en el local va a saber que debe pulsar el botón.
2. Red para el chunk 404: no. Queda el QA de dos builds seguidos.
3. `ERP_ULTIMO_DUENO` como 409 en integración y la carrera de dos dueños: se recorta. El trigger tiene pgTAP; el 409 es
   una línea de mapeo sin prueba. Va como límite conocido.
4. Actualizar con solo filas rechazadas en la cola: sigue bloqueado. Límite conocido junto a M-11, y va al manual.
5. `dblink` para el orden de bloqueos: se intenta una vez. La prueba no espera un tiempo fijo: consulta
   `pg_stat_activity` hasta ver a la otra conexión esperando un bloqueo (con tope de unos segundos), para que no falle
   por lentitud del CI. Si aun así no conecta o es inestable, se saca y se anota.
6. Accesibilidad de lavandería, crédito, reservas y reconciliación: después de la entrega.
7. Proveedor en la referencia del kardex: fuera.

Cambios al reparto: los subagentes sí pueden correr `db reset`, sus archivos pgTAP y sus specs de Playwright, pero
siempre agrupados en una sola invocación bajo el candado compartido (`flock`), como en el PR 2; la suite completa
la corre solo el integrador. M-10 y M-11 quedan con los ajustes de la crítica de Opus (la línea de tardías cuenta
también movimientos de caja; `reporte_caja` usa el esperado guardado; solo ventas y movimientos rechazados dejan de
bloquear el cierre). El ensayo de la limpieza lo corre el integrador al final de la suite local. La cadencia del
backup (fotos semanales por el cupo de minutos de Actions) no entra hasta que el CTO decida.

**Estado encontrado en el código (rama recién salida de `main` en `8cd35dd`).**

- M-10. El esperado del cierre **está guardado**: `cerrar_caja` escribe `caja_sesiones.monto_esperado` y `diferencia`
  (`20261101190100_rpc_ventas.sql:219-222`) y un check los exige al cerrar (`20261101180100_caja.sql:26-28`).
  No hay que derivarlo. El detalle muestra `resumen_caja.esperado` en vivo junto al contado y la diferencia guardados
  (`detalle-sesion.tsx:99-113`); `lecturas-panel.ts:107` ya lee `monto_esperado` y no lo usa. **`reporte_caja` tiene el
  mismo descuadre**: esperado vivo y contado y diferencia guardados (`credito.sql:1499-1500`). Lo que entra
  tarde: ventas sin conexión hechas antes del cierre, marcadas `caja_cerrada` (`credito.sql:858-864`), y **también
  movimientos de caja sin conexión** con la misma marca (`auditoria_entrega_a.sql:1045`). Una venta tardía
  anulada por corrección (`credito.sql:1178`) sale del esperado vivo.
- M-11. `bloqueaEquipo` es verdadero con cualquier fila del equipo en la cola, pendiente o rechazada
  (`use-cola.ts:92-96`); alimenta el cierre (`venta-en-curso.tsx:51` → `panel-caja.tsx:348-366`), el cambio de equipo
  (`barra-equipo.tsx:46`) y, por `equipoTieneCola`, el cambio de negocio (`use-envio.ts:443-449`, `pos-app.tsx:42`).
  Reintentar no pide permiso; descartar exige `devolver_fuera_plazo` (`aviso-cola.tsx:139-163`). Cerrar sesión borra
  solo el IndexedDB `datos`; la cola es otra tabla y sobrevive (`lib/offline/datos.ts:47-58`). El reenvío va con
  `p_offline` (`cola-ventas.ts:76-78`): una rechazada reintentada después del cierre entra como tardía si se hizo
  dentro de la sesión y el cierre tiene menos de 30 días (`credito.sql:858-864`).
- M-12. Búsquedas con `ilike` en el servidor: `catalogo/queries.ts:40-44` (productos del panel: código, barras,
  nombre, marca, modelo), `clientes/queries.ts:22` (buscador del POS y del panel), `clientes/lecturas-panel.ts:33`
  (lista de clientes), `inventario/queries.ts:37-38` (`filtroTexto`: lista de stock, conteo y selector de producto),
  `ventas/lecturas-ordenes.ts:48` (órdenes por `cliente_nombre`). `ventas/lecturas-panel.ts:71` busca por número: no
  entra. `unaccent` no está instalada (ninguna migración crea extensiones). El POS normaliza con
  `ventas/domain.ts:163-164`.
- M-13. `kardex_producto` ya devuelve `ref_id` y la web lo ignora (`20261108140000_insumos.sql:143-192`,
  `inventario/queries.ts:158-181`). Valores de `ref_tipo`: `venta` (venta y anulación), `devolucion`, `compra` (compra y
  `anulacion_compra`), `reserva`, `conteo`, `operacion` (entrada, salida, traslado), `costos`, `consumo_revertido`.
  **Solo las ventas tienen número**; compras, conteos, traslados y reservas no tienen ninguno. El Excel del kardex
  exporta la misma palabra cruda (`reportes/actions.ts:65`).
- M-14. Las RPC de inventario no exigen producto activo (`validar_inventario`, `rpc_inventario.sql:11-30`):
  el bloqueo es solo de la web, `inventario/queries.ts:211` (selector) y `:265` (conteo).
- M-16. El grupo de modos es `flex gap-1` sin `flex-wrap` (`barra-equipo.tsx:58`): con 5 botones no entra en 375 px.
- M-17. Causa: el aviso de duplicado se escribe en `error`, se pasa a la búsqueda con el documento y la búsqueda, 250 ms
  después, hace `setError(null)` al responder bien (`selector-cliente.tsx:36-48,76-80`). El mensaje existe
  (`erp-errores.ts:19`).
- Service worker. Solo precache de `.next/static/**/*.{js,css,woff2}` más `/pos` con revisión por build
  (`sw-pos/[path]/route.ts:10-17`); `skipWaiting: false` (`sw.ts:12-18`). El POS no tiene `import()` dinámicos. Con el
  precache completo el SW viejo sirve HTML y chunks viejos coherentes entre sí sin pedir nada a Vercel, así que un chunk
  borrado en Vercel **no** da 404 por diseño; un 404 solo sale de una petición que no está en el precache. No encontré
  por lectura una ruta del POS que la haga; la hipótesis más barata sigue siendo la de la auditoría (restos de builds en
  `localhost:3000`). **Lo de producción es el diseño funcionando**: al abrir, el navegador busca un SW nuevo, lo instala
  mientras la página vieja ya es su cliente y queda esperando; por eso cada primer arranque tras un deploy muestra la
  versión vieja con el aviso. `aviso-actualizacion.tsx:29-36` solo mira la cola (filas + ilegibles), no los cobros en
  línea ni las cuotas sin confirmar; `pos-app.tsx:59` le pasa solo `lineasEnCurso`.
- Precio de crédito. Con red, cada montaje del POS baja `catalogo_pos` de nuevo (`use-catalogo.ts:123-146`) y el SW no
  cachea nada de Supabase (`sw.ts:6`). Sin recargar, el catálogo solo se refresca al volver la red, tras un rechazo por
  precio viejo, o en la venta siguiente a 5 min de la última carga (`use-catalogo.ts:85-121`). **El caso "tras recargar"
  no se explica leyendo el código**; dos candidatos a descartar en el QA: la lista Crédito solo aplica con el modo
  crédito activo (`use-venta.ts:287`) y el vendedor no tiene lista Crédito por línea (`vendedor.md:63`, auditoría §6).
- Fotos: `foto.ts` sube el `File` tal cual; tipo y 5 MB se validan al elegir (`catalogo/domain.ts:41-51`,
  `foto-campo.tsx:17-27`); el bucket acepta jpeg, png y webp hasta 5 MB (`20261101150000_fotos_productos.sql:5-6`).
- Arrastres del PR 2: `reporte_stock` toma como `ultima_salida` todo movimiento negativo salvo `traslado_salida`
  (`20261102140000_reportes.sql:159-164`), así que `anulacion_compra` cuenta. `pagar_proveedor` acepta cualquier
  `compra_id` del proveedor (`20261108120000_compras.sql:328-334`); nunca se redefinió. `registrar_compra` ya bloquea en
  orden con `bloquear_stock` (`20261110120300_compra_lotes_frial.sql:126`): el punto de la §4 sobre compras quedó
  resuelto en el PR 2; `validar_inventario` toma los productos `for share` en el orden de llegada, que no se bloquean
  entre sí.
- Limpieza: no cubre `compra_anulaciones` ni `caja_revisiones` (comparé las tablas de todas las migraciones contra
  `limpiar-pruebas.sql`). Los contraasientos de `credito_pagos` y `proveedor_pagos` ya caen por `created_at`, y
  los lotes de compras también.
- Pruebas que ya existen y no se repiten: recarga a mitad del cobro (crédito, reserva y cuota), respuesta perdida en
  cuota, ventas especiales en `/panel/ventas`, anular compra y pago, conteo con reserva (`rpc-conteo-reservas.sql`),
  fin de mes 31 → 28 → 31 en `crear_credito_inicial` (`rpc-credito.sql:376-379`), pago total en DB-22, inicial por QR,
  `ERP_EFECTIVO_INSUFICIENTE` al cancelar reserva (`rpc-reservas.sql:263`) y el trigger de `ERP_ULTIMO_DUENO` en pgTAP.

**Crítica a las decisiones del chairman.**

- M-10: correcta. Dos ajustes: la línea debe contar también los movimientos de caja tardíos, porque cambian el esperado
  igual que las ventas; y `reporte_caja` se arregla en el mismo PR, con el esperado guardado en las sesiones cerradas.
- M-11: se sostiene, con límites. Al cerrar con una venta rechazada, su efectivo está en el cajón y no en el esperado:
  la diferencia sale a favor por ese monto (o en contra con un gasto rechazado). Si el encargado la reintenta después y
  pasa, entra como tardía en la sesión cerrada y la línea de M-10 la muestra: la historia cuadra. Condiciones: (1) solo
  dejan de bloquear las **ventas y movimientos rechazados**; siguen bloqueando lo pendiente, lo ilegible, la cola sin
  leer, una apertura rechazada, los cobros en línea y las cuotas sin confirmar; (2) el cambio de equipo y de negocio no
  cambian; (3) el aviso dice que el esperado no las cuenta. No rompe cerrar sesión (la cola sobrevive) ni la auditoría
  (nada se borra). Riesgos que quedan: pasados 30 días del cierre el reintento ya no entra y solo queda descartar; las
  filas viven en ese navegador, así que reinstalar o cambiar de dominio las pierde (ya era así); y una fila rechazada
  deja al equipo **sin poder actualizar la app** mientras no se resuelva (el aviso exige la cola vacía).

**Migraciones** (aditivas: `create or replace` u objetos nuevos; cada copia conserva huellas, forma de respuesta,
bloqueos y grants).

| Migración | Lote | Contenido |
|---|---|---|
| `20261110130000_cierre_caja_tardias.sql` | A | `resumen_caja` copiada íntegra de `credito.sql:1410-1466`, con tres claves más: `tardias_ventas` (cuenta de ventas `completada` con `'caja_cerrada' = any(motivos_revision)`), `tardias_ventas_total` (suma de su `total`) y `tardias_movimientos` (cuenta de `caja_movimientos` con la marca); van en null sin `ver_reportes`, como los otros términos. `reporte_caja` copiada de `credito.sql:1470-1537`: en una sesión cerrada `esperado` = `s.monto_esperado`; en una abierta, el vivo de siempre |
| `20261110130100_busqueda_sin_tildes.sql` | B | `create extension if not exists unaccent with schema extensions`; `public.sin_tildes(text)` `language sql immutable parallel safe`, `search_path = ''`, cuerpo `select extensions.unaccent('extensions.unaccent'::regdictionary, $1)`; campos calculados de PostgREST `public.busqueda(public.productos_lista)` (código, barras, nombre, marca, modelo), `public.busqueda(public.inventario_lista)` (código, barras, nombre, marca), `public.busqueda(public.clientes)` (nombre) y `public.busqueda(public.ordenes)` (`cliente_nombre`), cada uno `select public.sin_tildes(concat_ws(' ', ...))`, `stable`, invoker. `revoke all ... from public, anon` y `grant execute ... to authenticated` en las cinco |
| `20261110130200_kardex_referencia.sql` | B | `drop function` + `create function kardex_producto` copiada de `insumos.sql:142-194` (cambia el tipo de retorno), con la columna final `referencia text` y los dos grants |
| `20261110130300_arrastres_pr2.sql` | C | `reporte_stock` copiada de `reportes.sql:128-190` con `m.tipo not in ('traslado_salida', 'anulacion_compra')`; `pagar_proveedor` copiada de `compras.sql:295-347` con `and condicion = 'credito'` y `not exists (select 1 from public.compra_anulaciones a where a.compra_id = v_compra_id)` en la comprobación del `compra_id` (sigue siendo `ERP_DATOS_INVALIDOS`; el pago automático del contado inserta directo y no pasa por aquí) |

Por qué campos calculados para M-12: no reescriben tablas ni recrean vistas, no duplican en una RPC la paginación y el
`count: exact` que ya hacen las consultas, y cada sitio cambia una cadena del `.or()`. Sin índices: el catálogo tiene
unos 600 productos. **Primer paso de B, antes de escribir**: comprobar contra el Supabase local que PostgREST acepta
el campo calculado dentro de `or=(...)`. Si no lo acepta, se cambia a columna generada `busqueda` (con `sin_tildes`,
que por eso es inmutable) en `productos` y `clientes`, más `create or replace` de las dos vistas agregando la columna al
final, y se avisa al chairman.

**Reparto en 5 lotes** (subagentes Sonnet en worktrees, archivos disjuntos). Nadie toca `database.types.ts` (si hace
falta para compilar, el cambio a mano queda fuera del commit), `erp-errores.ts`, `docs/` ni `docs/srs.md`. Los
subagentes corren lint, `tsc` y Vitest; **solo el integrador** corre `db reset`, pgTAP, integración y Playwright, porque
la base local es compartida. Orden de integración: C, B, A, E, D; después `db reset`, `pnpm db:types`, `tsc`, commit de
tipos.

| Lote | Temas | Archivos que toca | No toca |
|---|---|---|---|
| A. Caja, cola y actualización | M-10, M-11, aviso de actualización | migración 130000; `caja/components/{detalle-sesion,panel-caja}.tsx`, `caja/schemas.ts` y su test; `ventas/{use-cola,use-venta,cobro-pendiente,cobro-cuota,index}.ts`, `use-cola.test.ts`, `cobro-pendiente.test.ts`, `ventas/components/venta-en-curso.tsx`; `components/aviso-actualizacion.tsx`; `app/(pos)/pos/pos-app.tsx`; `tests/rpc-resumen-caja.sql`, `tests/caja-tardias.sql` (nuevo); `e2e/pos-venta.spec.ts`, `e2e/caja-tardia.spec.ts` (nuevo) | `reportes/**`, `rpc-reportes.sql`, `barra-equipo.tsx`, `use-catalogo.ts` |
| B. Búsquedas, kardex e inactivos | M-12, M-13, M-14 | migraciones 130100 y 130200; `lib/texto.ts` (nuevo); `catalogo/queries.ts`; `clientes/{queries,lecturas-panel}.ts`; `inventario/{queries,actions,schemas,domain}.ts`, `inventario/components/{selector-producto,form-salida,form-traslado,lista-conteo,lista-kardex}.tsx`; `ventas/lecturas-ordenes.ts`; `reportes/actions.ts` (solo la columna del Excel del kardex); `tests/rpc-inventario-lecturas.sql`, `tests/busqueda-sin-tildes.sql` (nuevo); `e2e/inventario.spec.ts`, `e2e/busqueda-sin-tildes.spec.ts` (nuevo) | `catalogo/{domain,foto}.ts`, `selector-cliente.tsx`, `reportes/{domain,queries,tabla}.ts` |
| C. Reportes y arrastres | M-9, `ultima_salida`, `pagar_proveedor` | migración 130300; `reportes/domain.ts`, `reportes/domain.test.ts` (nuevo), `app/(panel)/panel/reportes/page.tsx`; `tests/rpc-reportes.sql`, `tests/rpc-compras.sql`; `e2e/reportes.spec.ts` | `reportes/actions.ts`, `reportes/tabla.ts`, todo `caja/` |
| D. Pruebas de la §4 y limpieza | bloqueos, brechas pgTAP, compra de varias líneas, limpieza | `tests/bloqueos-orden.sql` y `tests/brechas-preentrega.sql` (nuevos), `tests/auditoria-entrega-a.sql` (solo el bloque de las líneas 168-173); `e2e/compras.spec.ts`; `scripts/limpieza/limpiar-pruebas.sql` | código de producto (`web/src/**`, migraciones) |
| E. POS chico y fotos | M-16, M-17, POS sin productos, compresión de fotos, refresco del catálogo | `ventas/components/{barra-equipo,zona-productos}.tsx`, `clientes/components/selector-cliente.tsx`, `ventas/use-catalogo.ts`; `catalogo/{foto,domain}.ts`, `catalogo/domain.test.ts`, `catalogo/foto.test.ts` (nuevo), `catalogo/components/foto-campo.tsx`; `e2e/responsive.spec.ts`, `e2e/catalogo.spec.ts`, `e2e/pos-cliente.spec.ts` y `e2e/pos-vacio.spec.ts` (nuevos) | `catalogo/queries.ts`, `clientes/queries.ts`, `use-venta.ts`, `venta-en-curso.tsx` |

Archivos calientes y a quién van: `inventario/queries.ts` (M-12 y M-14) → B; `pos-venta.spec.ts` (M-11 y aviso de
actualización) → A, y la E2E de M-10 va a un archivo nuevo; `catalogo.spec.ts` (fotos) → E, y la E2E de M-12 a un
archivo nuevo; `clientes/` (M-12 en `queries.ts`, M-17 en el componente) queda partido por archivo; `rpc-compras.sql`
→ C, y las brechas de compras de D van a `brechas-preentrega.sql`; `reportes/` partido por archivo entre B
(`actions.ts`) y C (`domain.ts`, página).

**A. M-10.** `caja/schemas.ts`: `tardias_ventas`, `tardias_ventas_total` y `tardias_movimientos`
`z.number().nullable().optional()` (el POS viejo y el nuevo conviven). `detalle-sesion.tsx`, solo en sesiones
cerradas: "Esperado al cierre" = `s.montoEsperado` (conserva `data-testid="sesion-esperado"`), "Contado" y "Diferencia"
(`sesion-diferencia`) guardados. Si hay tardías o el vivo difiere del guardado, antes de esa terna va "Esperado con lo
que llegó después" = `r.esperado` (`data-testid="sesion-esperado-actual"`), y debajo un `role="status"`: "Después del
cierre llegaron N ventas sin conexión por Bs X[ y M movimientos de caja]. El arqueo del cierre no cambia." En una
abierta queda como hoy. Pruebas: `rpc-resumen-caja.sql:69-73` compara el objeto entero y **hay que sumarle las tres
claves**; `caja-tardias.sql` nuevo: abrir, vender, cerrar con contado C (esperado E), registrar una venta con
`p_offline` y hora dentro de la sesión → `monto_esperado` sigue en E, `resumen_caja.esperado` = E + efectivo,
`tardias_ventas` = 1 y su total, `reporte_caja` devuelve E y cumple contado − esperado = diferencia; un movimiento
tardío suma en `tardias_movimientos`; sin `ver_reportes`, null. E2E `caja-tardia.spec.ts` (dueño): la misma secuencia
por API, abrir `/panel/cajas/<id>` y ver los tres números del cierre, la línea y el esperado actual.

**A. M-11.** `use-cola.ts`: `EstadoCola` suma `bloqueaCierre` (igual que `bloqueaEquipo`, pero sin contar las filas del
equipo `rechazada` de tipo venta o movimiento) y `rechazadasEquipo: { cantidad: number; totalVentas: number }` (solo
las del equipo). `use-venta.ts` expone `colaBloqueaCierre`. `venta-en-curso.tsx`: `ventaPendiente` de `PanelCaja`
pasa a `colaBloqueaCierre || envio.pendientes.size > 0 || hayCuotas`; `BarraEquipo` sigue con `hayPendientes`.
`panel-caja.tsx` recibe `rechazadas` y muestra, sin bloquear, en `role="status"`: "Hay N operaciones rechazadas sin
resolver[ (ventas por Bs X)]. El esperado no las cuenta. Avisa a un encargado para que las reintente o las descarte." El
texto que bloquea pasa a "Hay operaciones sin enviar o cobros sin confirmar en este equipo. Resuélvelos antes de cerrar
la caja." Pruebas: `use-cola.test.ts` (una rechazada de venta no bloquea el cierre y sí el equipo; una pendiente, una
apertura rechazada o una ilegible bloquean ambos). En `pos-venta.spec.ts`: E2E-07 (línea 800) cambia al texto nuevo, y
un caso nuevo con `ventaRechazada(page, 24)` → Caja → contado 24 → el cierre está habilitado y se ve el aviso con Bs
24,00 → cerrar → diferencia Bs 24,00 → `unroute` y Reintentar → la venta queda en la base con `caja_cerrada` y
`resumen_caja` (como dueño, por API) da `tardias_ventas` 1.

**A. Aviso de actualización.** `cobro-pendiente.ts` exporta `hayCobrosGuardados(): boolean`: alguna clave de
`localStorage` que empiece por `erp:cobros-en-linea:` o `erp:cuotas-sin-confirmar:` (las claves se borran al quedar
vacías; `cobro-cuota.ts` solo exporta su prefijo). `AvisoActualizacion` recibe también `hayPendiente: () =>
Promise<boolean>` (`pos-app.tsx` le pasa `guarda.current.hayPendiente`, que ya cubre el envío en curso, la cola del
equipo, los cobros en memoria y las cuotas). Al pulsar, si `hayCobrosGuardados() || await hayPendiente()`, no aplica y
muestra en `role="alert"`: "Hay un cobro o una cuota sin confirmar en este equipo. Verifícalo antes de actualizar." Con
la cola no vacía el texto pasa a "Hay operaciones sin enviar o rechazadas en este equipo: se podrá aplicar cuando se
resuelvan." (`pos-venta.spec.ts:1751` busca `/cuando se envíen/` y cambia). Pruebas: Vitest de `hayCobrosGuardados`;
en el E2E de la línea 1726, con un cobro pendiente en `localStorage` el botón no aplica y sale el texto. Sobre el chunk
404: sin código; ver preguntas (aplicar sola al abrir) y el QA de dos builds.

**B. M-12.** `lib/texto.ts`: `export const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "")`. Cada
sitio aplica primero su saneado de siempre y después `sinTildes`, y busca `busqueda.ilike.*q*` (en `clientes`, junto al
`ci_nit` de siempre; en productos, junto a `codigo` y `codigo_barras` tal cual). En `lecturas-ordenes.ts` la rama de
`cliente_nombre` usa `busqueda` (si el tipado de `.ilike` no admite la columna, `.filter("busqueda", "ilike", ...)`).
Pruebas: `busqueda-sin-tildes.sql` (`sin_tildes('María José ÑANDÚ')` = `'Maria Jose NANDU'`; `busqueda` de cada
relación; `anon` no ejecuta, que también vigila `seguridad-generica.sql`); E2E nuevo: un cliente "María Tildes <id>" se
encuentra con "maria tildes" en `/panel/clientes` y en el buscador del POS, y un producto "Café <id>" con "cafe" en
`/panel/productos` y en el selector de salida.

**B. M-13.** `referencia` en `kardex_producto`, con `left join` por `ref_id`: venta → `'Venta ' || numero` (o
`'Anulación de la venta '` si el tipo es `anulacion_venta`); devolución → `'Devolución de la venta ' || numero` de su
venta; compra → `'Compra del ' || to_char(created_at at time zone 'America/La_Paz', 'DD/MM/YYYY')` (o `'Anulación de la
compra del '`), sin el proveedor, para no mostrárselo a quien no tiene `gestionar_compras`; conteo → `'Conteo del ' ||`
la fecha; reserva → `'Reserva'`, más `' · venta ' || numero` si se completó; `costos` → `'Ajuste de costos'`;
`consumo_revertido` → `'Reversión de consumo'`; `operacion` → null (no hay documento; el tipo ya dice entrada, salida o
traslado). `lista-kardex.tsx:83-90` muestra `Ref.: {referencia}` solo si no es null; el Excel usa `referencia`. Pruebas:
`rpc-inventario-lecturas.sql` (una venta, una anulación y un conteo dan su texto; una entrada da null) y en
`inventario.spec.ts` el kardex de un producto vendido muestra "Venta C1-…".

**B. M-14.** `buscarProductos(supabase, negocioId, texto, opciones?: { conInactivos?: boolean })`: con la opción, en vez
de `.eq("activo", true)` usa `.or("activo.eq.true,stock_total.neq.0")` (confirmar que dos `.or()` se combinan con AND;
si no, anidar con `and(...)`). `COLUMNAS_ELEGIBLE` suma `activo` y `ProductoElegible` gana `activo: boolean`;
`busquedaSchema` acepta `conInactivos` opcional. `SelectorProducto` recibe `conInactivos` y agrega " (inactivo)" al
nombre en la lista y en lo elegido; lo pasan `form-salida` y `form-traslado` (entrada y compras no). `listarStock`
cambia `soloActivos` por `activosOConStock` en el conteo, y `lista-conteo.tsx` marca "(inactivo)". Prueba en
`inventario.spec.ts`: producto con stock 3, desactivarlo, darlo de baja desde Salida (sale "(inactivo)") y verlo en el
conteo; un inactivo con stock 0 no aparece.

**C. M-9.** `DefReporte` gana `criterio?: string`; la página lo muestra bajo la barra de reportes en
`text-muted-foreground text-sm`. Textos exactos. Ventas, Ingresos y Más vendidos: "Cuenta lo vendido, por el día en que
la venta llegó al sistema: una venta hecha sin conexión cuenta el día en que se envió. Una venta a crédito entra entera
el día de la venta y una reserva, cuando se completa; los anticipos y las cuotas no entran aquí sino en Caja. Las
devoluciones restan el día en que se hacen." Caja: "Cuenta lo cobrado en cada caja, por el día en que se abrió: efectivo
y QR de ventas, anticipos de reservas y cuotas de crédito. Una venta sin conexión cuenta en la caja donde se hizo,
aunque llegue después. En una caja cerrada, esperado, contado y diferencia son los del cierre." (la última frase vale
cuando entra la migración de A). Pruebas: `reportes/domain.test.ts` (todo reporte con rango tiene criterio);
`rpc-reportes.sql`: venta a crédito de 120 con inicial 36 suma 120 en `reporte_ventas` y la cuota cobrada no suma;
reserva con anticipo no suma hasta completarse y luego suma su total; venta con `p_offline` y `creada_en_cliente` de
ayer cuenta hoy; `reportes.spec.ts` ve los dos textos.

**C. Arrastres.** pgTAP en `rpc-compras.sql`: `pagar_proveedor` con el `compra_id` de una compra al contado →
`ERP_DATOS_INVALIDOS`, y con una anulada también; con una a crédito, pasa. En `rpc-reportes.sql`: compra y su anulación
→ `ultima_salida` sigue null y `sin_movimiento` es verdadero.

**D. Orden de bloqueos probado de verdad** (`bloqueos-orden.sql`, nuevo). `create extension if not exists dblink with
schema extensions` dentro de la transacción de la prueba. Dos productos del seed de la tienda con fila de `stock`
confirmada (el seed los crea por kardex, `seed.sql:110`), X < Y por uuid. La prueba toma Y con `for update`;
por `dblink_send_query` otra conexión (`host=127.0.0.1 port=5432 dbname=postgres user=postgres password=postgres`, solo
Supabase local) llama `bloquear_stock(T, U, array[Y, X])` y queda esperando; tras `pg_sleep(0.3)`, `select ... where
producto_id = X for update nowait` debe dar `55P03`: la otra conexión ya tomó X, o sea ordenó. Sin el `order by`
esperaría en Y sin tener X y el `nowait` pasaría: la prueba falla. Lo mismo con `registrar_conteo`, entrando en la otra
conexión como el dueño del seed (`set_config('request.jwt.claims', ...)`, `set role authenticated`). Al final
`dblink_cancel_query` y `dblink_disconnect`: nada se confirma. La búsqueda de texto de `auditoria-entrega-a.sql:168-173`
queda para `guardar_precios` y `fijar_costos`, con el comentario de que no discrimina. **Si la conexión de `dblink` no
funciona en CI al primer intento, se saca y se anota**: el riesgo es un deadlock que aborta sin corromper.

**D. Brechas pgTAP** (`brechas-preentrega.sql`, nuevo). Cada caso fija lo que hace **hoy**: el implementador lee
la función antes de escribir la aserción y, si el resultado le parece un defecto, no lo arregla: lo reporta.

- Compra sobre stock −2 con costo promedio 8: 5 a costo 10 → stock 3, promedio 10 (la fórmula ignora el negativo; la
  confirma `aplicar_movimiento_a_stock`, `20261101140000_kardex.sql:134`).
- Compra a costo 0 sobre 5 a promedio 8: 5 más → promedio 4.
- Reserva con anticipo igual al total: se crea; completarla deja una venta del total sin cobro adicional y el esperado
  sube solo por el anticipo. Es el caso con más probabilidad de fallar.
- Crédito con descuento: leer la rama de crédito de `registrar_venta` (`credito.sql:656` en adelante); si acepta
  descuento, el capital es el total con descuento; si lo rechaza, se fija el código.
- Vencimientos: `crear_credito_inicial` desde el 29 y el 30 de enero de 2026 (febrero → 28, marzo → 29 y 30) y desde el
  29 de enero de 2028 (bisiesto → 29 de febrero). Confirmar si la venta a crédito usa el mismo cálculo; si no, queda
  anotado que solo se prueba el saldo inicial.
- Prepago total: crédito de 1.000 al 2,5 % en 3 cuotas pagado entero al día siguiente → saldo 0, `pagado`, y lo cobrado
  incluye el interés de los 3 meses. Documenta M-3 hasta que el cliente decida.
- RF-FRI-03: un frial nuevo sin productos → `catalogo_pos` devuelve `productos: []` (no null), `reporte_ventas` y
  `reporte_stock` sin filas, `lotes_por_vencer` vacío, y la primera entrada con lote funciona.

**D. E2E.** `compras.spec.ts`: compra de tres líneas → tres movimientos en el kardex y total correcto. Las demás brechas
de E2E de la §4 ya están cubiertas por pgTAP o por los PR 1 y 2 (lista arriba).

**D. Limpieza** (`limpiar-pruebas.sql`). Abortos nuevos, en el estilo de los existentes: una compra previa a `--desde`
anulada después; un pago a proveedor previo anulado después (reverso con `anula_id` hacia un pago anterior al corte);
una revisión de caja posterior al corte sobre una sesión o un movimiento que no se borra. Borrados nuevos, antes de
`compras`: `compra_anulaciones` (`created_at >= desde` o compra borrada); antes de `caja_sesiones`: `caja_revisiones`
cuyo `ref_id` es una sesión o un movimiento borrados. Aserciones nuevas: `compra_anulaciones` sin huérfanas ni filas del
corte; `caja_revisiones` sin huérfanas. Ensayo local (el chairman lo escribe en `docs/plan-limpieza-pruebas.md`): `db
reset` → anotar la hora → Playwright completo (ventas, compras, anulaciones, reversos, reservas, créditos y lotes) →
`limpiar-pruebas.sh --desde <hora>` en seco: imprime conteos y termina en rollback → aplicar → comprobar en SQL que no
quedan filas con fecha posterior, que `stock` es la suma del kardex y que la numeración de los equipos volvió al seed
→ `pnpm test:e2e` de humo. Sobre el último backup restaurado, el mismo ensayo antes de producción.

**E. M-16.** `barra-equipo.tsx:58`: `flex flex-wrap justify-end gap-1`. Sin rediseño: a 390 px los modos bajan a una
segunda fila. `responsive.spec.ts` suma un caso por negocio (tienda y frial) como dueño, a 390×844, con el equipo del
`beforeAll` fijado en `localStorage` como hace `fijarEquipo`: `scrollWidth <= clientWidth` y cada botón del grupo "Modo"
`toBeInViewport()`.

**E. M-17.** `selector-cliente.tsx`: estado aparte `duplicado: string | null`, puesto con el mensaje de
`ERP_CLIENTE_DUPLICADO`, mostrado en `role="alert"` y limpiado al escribir en el buscador o al elegir. La búsqueda ya no
lo pisa. E2E nuevo `pos-cliente.spec.ts`: cliente creado por API con documento D; en el POS, "Nuevo cliente" con D →
esperar la respuesta de `rest/v1/clientes` de la búsqueda → el alerta sigue mostrando "Ya existe un cliente con ese
documento" y la lista muestra al existente. Antes del arreglo la alerta desaparece con esa respuesta.

**E. POS sin productos (RF-FRI-03).** `zona-productos.tsx`: con el catálogo cargado y 0 productos, "Este negocio todavía
no tiene productos con precio. Pide al encargado que los cargue en el panel." E2E `pos-vacio.spec.ts`: `page.route`
sobre `rpc/catalogo_pos` devuelve el catálogo con `productos: []` → se ve el texto, el carrito vacío y la caja se abre.

**E. Fotos.** `catalogo/foto.ts`: `comprimirFoto(archivo: File): Promise<File>` y la función pura `medidasDestino(ancho,
alto, ladoMax)`. Lado mayor 1.200 px, WebP calidad 0,8. `createImageBitmap(archivo)`; si falla (formato que el
navegador no decodifica), se devuelve el original. Si el lado mayor ya es de 1.200 o menos y pesa menos de 300 KB, el
original. Canvas → `toBlob("image/webp", 0.8)`; si el blob no es `image/webp` (Safari viejo), `image/jpeg` a 0,82 sobre
fondo blanco; si el resultado pesa más que el original, el original. Se comprime al elegir, en `foto-campo.tsx`: el tipo
se valida antes (JPG, PNG o WebP; HEIC ya se rechaza hoy) y el tope de 5 MB del bucket después, sobre el resultado, con
un tope previo de 25 MB del original para no decodificar algo enorme en un celular ("La foto pesa más de 25 MB."). Texto
de ayuda: "JPG, PNG o WebP. Se achica sola antes de subir." La ruta toma la extensión del tipo final y la lógica
existente borra la anterior si cambió. Las fotos ya guardadas no se tocan. Pruebas: Vitest de `medidasDestino`
(2.400×1.600 → 1.200×800; 800×600 igual) y del tope de 25 MB en `domain.test.ts`; E2E en `catalogo.spec.ts`: un PNG de
2.400×1.600 armado en la página con `OffscreenCanvas` y puesto en el input con `DataTransfer` → `foto_path` termina en
`.webp` y la imagen mostrada mide 1.200 de ancho.

**E. Refresco del catálogo.** `use-catalogo.ts`: al volver a `visibilityState === "visible"`, con red y más de
`REFRESCO_MS` desde la última carga, `recargar()` (no toca el carrito; un precio viejo en el carrito lo sigue atajando
el rechazo del servidor). Cubre el equipo que queda abierto todo el día. El caso "tras recargar" se reproduce antes en
el QA; si se reproduce, se para y se diagnostica aparte.

**Trampas.**

- Literales que cambian: `pos-venta.spec.ts:800` (texto del bloqueo del cierre) y `:1751` (`/cuando se envíen/`);
  `rpc-resumen-caja.sql:69-73` compara el objeto entero de `resumen_caja`; `catalogo/domain.test.ts:150` busca "5 MB"
  (sigue valiendo para el resultado).
- `sesion-esperado` pasa a ser el guardado en sesiones cerradas: en la E2E de `pos-venta.spec.ts:1389` vale lo mismo
  porque no hay tardías.
- `kardex_producto` cambia de tipo de retorno: `drop` + `create` en la misma migración y los dos grants de nuevo
  (`insumos.sql:193-194`); los tipos generados cambian y el integrador los sube. Las pruebas de
  `rpc-inventario-lecturas.sql:119-125` eligen columnas por nombre y no se rompen.
- Campos calculados: deben quedar sin `execute` para `anon` (`seguridad-generica.sql:37-45` lo hace fallar) y en
  `public`, que es el esquema expuesto. PostgREST los publica también como `/rpc/busqueda`; no devuelven nada que el
  llamador no pueda leer.
- `unaccent` en producción: la crea `db push`; si el rol no puede, la migración falla entera y no se aplica nada. Se ve
  en el `--dry-run`.
- Compatibilidad: las migraciones van antes del merge, y además **el POS instalado sigue con el JS viejo hasta pulsar
  "Actualizar ahora"**, días si hace falta. Todo lo nuevo es aditivo: claves nuevas que el Zod viejo descarta,
  `reporte_caja` con el mismo contrato, `pagar_proveedor` que solo rechaza lo que la pantalla no ofrece. La web vieja no
  usa `busqueda` ni `referencia`.
- E2E que dependen del seed: el caso de bloqueos usa productos del seed con stock confirmado (pgTAP corre antes que
  Playwright en el CI, paso 5 contra 8); `responsive.spec.ts` usa los equipos R1 y R2 de su `beforeAll`; los nuevos
  crean sus datos con un id único para no chocar con otros workers.
- M-11 toca el estado que decide el cierre: el revisor confirma que `bloqueaEquipo` y `equipoTieneCola` no cambiaron.

**Verificación local y QA con Playwright** (el integrador, sobre el árbol integrado): `scratchpad/verificar.sh` completo
y, en navegador, cada reproducción: M-9, los textos en las 5 pestañas de reportes; M-10, caja cerrada más venta tardía →
tres números coherentes, línea y esperado actual en el detalle y en el reporte de Caja; M-11, venta rechazada → cierre
con aviso → Reintentar → aparece como tardía; M-12, "maria" encuentra a "María" en el panel, el POS y el selector, y
"cafe" a "Café"; M-13, "Venta C1-…" en el kardex; M-14, baja de un inactivo con stock; M-16, capturas del POS de tienda
y frial a 390×844; M-17, el mensaje sigue a la vista tras la búsqueda; SW, dos builds seguidos en `localhost` (build,
abrir `/pos`, cambiar un texto, build, reiniciar, abrir): la versión vieja abre sin ningún 404 en la red y con el aviso,
y "Actualizar ahora" la cambia; con un cobro sin confirmar no se aplica; precio de crédito, guardarlo en el panel,
recargar el POS, activar crédito y ver el precio; fotos, una de celular de 3 a 5 MB queda en WebP de menos de 200 KB;
`ultima_salida` tras anular una compra. En producción tras el despliegue: `migration list` igual, `unaccent` instalada,
las cinco funciones nuevas sin `execute` para `anon`, deploy `READY`, `/panel/clientes?q=…` sin errores.

**Preguntas para el chairman.**

1. **Aplicar la actualización sola al abrir.** Es el arreglo real del hallazgo de producción. Propuesta: si el SW nuevo
   queda esperando antes de la primera interacción (`pointerdown` o `keydown`) y no hay cola, cobros ni cuotas, se
   aplica sin preguntar; después de interactuar, el botón como hoy. Unas 15 líneas en `aviso-actualizacion.tsx`.
   **Recomiendo sí** (va en A). Sin eso, cada equipo sigue con la versión vieja hasta que alguien pulse el botón.
2. **Red para el chunk 404** (escuchar `ChunkLoadError` y ofrecer actualizar). No se reprodujo en producción y por
   diseño no se alcanza con el precache completo. **Recomiendo no hacerla** y dejar el QA de dos builds como prueba.
3. **`ERP_ULTIMO_DUENO` como 409 en integración y la carrera de dos dueños.** Desde el PR 2 quien desactiva a un dueño
   tiene que ser dueño de todos sus negocios, así que nunca es el último: solo se llega por carrera. Para probarla hay
   que crear un segundo dueño de los tres negocios del seed y arriesgar que el dueño del seed quede baneado si la prueba
   cae a mitad, lo que rompe el resto de la suite. **Recomiendo recortarla** y anotar que el trigger tiene pgTAP y el
   409 es una línea de mapeo sin prueba.
4. **Actualizar con solo filas rechazadas en la cola** (hoy no se puede). **Recomiendo dejarlo bloqueado** en este PR:
   el build nuevo tendría que leer filas viejas y lo ilegible exige encargado. Va como límite conocido junto a M-11.
5. **`dblink` para el orden de bloqueos.** Es la única forma barata de que la prueba discrimine. Recomiendo intentarlo
   una vez; si falla en CI, sacarlo y anotarlo en vez de pelear con la conexión.
6. **Accesibilidad de lavandería, crédito, reservas y reconciliación** (§4) no está en el mínimo. Agregar las rutas a
   `accesibilidad.spec.ts` es barato, pero cada violación que salga es trabajo sin estimar. **Recomiendo dejarlo para
   después de la entrega**.
7. **Proveedor en la referencia del kardex.** Lo dejé fuera porque el kardex lo ve quien no tiene
   `gestionar_compras`. Si al dueño le sirve, se agrega con esa condición.

**No verificado.** Que PostgREST acepte campos calculados dentro de `or=` (primer paso de B); que dos `.or()` de
supabase-js se combinen con AND; la conexión de `dblink` en el CI; si `registrar_venta` admite descuento en crédito y si
la venta a crédito calcula los vencimientos igual que `crear_credito_inicial`; qué hace completar una reserva con
anticipo igual al total; el `toBlob` WebP en Safari de iPhone y qué entrega iOS al elegir una foto HEIC; la causa del
precio de crédito "tras recargar"; si una apertura rechazada deja una caja local cerrable. No corrí pruebas ni toqué la
base.
