# Plan — Fase 4: lavandería

Objetivo: la lavandería recibe ropa, cobra al recibir, imprime boleta, sigue el estado de cada orden y la entrega, con y
sin conexión. Requisitos: RF-LAV-01 a RF-LAV-10, RN-09. Casos: DB-18, DB-19, E2E-09. Implementa Sonnet; el chairman
revisa, verifica y cierra.

## PRs, en orden

| # | Rama | Contenido | Se comprueba con |
|---|---|---|---|
| 1 | `feat/lavanderia-datos` | Tablas `ordenes` y `orden_eventos`, RPC `crear_orden`, `cambiar_estado_orden`, `entregar_orden`, `anular_orden`; cambios en `registrar_venta`, `anular_venta`, `devolver_venta`; seed | pgTAP: DB-18, DB-19 y casos de cada RPC |
| 2 | `feat/lavanderia-pos` | POS de lavandería: recepción, cobro, boleta, cola sin conexión, pestaña de órdenes con estados, entrega y anulación | Vitest; E2E-09 y orden sin conexión |
| 3 | `feat/lavanderia-panel` | `/panel/ordenes` con filtros, ropa sin recoger y detalle con historial; menú por tipo de negocio | E2E del panel |

## Decisiones

### La orden es una venta más su ficha

El arqueo (`efectivo_esperado`, `total_qr_sesion`, `resumen_caja`) solo suma `ventas` y `venta_pagos`. Una tabla
`orden_pagos` aparte obligaría a reescribir caja, QR pendiente y reconciliación. Por eso:

- `ordenes.id` = `ventas.id` (PK y FK). El cobro, los pagos, la caja, el QR pendiente, la numeración, la reconciliación,
  la anulación y la cola de la fase 3 se reutilizan sin cambios.
- `orden_items` y `orden_pagos` del modelo **no se crean**: son `venta_items` y `venta_pagos`. Se actualiza
  `docs/plan-modelo-datos.md`.
- El número de la boleta es el de la venta (`C1-000123`). Un solo contador por equipo.
- `peso_kg` no se guarda: los kilos salen de `venta_items` con unidad `kg` (RF-REP-02, fase 5).

### Tablas

`ordenes`:

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | FK compuesta `(negocio_id, id)` a `ventas` |
| `negocio_id` | uuid | negocio de tipo `lavanderia` |
| `estado` | text | `recibida`, `en_lavado`, `lista`, `entregada`, `cancelada` |
| `estado_en` | timestamptz | cambia con cada estado; sirve para ropa sin recoger |
| `recibida_por` | uuid | = `ventas.vendedor_id` (RF-LAV-08) |
| `cliente_nombre` | text | foto: con `cliente_id` sale de `clientes`; sin conexión, lo escrito |
| `cliente_telefono` | text null | igual |
| `express` | boolean | |
| `prendas` | integer > 0 | |
| `casillero` | text null | hasta 20 caracteres |
| `fecha_prometida` | date | no anterior al día de recepción |
| `nota` | text null | hasta 500; también daños o pérdidas (P-16) |
| `retirada_por`, `retiro_con`, `documento_retiro`, `entregada_por`, `entregada_en` | | se llenan al entregar; `retiro_con` `boleta` o `carnet`; carnet exige documento |
| `motivo_anulacion`, `anulada_por` | | se llenan al anular |
| `huella` | text | md5 de `p_orden`, sin select |

`orden_eventos`: `id`, `negocio_id`, `orden_id`, `estado`, `usuario_id`, `motivo`, `created_at`. Append-only con
`rechazar_modificacion()`.

RLS como el resto: select por `mis_negocios()`, sin escritura directa, grants por columna. Índice
`(negocio_id, estado, estado_en)`.

### `crear_orden(p_venta jsonb, p_orden jsonb, p_offline jsonb default null)`

- `p_orden` = `{ cliente_nombre?, cliente_telefono?, express, prendas, casillero?, fecha_prometida, nota? }`. Claves
  estrictas con `payload_claves`.
- Llama a `registrar_venta(p_venta, p_offline)` en la misma transacción. Todas sus reglas siguen.
- Ítems: todos `servicio`; lista `express` si `express`, si no `normal`. Si no, `ERP_DATOS_INVALIDOS`.
- Idempotente: si la orden existe, misma huella devuelve la original; otra, `ERP_OPERACION_REPETIDA`.
- Inserta el evento `recibida`, con `usuario_id` = quien recibió.
- Devuelve `{ id, numero, total, estado }`.

### Cliente sin conexión

Hoy `registrar_venta` rechaza una venta de lavandería sin cliente, y el POS no busca clientes sin red (fase 3: no se
guardan datos personales en IndexedDB). RF-LAV-09 pide crear la orden sin internet. Entonces:

- Con conexión: cliente elegido o creado con el selector, como hoy. La ficha copia nombre y teléfono.
- Sin conexión: el cajero escribe nombre (obligatorio) y teléfono. `cliente_id` va nulo.
- `registrar_venta`: la regla de cliente obligatorio en lavandería no aplica con `p_offline`; en su lugar marca
  `sin_cliente` en `motivos_revision`. Se suma al `check`.
- `crear_orden` exige `cliente_id` o `cliente_nombre`.
- Vincular después a un cliente registrado queda fuera de esta fase.

### Estados (RF-LAV-04)

- `cambiar_estado_orden(p_orden_id, p_estado)`, permiso `cambiar_estado_orden`.
- Pasos permitidos: `recibida` ↔ `en_lavado` ↔ `lista`. Se permite volver un paso para corregir un clic. Mismo estado:
  devuelve sin cambios. Otro salto: `ERP_ORDEN_ESTADO`.
- Cada cambio deja evento con usuario.
- Solo con conexión (RF-LAV-09).

### Entrega (RF-LAV-06)

- `entregar_orden(p_orden_id, p_retirada_por, p_retiro_con, p_documento default null)`, permiso
  `cambiar_estado_orden`. Solo desde `lista`; si no, `ERP_ORDEN_ESTADO`.
- Carnet exige documento. Idempotente con los mismos datos.

### Anulación (RF-LAV-10)

- `anular_orden(p_orden_id, p_motivo)`, permiso `anular`, motivo de 1 a 200 caracteres. Desde `recibida`, `en_lavado` o
  `lista`.
- Pasa la orden a `cancelada` con evento y motivo. Si la caja de la venta sigue abierta, anula también la venta con
  `anular_venta` y el efectivo vuelve a esa caja. Si ya cerró, no toca el dinero y devuelve `reembolso: false`; si hay
  que devolver plata, se hace con una devolución en Ventas.
- `anular_venta` y `devolver_venta` sobre una venta con orden activa dan `ERP_ES_ORDEN`. Así una orden nunca queda
  activa con su venta anulada. `anular_orden` cancela la orden antes de llamar a `anular_venta`.
- **Límite aceptado:** con la caja abierta, `anular_orden` hereda las reglas de `anular_venta`. Si ya no hay ese efectivo
  en la caja (`ERP_EFECTIVO_INSUFICIENTE`), o pasaron 24 h sin `devolver_fuera_plazo`, se revierte todo y la orden no se
  cancela hasta que cierre la caja. No se pierde plata y el mensaje lo dice.

### POS

- `PosVenta` recibe el tipo. En lavandería muestra 2 pestañas: **Nueva orden** y **Órdenes**.
- Nueva orden: el flujo de venta actual con servicios (lista `normal` o `express` según el interruptor), más los datos
  de la ficha antes de cobrar. Sin red, nombre y teléfono escritos en lugar del selector.
- La cola no suma un tipo nuevo: la fila sigue siendo `venta` y su payload suma `orden`. El enviador llama a
  `crear_orden` si hay `orden` y a `registrar_venta` si no. Numeración, renumerado, descarte, rechazadas y `existeVenta`
  quedan iguales.
- Boleta: la nota de venta con el bloque de la orden (casillero, prendas, express, fecha prometida). Dirección y
  teléfono salen de `datos_nota`, como en la nota.
- Órdenes: activas del negocio por número o cliente, con avanzar, volver, entregar y anular. Sin red, la pestaña dice
  que pide conexión.

### Panel

- `/panel/ordenes`: lista paginada por cursor con filtro de estado, búsqueda por número o cliente y "sin recoger" (RN-09:
  `lista` con `estado_en` de más de 30 días). Detalle con ficha, ítems, pagos e historial.
- Permiso: `ver_reportes` o `cambiar_estado_orden`, y negocio de tipo `lavanderia`.
- El menú suma `tipos` opcional a `Item`.

## Trampas

- Reemplazar `registrar_venta`, `anular_venta` y `devolver_venta` exige `create or replace` con la misma firma y
  conservar `revoke`/`grant`.
- `motivos_revision` tiene un `check`: sumar `sin_cliente`, y en TypeScript sus etiquetas.
- `crear_orden` llama a `registrar_venta`: ambas `security definer`, `auth.uid()` se conserva.
- Tipos con `pnpm db:types` tras la migración.
- Migración en staging antes del deploy que la use.
- Seed: equipo `L1` y un cliente en la lavandería, solo local. Nunca en staging.

## Fuera de esta fase

Reportes de lavandería (fase 5), vincular órdenes sin conexión a un cliente, avisos por WhatsApp, fotos de daños,
insumos (Entrega B).

## Verificación

- pgTAP, Vitest, E2E y build en verde en cada PR; `/code-review` y `/ponytail-review` en todos; `/security-review` en
  PR 1 y 3.
- E2E-09: recepción con cliente, cobro mixto, boleta, en lavado, lista, entrega con carnet; la caja suma la orden.
- Orden sin conexión: se crea, se imprime, al volver la red queda una sola, con `sin_cliente`.
- Tras cada merge: producción con Playwright, sin sesión.
