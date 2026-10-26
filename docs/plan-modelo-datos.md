# Plan — Modelo de datos (núcleo)

Estado: **borrador del núcleo** (2026-10-26). Cubre lo que no depende de las respuestas de los formularios. Lo que sí
depende está marcado como **[FORM]** y se cierra cuando lleguen.

## Objetivo

Una sola base Postgres (Supabase) para los 3 negocios, aislados por `negocio_id` con RLS. Soporta:

- POS con venta sin conexión (idempotente, append-only).
- Panel ERP con inventario y kardex, caja y reportes.
- Cantidades decimales (kg en el frial).

## Principios

1. **Multi-negocio por fila:** toda tabla operativa lleva `negocio_id`. RLS filtra por los negocios asignados al
   usuario.
2. **Escrituras sensibles solo por RPC:** ventas, anulaciones, ajustes, compras y caja se escriben con funciones
   `security definer` que validan permisos. El cliente no tiene `INSERT/UPDATE/DELETE` directo sobre tablas
   contables.
3. **Kardex append-only:** nunca se edita ni se borra un movimiento. Una corrección es un contramovimiento.
4. **IDs generados en el cliente (UUID)** en ventas, caja y órdenes, para que el reenvío sea idempotente
   (`on conflict (id) do nothing`).
5. **Tipos:**
   - Dinero: `numeric(12,2)`, en Bs.
   - Cantidades: `numeric(12,3)`, la misma para unidades y kg.
   - Fechas: `timestamptz`.
6. **Stock negativo permitido** (puede pasar con ventas sin conexión). No se bloquea: se marca para revisar.

## Tablas

### Tenencia, usuarios y permisos

| Tabla | Campos clave | Notas |
|---|---|---|
| `negocios` | id, nombre, tipo (`tienda`\|`lavanderia`\|`frial`), nit, datos de nota | 3 filas |
| `ubicaciones` | id, negocio_id, nombre, tipo (`local`\|`deposito`) | stock por ubicación. Lider puede tener depósito **[FORM]** |
| `perfiles` | id (= auth.uid), nombre, activo | |
| `usuario_negocio` | usuario_id, negocio_id, rol | un usuario puede estar en varios negocios |
| `rol_permisos` | rol, permiso | seed desde la grilla de la sección 3 **[FORM]** |
| `dispositivos` | id, negocio_id, ubicacion_id, nombre, prefijo (`C1`) | se registra con conexión, lo autoriza el encargado |

- Roles: `dueno`, `encargado`, `vendedor` (más los que salgan del form).
- Permisos: strings fijos (`vender`, `ver_costos`, `descontar`, `anular`, `ajustar_inventario`, `editar_productos`,
  `ver_reportes`, `caja`, `usuarios`).
- Helpers SQL (`stable`, `security definer`):
  - `mis_negocios()` devuelve setof uuid.
  - `tiene_permiso(negocio_id, permiso)` devuelve bool.
- Policies: `negocio_id in (select mis_negocios())`.

### Catálogo

| Tabla | Campos clave | Notas |
|---|---|---|
| `categorias` | id, negocio_id, nombre | |
| `productos` | id, negocio_id, codigo, codigo_barras, nombre, marca, modelo, categoria_id, tipo (`producto`\|`servicio`), unidad (`unidad`\|`kg`), controla_serie, activo, updated_at | servicio = lavandería |
| `producto_precios` | producto_id, lista, monto | `lista` por negocio (contado, credito, mayorista, minimo…) **[FORM]** |
| `series` | id, producto_id, serie, ubicacion_id, estado, venta_id | solo si Lider controla número de serie **[FORM]** |

- Unique: (negocio_id, codigo) y (negocio_id, codigo_barras) cuando no es null.

### Inventario y kardex

| Tabla | Campos clave | Notas |
|---|---|---|
| `movimientos_inventario` | id, negocio_id, ubicacion_id, producto_id, tipo, cantidad (con signo), costo_unitario, ref_tipo, ref_id, usuario_id, motivo, created_at | **append-only**: un trigger rechaza `UPDATE/DELETE` |
| `stock` | producto_id, ubicacion_id, cantidad, costo_promedio | lo mantiene un trigger en la misma transacción. Es solo caché del kardex |

- Valores de `tipo`: `inicial`, `compra`, `venta`, `anulacion_venta`, `ajuste`, `merma`, `devolucion_cliente`,
  `devolucion_proveedor`, `traslado_salida`, `traslado_entrada`.
- Costo:
  - Promedio ponderado recalculado en cada entrada de compra. El método final se confirma con el form **[FORM]**.
  - La venta guarda una foto de `costo_unitario` para calcular la ganancia.
- Chequeo de consistencia: una query de reconciliación `stock` = `sum(movimientos)`, usada como test y en la
  auditoría.

### Ventas (POS, con y sin conexión)

| Tabla | Campos clave | Notas |
|---|---|---|
| `ventas` | **id (UUID del cliente)**, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por, cliente_id, origen (`online`\|`offline`), creada_en_cliente, recibida_en, total, descuento, estado (`completada`\|`anulada`) | unique (negocio_id, numero) |
| `venta_items` | venta_id, producto_id, cantidad, precio_unitario (el que vio el vendedor), precio_lista_servidor, descuento, costo_unitario | la diferencia de precio va al reporte |
| `venta_pagos` | venta_id, medio, monto, verificacion (`no_aplica`\|`pendiente`\|`verificado`) | QR o transferencia sin conexión = `pendiente` |

- **RPC `registrar_venta(payload jsonb)`:**
  - Idempotente: si el `id` ya existe, devuelve la venta existente sin tocar nada.
  - En una sola transacción inserta la venta, los items, los pagos y los movimientos `venta` del kardex.
  - Valida:
    - que `auth.uid()` pertenezca al negocio y tenga `vender`;
    - que `vendedor_id` sea miembro del negocio;
    - que el dispositivo sea de ese negocio.
  - Guarda `enviada_por = auth.uid()`: el que envía puede no ser el que vendió, si alguien vuelve a iniciar sesión
    después de un corte.
  - **No recalcula precios:** respeta el precio que vio el vendedor y guarda el de lista para comparar.
- **Numeración:** `numero = prefijo del dispositivo + secuencia local` (`C1-000123`). Así no choca entre equipos sin
  conexión.
- **Reloj:** se guardan `creada_en_cliente` y `recibida_en`. Si la diferencia es grande, se marca en el reporte.
- **RPC `anular_venta(id, motivo)`:** requiere conexión y el permiso `anular`. Genera contramovimientos en el kardex.

### Caja

| Tabla | Campos clave | Notas |
|---|---|---|
| `caja_sesiones` | **id (UUID del cliente)**, negocio_id, dispositivo_id, usuario_apertura, abierta_en, monto_inicial, cerrada_en, usuario_cierre, monto_contado, monto_esperado, diferencia | una sesión abierta por dispositivo |
| `caja_movimientos` | id (UUID del cliente), sesion_id, tipo (`ingreso`\|`gasto`\|`retiro`), monto, motivo | |

- **Apertura:** se permite **sin conexión** (UUID del cliente). Si no, una mañana sin internet bloquearía la venta.
- **Cierre:** solo con conexión. El POS lo bloquea mientras la cola local tenga ventas o movimientos sin enviar.
  `monto_esperado` lo calcula el servidor.

### Clientes y proveedores

| Tabla | Campos clave | Notas |
|---|---|---|
| `clientes` | id, negocio_id (nullable si es compartido), nombre, ci_nit, telefono, direccion | compartido o por negocio **[FORM sección 4 Lider]** |
| `proveedores` | id, negocio_id, nombre, contacto | |
| `compras` / `compra_items` | id, negocio_id, proveedor_id, fecha, total / producto_id, cantidad, costo_unitario | RPC `registrar_compra` genera movimientos `compra` |

- Cuentas por pagar y por cobrar, y crédito con cuotas: **[FORM]**. No entran en el núcleo.

### Lavandería

| Tabla | Campos clave | Notas |
|---|---|---|
| `ordenes` | **id (UUID del cliente)**, negocio_id, numero, cliente_id, estado, recibida_en, fecha_prometida, total, anticipo | |
| `orden_items` | orden_id, producto_id (servicio), cantidad (unidades o kg), precio, descripcion_prenda | |
| `orden_eventos` | orden_id, estado, usuario_id, created_at | log append-only de estados |

- Estados: `recibida`, `en_proceso`, `lista`, `entregada`, `cancelada`. El flujo exacto y el cobro (anticipo y
  saldo) dependen del form **[FORM]**.
- Sin conexión solo se permite **crear** una orden (RPC idempotente). Los cambios de estado requieren conexión.

### Frial

- Ventas por kg: ya cubiertas por `numeric(12,3)` y `unidad = kg`.
- Lotes y despiece (una media res que entra y los cortes que salen con su rendimiento): **[FORM sección 5 frial]**.
  Probable `lotes` + `despieces` que generan movimientos `compra` (lote) y `ajuste` (salida del lote y entrada de los
  cortes).

### Auditoría

- `auditoria` (tabla, registro_id, accion, antes, despues, usuario_id, created_at).
- Se llena con trigger sobre `productos`, `producto_precios`, `usuario_negocio` y `rol_permisos`.

## Contrato offline del POS

- **Snapshot del catálogo:** RPC `catalogo_pos(ubicacion_id)` devuelve productos activos, precios, stock (solo
  informativo) y `version` (max `updated_at`). El POS lo refresca al reconectar y cada N minutos con conexión.
- **Cola local (IndexedDB):** ventas, aperturas de caja, movimientos de caja y órdenes nuevas.
  - Se envía en orden, con reintento y backoff.
  - Muestra el aviso "N pendientes sin enviar".
- **Sesión:** sin conexión, el POS opera con el usuario que tiene sesión iniciada. Al reconectar, si el token no se
  puede refrescar, pide login y la cola se conserva.

## Trampas y decisiones

- `security definer` + `search_path` fijo (`set search_path = ''`) en todas las RPC.
  - `mis_negocios()` no debe consultar tablas con RLS que la llamen a ella misma, para no entrar en recursión.
- El trigger de `stock` y la RPC de venta van en la misma transacción. Nunca calcular stock en el cliente.
- Ninguna escritura del cliente sobre `movimientos_inventario`, `stock` ni `ventas`: `revoke` y sin policies de
  escritura.
- No borrar productos con movimientos: se usa `activo = false`.
- Moneda USD y tipo de cambio: **[FORM sección 1]**. Si aplica, la venta guarda `moneda` + `tipo_cambio`.

## Pendiente de los formularios

- Grilla de permisos y roles extra.
- Depósito o ubicaciones de Lider.
- Número de serie.
- Listas de precio.
- Clientes compartidos.
- Crédito y cuotas.
- Flujo de la lavandería.
- Despiece del frial.
- Moneda USD.
- Método de costo.

## Verificación (cuando se implemente)

Tests SQL que se corren contra Supabase local:

1. La misma venta enviada 2 veces deja 1 sola fila y 1 sola serie de movimientos.
2. `UPDATE/DELETE` sobre `movimientos_inventario` falla.
3. Un usuario del negocio A no lee ni escribe en B (RLS).
4. `stock` = `sum(movimientos)` después de una serie de ventas, compras, anulaciones y ajustes.
5. Un vendedor sin `anular` no puede llamar `anular_venta`.
6. El cierre de caja calcula `monto_esperado` correcto con pagos mixtos.
