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
- Un número mayor a `ultimo_numero + 1000` da `ERP_DATOS_INVALIDOS`: `ultimo_numero` solo sube, y un salto a `999999`
  dejaría al equipo sin numeración.

### Catálogo del POS

- `catalogo_pos(p_ubicacion_id)` devuelve productos activos con precios en Bs por lista, unidad, serie, garantía, stock
  por ubicación del negocio, tipo de cambio vigente y `version`. Productos sin precio de contado van marcados: se ven en la
  consulta, no se venden.
- El POS lo carga entero en memoria al abrir y lo busca ahí (RNF-01, 2.000 productos por debajo de 200 ms). La fase 3 lo
  guarda en IndexedDB.
- `version` cambia con productos, precios, tipo de cambio y stock. Es `md5` del contenido devuelto: un `max(timestamp)` no
  detecta un commit tardío.
- Stock: `stock_por_ubicacion` (`{ubicacion_id: cantidad}`), `stock_total`, y `ubicaciones` en la raíz. Medido con 2.000
  productos: 85 ms y 930 KB.

### Precio y descuento

- Lista por defecto: `contado` en tienda y frial. El vendedor puede elegir otra lista por línea; `credito` no se ofrece
  hasta la Entrega B.
- Descuento por línea y por venta, en Bs. Exige `descontar`. Tope: `negocios.tope_descuento` en porcentaje sobre el
  subtotal de la venta; sobre el tope, `ERP_DESCUENTO_TOPE` (DB-13). Precio final por debajo de la lista `minimo` también
  exige `descontar`.
- **Hecho en el PR 2, tras revisión:**
  - Piso unitario = `least(minimo, precio de la lista elegida)`. Del piso para arriba se negocia sin permiso y no cuenta
    para el tope: vender a una lista publicada nunca es descuento. Bajo el piso exige `descontar`, y la brecha suma al
    descuento y a la base del tope, para que bajar el precio no achique la base.
  - `precio_unitario > 0` siempre.
  - `tope_descuento` arranca en 0: nadie descuenta hasta que el negocio lo configure. `fijar_tope_descuento(negocio, tope)`
    exige `usuarios`; la pantalla va en el PR 4. Cada cambio queda en `auditoria` con inserción directa desde la RPC,
    porque `auditar_cambio` no sirve para `negocios`, que no tiene `negocio_id`.
  - **PR 3:** con catálogo viejo, un precio que quedó bajo el piso da `ERP_SIN_PERMISO` o `ERP_DESCUENTO_TOPE`. El POS
    recarga el catálogo ante esos errores antes de mostrarlos.
  - **Fase 3:** la venta offline no se puede rechazar por catálogo viejo (RN-03). Con `origen = 'offline'` estas reglas
    deben marcar la venta para revisión en vez de rechazarla.
- **Simplificación de RF-VEN-03:** un vendedor sin `descontar` no aplica descuentos; el POS le indica pedirlo a un
  encargado, que vende desde su sesión. Autorización con credenciales de otro usuario en el mismo equipo queda fuera:
  exige un mecanismo de PIN que el SRS no define. Se registra en `docs/handoff.md`.

### Venta

- `registrar_venta(p_venta jsonb)`, payload validado con Zod en el POS y de nuevo en la RPC.
- Idempotente por `id` (UUID del cliente): si existe, devuelve la venta sin tocar nada (DB-01). La igualdad se comprueba
  con `huella`, md5 del payload, en `ventas` y `devoluciones`: el POS reintenta con el payload idéntico, y solo cambia
  `numero` tras `ERP_NUMERO_DUPLICADO`, que no guardó nada. `huella` no se expone: por eso `ventas` y `devoluciones` tienen
  grant por columnas y un `select *` falla.
- Valida: `vender` en el negocio; equipo del negocio; sesión de caja abierta de ese equipo; vendedor miembro del negocio;
  productos activos del negocio y no `servicio` fuera de lavandería; cantidad entera en `unidad`, hasta 3 decimales en
  `kg`; serie disponible en la ubicación del equipo si `controla_serie`, una por línea (RN-10, DB-15).
- Aritmética: el servidor no recalcula precios (RN-03), pero verifica que `total = suma(cantidad * precio - descuento) -
  descuento de venta`, redondeado a 2 (DB-11), y que la suma de pagos iguale el total (RF-VEN-02).
- Guarda `precio_lista_servidor`, `tipo_cambio` vigente y `costo_unitario` del promedio de la ubicación como foto (RN-02,
  RN-06, DB-08).
- `creada_en_cliente` exige ISO 8601 con zona explícita, como `Date.toISOString()`.
- Solo condición `contado` en esta fase; crédito llega con la Entrega B. `ventas.total > 0`.
- `ventas.subtotal` es el bruto, antes de descuentos. `venta_items.linea` conserva el orden del carrito.
  `venta_items.descuento_venta` guarda la parte prorrateada del descuento de la venta.
- `ventas.tipo_cambio` es null solo si el negocio nunca cargó uno.
- Kardex: un movimiento `venta` por producto, suma de sus líneas, porque `movimientos_operacion_uq` es único por
  `(ref_id, producto, ubicación, tipo)`. `ref_tipo = 'venta'`, `ref_id = venta.id`. Stock negativo permitido (RN-04).
- Un producto con ventas no cambia de `tipo` ni de `unidad`, ni apaga `controla_serie` (`ERP_PRODUCTO_CON_MOVIMIENTOS`, por
  trigger): un servicio vendido no deja movimientos, y al pasarlo a insumo la anulación crearía stock fantasma.
- Pagos: `efectivo` con `verificacion = 'no_aplica'`; `qr` exige `verificado: true`, que el POS manda cuando el vendedor
  confirma que lo recibió. Sin eso da `ERP_DATOS_INVALIDOS`: `pendiente` queda para offline (fase 3), porque en línea no
  habría forma de confirmarlo después y `total_qr` contaría dinero no recibido. El vuelto se calcula en el POS y no se
  guarda.
- `origen = 'online'` en esta fase.
- Lavandería exige `cliente_id` (RF-VEN-04); el resto de negocios admite cliente general.

### Anulación y devolución

- `anular_venta(id, motivo)`: exige `anular`, conexión y que la sesión de caja de la venta siga abierta. Pasadas 24 h
  exige además `devolver_fuera_plazo`: nada obliga a cerrar la caja cada día, y sin esto anular esquivaría RN-08.
  Contramovimientos `anulacion_venta`, series de vuelta a `disponible`. La venta queda con `estado = 'anulada'` y sale del
  esperado de caja. Con la caja ya cerrada, se usa devolución.
- `devolver_venta(p_devolucion jsonb)`: UUID del cliente, líneas y cantidades, motivo y sesión de caja abierta del equipo
  que devuelve. Dentro de 24 h exige `anular`; después, `devolver_fuera_plazo` (RN-08, DB-14). No devuelve más de lo
  vendido menos lo ya devuelto. Movimientos `devolucion_cliente` con el costo de la venta; series de vuelta. El dinero
  sale por la caja de la sesión que devuelve. Devolver una venta anulada da `ERP_VENTA_ANULADA`.
- Requiere `devolucion_items` además de `devoluciones`.
- **Hecho en el PR 2, tras revisión:**
  - `anular_venta` con devoluciones previas da `ERP_VENTA_CON_DEVOLUCIONES`: se sigue devolviendo el resto.
  - Monto por acumulado: `round(neto * (devuelta + cantidad) / vendida, 2) - ya devuelto`, sobre `total_linea -
    descuento_venta`. Nunca pasa de lo cobrado y la última fracción cierra exacta.
  - Una devolución puede salir por dos medios. `medio` en el payload es el preferido; el servidor reparte según lo cobrado
    y aún no devuelto por cada medio, y guarda `monto` y `monto_efectivo`. Una venta QR pedida en efectivo sale íntegra
    por QR: así no se saca efectivo del cajón con una venta QR sin cobrar. Devuelve ambos montos, que el POS muestra al
    cajero.
  - La serie devuelta vuelve a la ubicación del equipo que devuelve.

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
  esperado puede quedar negativo. `cerrar_caja` devuelve además `total_qr`: QR de ventas completadas de la sesión menos QR
  devuelto en ella. Puede ser negativo si se devuelve una venta de otra sesión.

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

### Hecho en el PR 3, tras revisión

- Una venta enviada sin respuesta queda "en duda": no se borra hasta un resultado cierto. Antes de descartarla o de
  aceptar un rechazo, el POS consulta si el UUID ya existe. Con la sesión caducada o con otra cuenta en el navegador
  no envía, ni comprueba, ni descarta: la RLS ocultaría una venta ya guardada.
- Un re-chequeo de sesión en segundo plano no cambia de negocio ni desmonta la venta; solo el usuario cambia de
  negocio, con confirmación si hay carrito y nunca con venta pendiente.
- Numeración: el siguiente número es el mayor entre el contador en memoria y el de `localStorage`, para que otra pestaña
  del mismo equipo no lo atasque. Pasado `999999` el equipo avisa que agotó la numeración.
- Ante `ERP_SIN_PERMISO`, `ERP_DESCUENTO_TOPE` o `ERP_PRODUCTO_SIN_PRECIO` el POS recarga catálogo, negocio y permisos.
  Una línea sin precio vuelve a `contado`; un producto que salió del catálogo se quita con aviso.
- `ERP_CAJA_CERRADA` muestra la apertura sobre la venta, sin perder el carrito.
- Un servicio fuera de lavandería se ve en la consulta pero no se vende.
- Tras vender, el stock local se descuenta; el catálogo completo se recarga solo si pasaron más de 5 minutos.
- La nota de 80 mm imprime en papel de 80 × 297 mm: CSS no admite alto automático en `@page`.
- `usuarios/servidor.ts` aloja lo de servidor que usan páginas fuera del panel; `/pos` no lo puede importar (ESLint).

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
