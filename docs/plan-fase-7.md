# Plan fase 7: Entrega B

Objetivo (`docs/roadmap.md`): crédito, reservas, proveedores y compras, e insumos de lavandería. Requisitos RF-CRE-01 a
06, RF-RES-01 a 03, RF-COM-01 a 03, RF-INS-01 y 02 (`docs/srs.md`). Criterio de salida (`docs/plan-pruebas.md:131`):
DB-21 a DB-26 y E2E-12 y E2E-13 en verde; créditos iniciales conciliados con el cliente.

**Arranque (CTO, 2026-11-08):** "no nos importa ya el contrato ahora mismo, implementa entrega B". D-01 (adenda) queda
sin resolver y no frena la fase. La Entrega A sigue bloqueada por el cliente; en paralelo se audita
(`docs/auditoria-entrega-a.md`).

## Punto de partida (mapeado 2026-11-08)

- No existe ninguna tabla ni RPC de la Entrega B.
- Ya existen y se reutilizan:
  - Los permisos `gestionar_credito`, `gestionar_reservas` y `gestionar_compras`, en la matriz
    (`20261101120100_rol_permisos_matriz.sql`).
  - Los tipos de kardex `compra`, `reserva`, `reserva_liberada` y `consumo`.
  - `productos.tipo = 'insumo'`, solo en lavandería; `ventas.condicion` (`contado` o `credito`); la lista de precios
    `credito` en `producto_precios` y en `catalogo_pos`.
- El trigger de `stock` recalcula el costo promedio en todo movimiento con cantidad mayor que 0 y costo. Una `compra`
  con costo lo actualiza sin código nuevo.
- `registrar_venta` (última versión en `20261102110000_lavanderia.sql:124`):
  - Rechaza la clave `condicion` y solo admite los medios `efectivo` y `qr`.
  - `venta_items.lista` no admite `credito`.
  - Cambiarla obliga a redefinirla entera.
- El arqueo lo calculan `efectivo_esperado`, `resumen_caja` y `reporte_caja`. Una tabla de pagos nueva no cuenta en
  caja hasta que esas tres funciones la sumen.

## Decisiones (chairman, 2026-11-08)

1. **P-07, supuesto aplicado:** el interés se calcula sobre saldo con cuota fija (sistema francés).
   - Cuota = C·i / (1 − (1+i)^−n), redondeada a 2 decimales; la última cuota absorbe la diferencia.
   - Vive en una sola función pura, `plan_cuotas(capital, interes_pct, n)`, probada por DB-21. Si el cliente responde
     otra cosa, se cambia solo esa función.
   - Frecuencia `mensual`: vence el mismo día de los meses siguientes, y en el último día cuando el mes es más corto.
2. **Pagos de crédito sin `cuota_id`.** Un pago abona al crédito y cubre las cuotas de la más vieja a la más nueva.
   - "Pagada" y "vencida" se derivan de comparar las cuotas acumuladas con el total pagado; no se guardan.
   - Pagar de más se rechaza (DB-22).
   - Saldo = suma de cuotas − suma de pagos, como dice el modelo.
3. **Permisos:**
   - Crear un crédito exige `gestionar_credito`. Cobrar una cuota exige `caja`: es efectivo que entra al cajón y el
     vendedor puede cobrarla.
   - Crear, completar y cancelar reservas exige `gestionar_reservas`.
   - Proveedores, compras y pagos a proveedor exigen `gestionar_compras`.
   - Consumo de insumos: `ajustar_inventario`. **Supuesto:** el encargado registra el consumo; si el cliente quiere
     que lo haga el empleado, se cambia la matriz, no el código.
4. **Caja:**
   - Los pagos de cuotas y los anticipos o devoluciones de reservas llevan `caja_sesion_id` y medio `efectivo` o `qr`.
     Se suman al arqueo en `efectivo_esperado`, `resumen_caja`, `reporte_caja` y `total_qr_sesion`.
   - **Los pagos a proveedor no pasan por la caja del POS:** son del panel, con medio `efectivo`, `qr` o
     `transferencia`, sin sesión.
   - `shortcut: si se paga a un proveedor con plata del cajón, el encargado registra además un "gasto" de caja; atar
     proveedor_pagos a la caja cuando el cliente lo pida.`
5. **Compras:**
   - La deuda con un proveedor es la suma de sus compras menos la suma de sus pagos.
   - Una compra al contado registra en la misma transacción un pago por el total. Así la deuda se calcula igual en los
     dos casos, y una compra a crédito sube la deuda (DB-25).
   - No hay anulación de compra: un error se corrige con `ajustar_inventario`, tipo `devolucion_proveedor`, como hoy.
6. **Reservas (RF-RES):**
   - Una reserva tiene un producto, como dice el modelo. Se hace en el POS, en una pestaña "Reservas", y exige conexión.
   - Crear la reserva genera un movimiento `reserva` (−cantidad, con costo de foto) y un anticipo en `reserva_pagos`.
   - Completar la reserva es una venta del POS: `registrar_venta` recibe la clave nueva `reserva_id`. Con ella:
     - El ítem tiene que coincidir con el producto, la cantidad y la ubicación de la reserva.
     - El precio validado es `precio_acordado`.
     - Se acepta un pago con medio `anticipo` igual a la suma de los anticipos. No es efectivo de la sesión, así que el
       arqueo no lo cuenta dos veces.
     - El kardex recibe `reserva_liberada` (+) y `venta` (−), y la reserva pasa a `completada`. El stock no se descuenta
       dos veces (DB-23).
   - Cancelar genera `reserva_liberada` (+) y, según P-12 (supuesto: se devuelve por caja), una fila `devolucion` en la
     sesión abierta. Con efectivo esperado insuficiente se rechaza con `ERP_EFECTIVO_INSUFICIENTE` (DB-24).
   - Gestionar reservas no existe en lavandería, según la matriz.
7. **Venta a crédito (RF-CRE-01 a 03):**
   - Es una venta del POS con `condicion = 'credito'`, cliente obligatorio y lista de precios `credito`.
   - Los pagos suman la inicial, no el total. La inicial es como mínimo `inicial_pct` del total.
   - En la misma transacción se crean el `credito` y sus cuotas.
   - Los documentos son 3 casillas: CI, comprobante de domicilio y pagaré.
     `shortcut: casillas, no archivos; subir escaneos al bucket si el cliente lo pide.`
   - Exige conexión: la UI no lo permite sin red, y la RPC rechaza `condicion = 'credito'` cuando viene con
     `p_offline`.
   - El plan de cuotas se imprime con un componente hermano de `NotaVentaVista`, con el CSS de impresión que ya existe.
8. **Saldos iniciales (RF-CRE-06):** un formulario del panel crea un crédito con `origen = 'saldo_inicial'`, sin venta
   ni caja, con capital, cuotas restantes y fecha de la primera cuota. Se usa la carga manual de P-06.
9. **Anular y devolver:** se rechazan las ventas con crédito (`ERP_VENTA_CON_CREDITO`) y las ventas que completaron una
   reserva (`ERP_VENTA_DE_RESERVA`).
   `shortcut: el dinero ya repartido entre cuotas y anticipos no tiene reverso automático; diseñarlo si el cliente
   necesita anular esas ventas.`
10. **Insumos (RF-INS):**
    - El alta de insumos es la del catálogo, que ya existe para lavandería. La entrada es una compra o
      `registrar_entrada`.
    - `registrar_consumo` escribe un movimiento `consumo` con costo de foto e idempotencia por `reclamar_operacion`.
    - Stock bajo: si `stock_minimo` ya existe en `productos`, se usa; si no, se agrega.
    - "Gasto en insumos": reporte `insumos` de lavandería, de cantidad × costo de foto por insumo y día. Exige
      `ver_reportes` y `ver_costos`.
11. **UI:** cada pantalla es una pantalla puntual, así que no hay bake-off (regla 7.c). Se reutilizan los componentes y
    patrones del panel (`useAccion`, `useOperacion`, `PaginaOperacion`, `SelectorProducto`, `SelectorCliente`,
    `ConfirmarAccion`) y los íconos de `lucide-react`. Los ítems nuevos entran a `ITEMS` con su permiso.

## PRs (en serie: los 4 comparten `database.types.ts` y Supabase local en puertos fijos)

| PR | Rama | Contenido | Pruebas |
|---|---|---|---|
| 1 | `feat/compras` | Migración `proveedores`, `compras`, `compra_items`, `proveedor_pagos` (RLS, FK compuesta por negocio, append-only en pagos e ítems). RPC `guardar_proveedor`, `registrar_compra` (idempotente por id de compra + huella, movimientos `compra` con costo), `pagar_proveedor`, lectura `deudas_proveedores`. Panel: `/panel/proveedores` (lista, alta y edición, deuda, pagar) y `/panel/compras` (lista, nueva compra con varios ítems usando `SelectorProducto`) | DB-25; promedio recalculado; idempotencia; aislamiento entre negocios; E2E de compra a crédito y pago |
| 2 | `feat/insumos` | RPC `registrar_consumo`, aviso de stock bajo de insumos, `reporte_insumos` y su pestaña en reportes de lavandería (con Excel como los demás). Panel: `/panel/inventario/consumo` | DB-26; E2E de consumo y reporte |
| 3 | `feat/reservas` | Migración `reservas` y `reserva_pagos`; RPC `crear_reserva`, `cancelar_reserva`, `reservas_activas`; `registrar_venta` con `reserva_id` y medio `anticipo`; arqueo con anticipos y devoluciones; rechazo de anular y devolver. POS: pestaña "Reservas" (crear, listar, completar cargando el carrito y cancelar) | DB-23, DB-24; arqueo; DB-04 con reservas; E2E-13 |
| 4 | `feat/credito` | Migración `credito_config`, `creditos`, `credito_cuotas`, `credito_pagos`; `plan_cuotas`; `registrar_venta` con `condicion` y bloque `credito`; `venta_items.lista` con `credito`; RPC `pagar_cuota`, `crear_credito_inicial`, `guardar_credito_config`, lecturas `cuentas_por_cobrar` y `detalle_credito`; arqueo con cuotas. POS: condición crédito en el cobro, plan imprimible, cobro de cuota. Panel: `/panel/creditos` (saldo por cliente, vencidas con días de atraso, detalle, saldos iniciales, configuración) | DB-21, DB-22; arqueo; E2E-12 |

Cierre de cada PR: `/code-review`, `/ponytail-review` y `/security-review` (todos tocan RLS y RPC); Codex no verificado
hasta el 2026-11-16. Después vienen CI verde y merge, `db push --linked` a producción (dry-run primero, verificando
`supabase/.temp/project-ref`), verificación con Playwright en producción y actualización del handoff.

## Trampas

- Toda migración nueva exige `pnpm db:types` y commitear `database.types.ts`; CI hace `git diff --exit-code`.
- Las migraciones nuevas llevan un timestamp mayor que `20261102150000`. Nunca se edita una migración aplicada.
- `registrar_venta`, `anular_venta`, `devolver_venta` y `efectivo_esperado` se redefinen enteras con la firma exacta;
  una diferencia de firma crea una sobrecarga en vez de reemplazar.
- El índice único `(ref_id, producto_id, ubicacion_id, tipo)` del kardex: `reserva_liberada` y `venta` de la misma
  reserva usan `ref_id` distintos (reserva y venta).
- `humo.sql` falla si una tabla no tiene RLS. En las tablas nuevas va `revoke all` a `anon`, `authenticated` y
  `public`, y se da `grant select` por columna si hay costos.
- La cola offline: crédito y reserva nunca se encolan sin conexión. Un reintento con `p_offline` se rechaza con un
  error claro, que va a reconciliación.
- Los reportes nuevos respetan el tope de 5.000 filas y de 366 días (`ERP_LOTE_GRANDE`).
- Los E2E usan datos únicos por worker (`corrida`, `randomUUID`). Las cuentas vienen de `seed.sql`.
- Producción: aplicar la migración antes de que Vercel sirva la UI nueva, o en el mismo momento. El POS de producción
  manda claves nuevas solo cuando se usan crédito o reservas.

## Verificación por PR

`pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm db:reset && pnpm db:test`, `pnpm db:types` sin diff,
`pnpm build`, y los E2E del módulo más `pos-venta`, `pos-offline` e `inventario-flujo` como regresión. En producción
después del merge: rutas nuevas abiertas con Playwright con la cuenta del dueño.

## Estado

| PR | Estado |
|---|---|
| 1 compras | PR abierto (2026-11-08) |
| 2 insumos | pendiente |
| 3 reservas | pendiente |
| 4 crédito | pendiente |
