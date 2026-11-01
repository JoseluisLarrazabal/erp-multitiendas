# Plan — Modelo de datos

Estado: **cerrado para la v1** (2026-11-01), con las respuestas de Lider y lavandería. Frial se modela según contrato,
porque aún no abre. Requisitos en `docs/srs.md`.

## Objetivo

Una sola base Postgres (Supabase) para los 3 negocios, aislados por `negocio_id` con RLS. Soporta:

- POS con venta sin conexión (idempotente, append-only).
- Panel ERP con inventario y kardex, caja y reportes.
- Cantidades decimales (kg en el frial).
- Precios en USD con cobro en Bs.
- Crédito, reservas, compras e insumos (Entrega B).

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
   - Dinero: `numeric(12,2)`, en Bs salvo `producto_precios` en USD.
   - Tipo de cambio: `numeric(10,4)`.
   - Cantidades: `numeric(12,3)`, la misma para unidades y kg.
   - Fechas: `timestamptz`.
6. **Stock negativo permitido** (puede pasar con ventas sin conexión). No se bloquea: se marca para revisar.

## Tablas

### Tenencia, usuarios y permisos

| Tabla | Campos clave | Notas |
|---|---|---|
| `negocios` | id, nombre, tipo (`tienda`\|`lavanderia`\|`frial`), nit, datos de nota, tope_descuento | 3 filas |
| `ubicaciones` | id, negocio_id, nombre, tipo (`local`\|`deposito`) | Lider: tienda y depósito. Lavandería y frial: local |
| `perfiles` | id (= auth.uid), nombre, activo | `activo` lo mantiene un trigger desde `auth.users.banned_until`; nadie lo escribe a mano |
| `usuario_negocio` | usuario_id, negocio_id, rol | un usuario puede estar en varios negocios |
| `rol_permisos` | tipo_negocio, rol, permiso | seed desde la matriz del SRS, sección 4 |
| `dispositivos` | id, negocio_id, ubicacion_id, nombre, prefijo (`C1`) | se registra con conexión, con el permiso `usuarios` |

- Roles: `dueno`, `encargado`, `contador`, `vendedor`, `empleado`.
- Permisos: strings fijos (`vender`, `ver_costos`, `descontar`, `anular`, `devolver_fuera_plazo`, `ajustar_inventario`,
  `editar_productos`, `ver_reportes`, `caja`, `usuarios`, `cambiar_estado_orden`, `gestionar_credito`,
  `gestionar_reservas`, `gestionar_compras`).
- Helpers SQL (`stable`, `security definer`):
  - `mis_negocios()` devuelve setof uuid.
  - `tiene_permiso(negocio_id, permiso)` devuelve bool.
  - `comparte_negocio(usuario_id)` devuelve bool; la usa la policy de `perfiles`.
  - `puede_administrar_cuenta(usuario_id)` devuelve bool; la consulta la Edge Function `admin-usuarios` con el JWT del
    llamador antes de banear (regla 3 de `docs/plan-fase-0.md`).
  - `puede_asignar_rol(negocio_id, rol)` devuelve bool: permiso `usuarios`, rol existente para el tipo de negocio y, si el
    rol es `dueno`, que el llamador sea dueño. La consulta `admin-usuarios` antes de crear una cuenta; `asignar_usuario` sigue
    imponiendo sus reglas.
  - `es_dueno(negocio_id)` devuelve bool; privado (sin `grant`), solo lo llaman las funciones `security definer`.
  - Las cuentas con `perfiles.activo = false` quedan fuera de `mis_negocios()` y `tiene_permiso()`.
- Policies: `negocio_id in (select mis_negocios())`.

### Catálogo

| Tabla | Campos clave | Notas |
|---|---|---|
| `categorias` | id, negocio_id, nombre | |
| `productos` | id, negocio_id, codigo, codigo_barras, nombre, marca, modelo, categoria_id, tipo (`producto`\|`servicio`\|`insumo`), unidad (`unidad`\|`kg`), controla_serie, garantia_meses, stock_minimo, foto_path, activo, updated_at | servicio = lavandería, insumo = Entrega B |
| `producto_precios` | negocio_id, producto_id, lista, monto, moneda (`BOB`\|`USD`) | listas: `contado`, `credito`, `mayorista`, `minimo`, `normal`, `express` |
| `tipos_cambio` | id, negocio_id, valor, vigente_desde, usuario_id | append-only; rige el más reciente |
| `series` | id, producto_id, serie, ubicacion_id, estado (`disponible`\|`vendida`\|`devuelta`), venta_id | solo productos con `controla_serie` |

- Unique: (negocio_id, codigo) y (negocio_id, codigo_barras) cuando no es null. La importación los resuelve antes
  (`docs/migracion-datos.md`).
- Precio en Bs de un producto en USD: `round(monto * tipo_cambio, 2)` (P-08). Vive en una sola función SQL,
  `precio_bs(producto_id, lista)`.
- Una variante de color es un producto aparte.

### Inventario y kardex

| Tabla | Campos clave | Notas |
|---|---|---|
| `movimientos_inventario` | id, negocio_id, ubicacion_id, producto_id, tipo, cantidad (con signo), costo_unitario, ref_tipo, ref_id, usuario_id, motivo, created_at | **append-only**: un trigger rechaza `UPDATE/DELETE` |
| `stock` | negocio_id, producto_id, ubicacion_id, cantidad, costo_promedio | lo mantiene un trigger en la misma transacción. Es solo caché del kardex. `costo_promedio` es `numeric(12,4)` y sin `select` para `authenticated` |
| `operaciones_inventario` | id (UUID de la operación), negocio_id, huella, created_at | idempotencia de las RPC de inventario: la misma operación con otros datos da `ERP_OPERACION_REPETIDA`. **append-only**, sin acceso para `authenticated` |
| `conteos` / `conteo_items` | id, negocio_id, ubicacion_id, fecha, usuario_id / producto_id, cantidad_sistema, cantidad_contada | cada diferencia genera un `ajuste` |

- Valores de `tipo`: `inicial`, `compra`, `entrada`, `venta`, `anulacion_venta`, `ajuste`, `danado`, `cambio_garantia`,
  `devolucion_cliente`, `devolucion_proveedor`, `traslado_salida`, `traslado_entrada`, `reserva`, `reserva_liberada`,
  `consumo`, `ajuste_costo`. Este último tiene cantidad 0 y fija `costo_promedio`, para cargar costos sin tocar stock.
- `ajustar_inventario` registra `ajuste`, `danado`, `cambio_garantia` y `devolucion_proveedor`, siempre con motivo.
- Costo:
  - Promedio ponderado recalculado en cada entrada con costo.
  - La venta guarda una foto de `costo_unitario` para calcular la ganancia.
- Chequeo de consistencia: una query de reconciliación `stock` = `sum(movimientos)`, usada como test y en la
  auditoría.

### Ventas (POS, con y sin conexión)

| Tabla | Campos clave | Notas |
|---|---|---|
| `ventas` | **id (UUID del cliente)**, negocio_id, ubicacion_id, dispositivo_id, caja_sesion_id, numero, vendedor_id, enviada_por, cliente_id, origen (`online`\|`offline`), creada_en_cliente, recibida_en, total, descuento, tipo_cambio, condicion (`contado`\|`credito`), estado (`completada`\|`anulada`) | unique (negocio_id, numero) |
| `venta_items` | venta_id, producto_id, serie_id, cantidad, precio_unitario (el que vio el vendedor), precio_lista_servidor, descuento, costo_unitario | la diferencia de precio va al reporte |
| `venta_pagos` | venta_id, medio (`efectivo`\|`qr`), monto, verificacion (`no_aplica`\|`pendiente`\|`verificado`) | QR sin conexión = `pendiente` |
| `devoluciones` | id, venta_id, usuario_id, motivo, monto, caja_sesion_id, created_at | el dinero sale por caja |

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
- Cada negocio tiene sus sesiones. No hay traspasos entre negocios.

### Clientes

| Tabla | Campos clave | Notas |
|---|---|---|
| `clientes` | id, negocio_id (obligatorio), nombre, ci_nit, telefono, direccion | no se comparten entre negocios |

- El "cliente general" es `cliente_id = null`.

### Lavandería

| Tabla | Campos clave | Notas |
|---|---|---|
| `ordenes` | **id (UUID del cliente)**, negocio_id, numero, cliente_id, estado, recibida_en, recibida_por, fecha_prometida, express, peso_kg, prendas, casillero, total, caja_sesion_id, nota, retirada_por, retiro_con (`boleta`\|`carnet`) | |
| `orden_items` | orden_id, producto_id (servicio), cantidad (unidades o kg), precio, descripcion_prenda | |
| `orden_pagos` | orden_id, medio, monto, verificacion | el cobro se hace al recibir |
| `orden_eventos` | orden_id, estado, usuario_id, created_at | log append-only de estados |

- Estados: `recibida`, `en_lavado`, `lista`, `entregada`, `cancelada`.
- Sin conexión solo se permite **crear** una orden (RPC idempotente). Los cambios de estado requieren conexión.
- Ropa sin recoger: `estado = lista` y más de 30 días desde el evento `lista`.

### Frial

- Ventas por kg: ya cubiertas por `numeric(12,3)` y `unidad = kg`.
- Lotes y despiece: **diferidos**. El contrato no los pide y el frial aún no abre. El modelo no los bloquea: se pueden
  agregar como tablas nuevas que generen movimientos.

### Crédito (Entrega B)

| Tabla | Campos clave | Notas |
|---|---|---|
| `credito_config` | negocio_id, inicial_pct, plazo_cuotas, interes_mensual_pct, frecuencia | por defecto 50, 3, 2,5, mensual |
| `creditos` | id, negocio_id, venta_id, cliente_id, capital, inicial, interes_mensual_pct, estado (`activo`\|`pagado`\|`anulado`), origen (`venta`\|`saldo_inicial`), docs_ci, docs_domicilio, docs_pagare | los parámetros se copian al crear |
| `credito_cuotas` | id, credito_id, numero, vence_en, capital, interes, pagado | se generan al crear |
| `credito_pagos` | id (UUID del cliente), credito_id, cuota_id, monto, medio, caja_sesion_id, usuario_id | append-only |

- Saldo = suma de cuotas menos suma de pagos. No se guarda aparte.
- El cálculo del interés espera P-07.

### Reservas (Entrega B)

| Tabla | Campos clave | Notas |
|---|---|---|
| `reservas` | id, negocio_id, cliente_id, producto_id, ubicacion_id, cantidad, precio_acordado, estado (`activa`\|`completada`\|`cancelada`), venta_id | |
| `reserva_pagos` | id, reserva_id, monto, medio, caja_sesion_id, tipo (`anticipo`\|`devolucion`) | el anticipo entra por caja |

- Reservar genera movimiento `reserva` (salida). Completar o cancelar genera `reserva_liberada`; completar genera
  además `venta`. Así el stock disponible ya descuenta lo reservado, sin un campo aparte.

### Proveedores y compras (Entrega B)

| Tabla | Campos clave | Notas |
|---|---|---|
| `proveedores` | id, negocio_id, nombre, contacto | |
| `compras` / `compra_items` | id, negocio_id, proveedor_id, fecha, total, condicion (`contado`\|`credito`) / producto_id, cantidad, costo_unitario | RPC `registrar_compra` genera movimientos `compra` |
| `proveedor_pagos` | id, proveedor_id, compra_id, monto, medio, caja_sesion_id, usuario_id | saldo = compras a crédito menos pagos |

### Auditoría

- `auditoria` (tabla, registro_id, accion, antes, despues, usuario_id, created_at).
- Se llena con trigger sobre `productos`, `producto_precios`, `tipos_cambio`, `usuario_negocio` y `rol_permisos`. Desactivar
  una cuenta lo registra `auditar_cuenta` (solo `service_role`), que llama `admin-usuarios` con el id verificado del llamador.

## Catálogo de RPC

Toda escritura contable pasa por estas funciones. `plan-pruebas.md` exige casos para cada una.

| Módulo | RPC |
|---|---|
| Usuarios | `asignar_usuario`, `quitar_usuario`, `registrar_dispositivo`; cuentas por Edge Function `admin-usuarios` (`docs/arquitectura.md`) |
| Catálogo | `guardar_categoria`, `guardar_producto`, `desactivar_producto`, `guardar_precios`, `registrar_tipo_cambio`, `precio_bs`, `catalogo_pos` |
| Inventario | `registrar_entrada`, `ajustar_inventario`, `trasladar_stock`, `registrar_conteo`, `registrar_series`, `fijar_costos`, `costos_stock`, `kardex_producto`, `stock_inconsistente` |
| Ventas | `registrar_venta`, `anular_venta`, `devolver_venta` |
| Caja | `abrir_caja`, `registrar_movimiento_caja`, `cerrar_caja` |
| Lavandería | `crear_orden`, `cambiar_estado_orden`, `entregar_orden`, `anular_orden` |
| Crédito | `crear_credito`, `pagar_cuota` |
| Reservas | `crear_reserva`, `completar_reserva`, `cancelar_reserva` |
| Compras | `registrar_compra`, `pagar_proveedor` |
| Insumos | `registrar_consumo` |

## Contrato offline del POS

- **Snapshot del catálogo:** RPC `catalogo_pos(ubicacion_id)` devuelve productos activos, precios en Bs, tipo de cambio,
  stock (solo informativo) y `version` (max `updated_at`). El POS lo refresca al reconectar y cada N minutos con
  conexión.
- **Cola local (IndexedDB):** ventas, aperturas de caja, movimientos de caja y órdenes nuevas.
  - Se envía en orden, con reintento y backoff.
  - Muestra el aviso "N pendientes sin enviar".
- **Sesión:** sin conexión, el POS opera con el usuario que tiene sesión iniciada. Al reconectar, si el token no se
  puede refrescar, pide login y la cola se conserva.
- Crédito, reservas y compras requieren conexión.

## Trampas y decisiones

- `security definer` + `search_path` fijo (`set search_path = ''`) en todas las RPC.
  - `mis_negocios()` no debe consultar tablas con RLS que la llamen a ella misma, para no entrar en recursión.
- El trigger de `stock` y la RPC de venta van en la misma transacción. Nunca calcular stock en el cliente.
- Ninguna escritura del cliente sobre `movimientos_inventario`, `stock` ni `ventas`: `revoke` y sin policies de
  escritura.
- No borrar productos con movimientos: se usa `activo = false`.
- La venta guarda `tipo_cambio` y el precio en Bs: un tipo nuevo no cambia ventas pasadas.
- Un tipo de cambio nuevo cambia `updated_at` del snapshot, para que el POS lo refresque.

## Supuestos sujetos a confirmación

Ver `docs/srs.md`, sección 7: serie (P-01), cobro en Bs (P-03), interés (P-07), redondeo (P-08), depósitos (P-09),
reservas (P-12).

## Verificación (cuando se implemente)

Casos completos en `docs/plan-pruebas.md`. Tests SQL que se corren contra Supabase local:

1. La misma venta enviada 2 veces deja 1 sola fila y 1 sola serie de movimientos.
2. `UPDATE/DELETE` sobre `movimientos_inventario` falla.
3. Un usuario del negocio A no lee ni escribe en B (RLS).
4. `stock` = `sum(movimientos)` después de una serie de ventas, entradas, anulaciones y ajustes.
5. Un vendedor sin `anular` no puede llamar `anular_venta`.
6. El cierre de caja calcula `monto_esperado` correcto con pagos mixtos.
