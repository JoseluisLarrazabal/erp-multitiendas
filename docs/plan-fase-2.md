# Plan — Fase 2: POS y caja

Objetivo: venta real con conexión que descuenta stock por kardex, caja con arqueo, anulación, devolución y clientes.
Requisitos: RF-VEN-01 a RF-VEN-08, RF-CAJ-01 a RF-CAJ-04, RF-CLI-01, RF-CLI-02, RF-CAT-07 (venta con serie). Casos:
DB-01, DB-05, DB-06, DB-08, DB-11, DB-13, DB-14, DB-15, DB-20, E2E-04, E2E-08. Hito: "Venta real con kardex". Implementa
Sonnet; el chairman revisa, verifica y cierra. Todo local.

La venta sin conexión es la fase 3. Esta fase deja listo lo que la fase 3 necesita: RPC idempotentes con UUID del cliente,
numeración por equipo y snapshot del catálogo. La cola en IndexedDB no entra aquí.

## PRs, en orden

| # | Rama | Contenido | Se comprueba con |
|---|---|---|---|
| 1 | `feat/caja-clientes-datos` | `clientes`, `caja_sesiones`, `caja_movimientos`, RPC de clientes y caja | pgTAP: DB-20, casos de RPC |
| 2 | `feat/ventas-datos` | `ventas`, `venta_items`, `venta_pagos`, `devoluciones`, `catalogo_pos`, RPC de venta, anulación y devolución, cierre de caja completo | pgTAP: DB-01, DB-05, DB-06, DB-08, DB-11, DB-13, DB-14, DB-15 |
| 3 | `feat/pos-venta` | `/pos`: equipo, apertura de caja, búsqueda, carrito, pagos, nota, consulta rápida | E2E-04, E2E-08 |
| 4 | `feat/caja-ventas-panel` | Movimientos y cierre de caja en `/pos`; en `/panel`: clientes, ventas con anulación y devolución, cajas | E2E de caja, anulación y devolución |

## Decisiones

### `/pos` es cliente

- Sin server actions: lee y escribe con el cliente de navegador y RPC, como ya hace el login. El precache conserva bundles
  viejos y un ID de action es por build.
- La sesión sigue el patrón de `use-pos-sesion.ts`.
- `/pos` sigue estático y precacheable. Lo nuevo entra al módulo `ventas` y `caja`, por su `index.ts`, sin importar
  `panel.ts` de ningún módulo.

### Equipo

- El POS elige su equipo entre los `dispositivos` del negocio activo y lo guarda en `localStorage`. Registrarlo sigue
  exigiendo `usuarios` (fase 0). Sin equipo elegido no se vende.
- El equipo fija ubicación de venta, prefijo de numeración y sesión de caja.

### Numeración

- `numero = prefijo + '-' + secuencia de 6 dígitos` (`C1-000123`), generado en el equipo.
- `dispositivos.ultimo_numero` lo mantiene `registrar_venta`. Al abrir el POS con conexión, el equipo toma el mayor entre su
  contador local y el del servidor. Así borrar el navegador no repite números.
- `unique (negocio_id, numero)`. Un choque da `ERP_NUMERO_DUPLICADO` y el POS avanza el contador y reintenta con el mismo
  UUID de venta.

### Catálogo del POS

- `catalogo_pos(p_ubicacion_id)` devuelve productos activos con precios en Bs por lista, unidad, serie, garantía, stock
  por ubicación del negocio, tipo de cambio vigente y `version`. Productos sin precio de contado van marcados: se ven en la
  consulta, no se venden.
- El POS lo carga entero en memoria al abrir y lo busca ahí (RNF-01, 2.000 productos por debajo de 200 ms). La fase 3 lo
  guarda en IndexedDB.
- `version` cambia con productos, precios, tipo de cambio y stock.

### Precio y descuento

- Lista por defecto: `contado` en tienda y frial. El vendedor puede elegir otra lista por línea; `credito` no se ofrece
  hasta la Entrega B.
- Descuento por línea y por venta, en Bs. Exige `descontar`. Tope: `negocios.tope_descuento` en porcentaje sobre el
  subtotal de la venta; sobre el tope, `ERP_DESCUENTO_TOPE` (DB-13). Precio final por debajo de la lista `minimo` también
  exige `descontar`.
- **Simplificación de RF-VEN-03:** un vendedor sin `descontar` no aplica descuentos; el POS le indica pedirlo a un
  encargado, que vende desde su sesión. Autorización con credenciales de otro usuario en el mismo equipo queda fuera:
  exige un mecanismo de PIN que el SRS no define. Se registra en `docs/handoff.md`.

### Venta

- `registrar_venta(p_venta jsonb)`, payload validado con Zod en el POS y de nuevo en la RPC.
- Idempotente por `id` (UUID del cliente): si existe, devuelve la venta sin tocar nada (DB-01).
- Valida: `vender` en el negocio; equipo del negocio; sesión de caja abierta de ese equipo; vendedor miembro del negocio;
  productos activos del negocio y no `servicio` fuera de lavandería; cantidad entera en `unidad`, hasta 3 decimales en
  `kg`; serie disponible en la ubicación del equipo si `controla_serie`, una por línea (RN-10, DB-15).
- Aritmética: el servidor no recalcula precios (RN-03), pero verifica que `total = suma(cantidad * precio - descuento) -
  descuento de venta`, redondeado a 2 (DB-11), y que la suma de pagos iguale el total (RF-VEN-02).
- Guarda `precio_lista_servidor`, `tipo_cambio` vigente y `costo_unitario` del promedio de la ubicación como foto (RN-02,
  RN-06, DB-08).
- Kardex: un movimiento `venta` por línea, con `ref_tipo = 'venta'`, `ref_id = venta.id`. Stock negativo permitido (RN-04).
- Pagos: `efectivo` con `verificacion = 'no_aplica'`; `qr` con `verificado` cuando el vendedor confirma que lo recibió.
  El vuelto se calcula en el POS y no se guarda.
- `origen = 'online'` en esta fase.

### Anulación y devolución

- `anular_venta(id, motivo)`: exige `anular`, conexión y que la sesión de caja de la venta siga abierta. Contramovimientos
  `anulacion_venta`, series de vuelta a `disponible`. La venta queda con `estado = 'anulada'` y sale del esperado de caja.
  Con la caja ya cerrada, se usa devolución.
- `devolver_venta(p_devolucion jsonb)`: UUID del cliente, líneas y cantidades, motivo y sesión de caja abierta del equipo
  que devuelve. Dentro de 24 h exige `anular`; después, `devolver_fuera_plazo` (RN-08, DB-14). No devuelve más de lo
  vendido menos lo ya devuelto. Movimientos `devolucion_cliente` con el costo de la venta; series de vuelta. El dinero
  sale por la caja de la sesión que devuelve.
- Requiere `devolucion_items` además de `devoluciones`.

### Caja

- `abrir_caja(id, dispositivo_id, monto_inicial)`: UUID del cliente, idempotente, una sesión abierta por equipo; exige
  `caja`.
- `registrar_movimiento_caja(id, sesion_id, tipo, monto, motivo)`: `ingreso`, `gasto`, `retiro`; motivo y monto > 0.
- `cerrar_caja(sesion_id, monto_contado)`: el servidor calcula `monto_esperado = inicial + efectivo de ventas completadas +
  ingresos - gastos - retiros - devoluciones en efectivo` y la diferencia (DB-06). QR no entra al efectivo; se muestra
  aparte. Cerrar exige `caja`. RN-07 (cola vacía) se impone en el POS en la fase 3.
- Sesiones por negocio, sin efecto cruzado (DB-20).
- Hecho en el PR 1, tras revisión:
  - `cerrar_caja` repetido con el mismo contado devuelve el resultado guardado; con otro, `ERP_CAJA_CERRADA`.
    `cerrada_en = clock_timestamp()`, para que ningún movimiento contado quede con hora posterior al cierre.
  - Gasto o retiro mayor al efectivo esperado: `ERP_EFECTIVO_INSUFICIENTE`. Movimientos y cierre toman la sesión
    `for update`. Probado a mano con 20 retiros concurrentes: pasan los que caben.
  - `caja_sesion_abierta` exige `caja`. Un id de sesión o movimiento de otro negocio da `ERP_SIN_PERMISO`.
  - El replay de `abrir_caja` con el id de una sesión cerrada devuelve ese id: el POS confirma con `caja_sesion_abierta`.
- **PR 2:** `efectivo_esperado` suma ventas en efectivo y resta devoluciones en efectivo. `devolver_venta` y `anular_venta`
  con pago en efectivo aplican el mismo chequeo (`ERP_EFECTIVO_INSUFICIENTE`) y toman la sesión `for update`, si no el
  esperado puede quedar negativo.

### Clientes

- `clientes` con `negocio_id` obligatorio (RF-CLI-02). `guardar_cliente` exige `vender` para crear desde el POS y
  `editar_productos` para editar desde el panel. CI o NIT único por negocio cuando no es null.
- Búsqueda por nombre o documento. Venta con cliente general = `cliente_id` null.
- Datos personales: no van a logs ni a mensajes de error.

### Nota de venta

- Página imprimible en el POS con `window.print()` y estilos `@media print` para papel de 80 mm y A4. PDF por "Guardar como
  PDF" del navegador. Sin dependencia nueva.
- Contenido: negocio, NIT, `datos_nota` (dirección y teléfono), número, fecha, vendedor, cliente, líneas, garantía por
  producto, descuentos, total, pagos.

### Panel

| Ruta | Permiso |
|---|---|
| `/panel/clientes` | `vender` o `editar_productos` |
| `/panel/ventas`, `/panel/ventas/[id]` | `ver_reportes` o `anular` |
| `/panel/cajas`, `/panel/cajas/[id]` | `caja` o `ver_reportes` |

Anular y devolver también desde `/panel/ventas/[id]`, con la sesión de caja abierta del equipo que elija el usuario.

## Trampas

- Todo `select` desde la web lista columnas: `stock.costo_promedio` y `movimientos_inventario.costo_unitario` no se leen.
  `venta_items.costo_unitario` sigue la misma regla: sin `select` para `authenticated`; la ganancia sale por RPC en la fase 5.
- Toda tabla nueva: RLS, `revoke` y `grant` explícitos, append-only donde corresponda (`venta_items`, `venta_pagos`,
  `caja_movimientos`, `devoluciones`, `devolucion_items`). `ventas` cambia solo `estado` por RPC.
- Bloqueos: ordenar por `producto_id` y `ubicacion_id` antes de tocar `stock`, como en `trasladar_stock`.
- Cada RPC con UUID del cliente prueba idempotencia y reintento con datos distintos (`ERP_OPERACION_REPETIDA`).
- CI ronda 25 de 30 logins por 5 minutos: las E2E nuevas usan sesiones guardadas.
- `/pos` no importa nada que arrastre `next/headers` ni server actions.

## Fuera de esta fase

- Cola offline, envío con backoff, aviso de pendientes, bloqueo de cierre con cola: fase 3.
- Caja sin conexión: hoy `abierta_en`, `created_at` y el usuario salen del servidor al sincronizar. La fase 3 agrega hora
  y usuario del equipo (como `creada_en_cliente` en ventas) a apertura, movimientos y cierre.
- Búsqueda de clientes sin índice: `pg_trgm` si un negocio pasa de unos 10.000.
- Lavandería y venta por peso en frial: fases 4 y 5. La venta ya acepta `kg`.
- Crédito y reservas: Entrega B.
- Reporte de ventas y ganancia: fase 5.

## Verificación

- CI verde en cada PR.
- `stock` = suma del kardex tras ventas, anulaciones y devoluciones.
- Venta repetida 20 veces en paralelo con el mismo UUID deja una venta.
- E2E-04 y E2E-08 en verde; POS probado en navegador real a 1280 px y 390 px, con lector simulado.
