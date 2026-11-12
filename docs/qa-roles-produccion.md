# QA de roles en producción (2026-11-11 y 2026-11-12)

Qué puede y qué no puede tocar un vendedor y un encargado en los tres negocios, comprobado en producción
(<https://erpmultitiendas.vercel.app>). Lo pidió el CTO el 2026-11-11. Es el punto "QA con roles en producción" de la
fase 2 de `docs/plan-paralelo-rediseno.md`. Tuvo tres pasadas: el 2026-11-11 en **solo lectura**; el 2026-11-12 con
**escrituras de práctica** aprobadas por el CTO ese día (sección "Segunda pasada"); y, el mismo 2026-11-12, con una
**venta de práctica** y el recorrido de **contador y empleado** (sección "Tercera pasada").

## Cómo se hizo

- Dos cuentas de prueba creadas por Claude desde "Usuarios" con la sesión del dueño: "QA Vendedor (prueba)" y
  "QA Encargado (prueba)", con el mismo rol en Multitienda Lider, Lider Clean y Frial Lider. Son las únicas escrituras
  de este QA. Las claves están en `~/.cache/erp-recupera/qa-roles/cuentas.json` (permisos 600, fuera del repo).
- Un script de Playwright con un navegador aislado por cuenta (`~/.cache/erp-recupera/qa-roles/qa.mjs` y `qa2.mjs`):
  3 negocios × 28 rutas × 2 cuentas, más lecturas directas a la API con el token de cada cuenta. Solo navegación,
  lectura y funciones de lectura. No se abrió caja, no se vendió, no se pulsó ningún botón que guarde.
- Salida: `resultado.json`, `resultado-extra.json` y seis capturas en esa misma carpeta.

## Criterio (lo esperado)

Matriz de `docs/srs.md` sección 4 más la separación de funciones habitual en comercio:

- **Vendedor:** solo punto de venta (vender, caja, reservas en tienda y frial, órdenes en lavandería). Sin panel, sin
  costos ni ganancia, sin crédito, sin anular ni devolver, sin reportes, sin configuración. Descuento solo en lavandería.
- **Encargado:** opera el panel (ventas, clientes, productos, inventario, precios, compras, cajas, créditos, tipo de
  cambio, reportes). Sin "Usuarios", "Dispositivos", "Descuento" ni "Datos del negocio", salvo en lavandería, donde sí
  los tiene pero no gestiona al dueño ni a otros encargados.

## Resultado

**Sin desvíos en lo observado.**

| Rol y negocio | Comprobado | Resultado |
|---|---|---|
| Vendedor, los tres | Entra directo a `/pos`; las 28 rutas del panel lo devuelven a `/pos` | Cumple |
| Vendedor, los tres | Permisos leídos con su sesión: tienda y frial `caja`, `gestionar_reservas`, `vender`; lavandería `caja`, `cambiar_estado_orden`, `descontar`, `vender` | Cumple |
| Vendedor, los tres | No lee `errores_app` (403); no lee costos (`stock.costo_promedio`, `venta_items.costo_unitario`, `movimientos_inventario.costo_unitario`: 403); `costos_stock`, `reporte_ventas` y `reporte_stock` responden `ERP_SIN_PERMISO`. Sí lee la cantidad en `stock` (el punto de venta se la muestra): corregido el 2026-11-12, antes este documento daba `stock` entero como bloqueado | Cumple |
| Encargado, tienda y frial | Abre las 12 áreas del panel; "Usuarios", "Dispositivos", "Descuento" y "Datos del negocio" no están en el menú y por dirección directa vuelven a `/panel` | Cumple |
| Encargado, lavandería | Abre además "Usuarios", "Dispositivos", "Descuento", "Datos del negocio" y "Órdenes"; no ve "Créditos" | Cumple |
| Encargado, lavandería | En "Usuarios", las filas del dueño y del encargado no tienen acciones; los selectores de rol ofrecen solo Contador, Vendedor y Empleado | Cumple |
| Encargado, los tres | No lee `errores_app` (403) | Cumple |

- **Anular, vendedor:** la matriz inicial (`20261101120100_rol_permisos_matriz.sql`) se lo daba; la migración
  `20261108130000_auditoria_entrega_a.sql` se lo quitó a vendedor y empleado. En producción no lo tiene. Coincide con
  lo dicho al cliente: el vendedor no anula.
- **`errores_app` no es legible desde la web:** confirmado en producción para estas dos cuentas (era un pendiente del
  PR #103).
- El vendedor no recibe un mensaje de "acceso negado" en el panel: se lo devuelve al punto de venta sin aviso
  (`web/src/modules/usuarios/contexto.ts`).

## Segunda pasada: escrituras de práctica (2026-11-12)

Aprobada por el CTO el 2026-11-12 ("apruebo las escrituras de práctica en producción"). Alcance pedido: abrir caja,
venta de práctica, intentos prohibidos, anular, cerrar caja y desactivar las cuentas de prueba.

**La venta de práctica no se pudo hacer, y con ella quedaron fuera la anulación, la devolución y el descuento.**
Reconocimiento previo en solo lectura (`recon.mjs`): ningún producto tiene precio (0 filas en `producto_precios` en los
tres negocios; el servidor rechazaría con `ERP_PRODUCTO_SIN_PRECIO`), lavandería y frial no tienen productos, no hay
clientes ni tipo de cambio y el tope de descuento es 0 %. No se puso un precio ni se creó un producto de prueba: eso
queda en el catálogo del cliente y la limpieza previa al paralelo no lo borra.

Cómo se hizo: script `~/.cache/erp-recupera/qa-roles/escrituras.mjs`, revisado antes de correr, con modo seco, una
compuerta que comprueba el negocio activo antes de cada escritura y una red de seguridad que cierra por API cualquier
caja abierta por la cuenta de prueba. Dos corridas previas no escribieron nada: las cortó la propia compuerta por un
selector mal especificado. Resultados en `resultado-escrituras.tienda.json`, `resultado-escrituras.lavfrial.json` y
`resultado-escrituras.run1.json` (control de roles); capturas en `capturas-escrituras/`.

| Rol y negocio | Comprobado | Resultado |
|---|---|---|
| Vendedor, los tres | Abre la caja de "Caja 1" con Bs 0 y la cierra con Bs 0 por la interfaz | Cumple |
| Vendedor, tienda | Con la caja abierta: pestañas Vender, Consulta rápida, Reservas, Cuotas y Caja. No existe "Vender a crédito" (tampoco con un cliente elegido) ni campo de descuento. Nada de anular, devolver, costo ni ganancia en pantalla | Cumple |
| Vendedor, lavandería | "Nueva orden" y "Órdenes"; Vender, Consulta rápida y Caja. Sin Reservas ni Cuotas, sin crédito ni descuento | Cumple |
| Vendedor, frial | Igual que tienda | Cumple |
| Vendedor, tienda | Crea un cliente desde el punto de venta ("QA Cliente (prueba)") | Cumple |
| Vendedor, tienda | Venta a crédito enviada directo al servidor (`registrar_venta`, caja abierta, cliente real): `400 ERP_SIN_PERMISO`. Después: 0 ventas, 0 créditos, numeración en 0 | Cumple |
| Encargado, tienda y frial | `asignar_usuario` sobre otra persona: `400 ERP_SIN_PERMISO` | Cumple |
| Encargado, lavandería | `asignar_usuario` sobre el dueño: `400 ERP_DUENO_PROTEGIDO` | Cumple |
| Encargado, lavandería | Subir un vendedor a encargado: `400 ERP_DUENO_PROTEGIDO` | Cumple |
| Encargado | Desactivar una cuenta que también está en negocios donde no gestiona personal (`admin-usuarios`): `403 ERP_SIN_PERMISO` | Cumple |

Los intentos del encargado usaron valores que, de pasar, no cambiaban nada (el rol actual) o solo tocaban la cuenta de
prueba. Tras cada uno se releyeron los roles con las dos cuentas: sin cambios.

Otras cosas vistas:

- Sin precio, cada resultado de la búsqueda dice "Sin precio de contado" y no ofrece "Agregar"; "Cobrar" queda apagado.
  En lavandería y frial el punto de venta avisa "Este negocio todavía no tiene productos con precio. Pide al encargado
  que los cargue en el panel."
- Al cerrar, el vendedor **sí ve** el efectivo esperado y la diferencia en "Caja cerrada" (después de escribir lo
  contado, no antes).
- **Defecto menor de pantalla (sin arreglar):** tras cerrar la caja, en los tres negocios, la tarjeta "Abrir caja"
  aparece arriba de la barra del equipo al mismo tiempo que el resultado "Caja cerrada" abajo
  (`capturas-escrituras/tienda-5-cierre.png`). Confunde: invita a abrir otra vez antes de leer el cierre.
- Una cuenta desactivada que intenta entrar recibe "Correo o contraseña incorrectos.", el mismo mensaje que una clave
  equivocada.

## Tercera pasada: venta de práctica, contador y empleado (2026-11-12)

Aprobada por el CTO el 2026-11-12 ("añade precio a un solo producto, para que puedas validar lo que faltó probar,
luego pruebas los roles"). Solo en Multitienda Lider. El encargado de prueba puso por "Precios" un precio de contado de
Bs 9.999,00 a un único producto (código 28) y lo quitó al terminar vaciando la celda: el catálogo vuelve a tener 0
precios. Scripts `venta.mjs` y `venta2.mjs`, resultados `resultado-venta.json` y `resultado-venta2.json`, capturas en
`capturas-venta/` y `capturas-venta2/`, todo en `~/.cache/erp-recupera/qa-roles/`.

**Incidente de la primera corrida.** La venta `C1-000001` se cobró bien, pero el script falló justo después por un
error introducido en su última corrección, que se autorizó sin revisar el diff. Quedaron sin correr la anulación y la
segunda venta; la venta quedó completada con su caja ya cerrada. Se resolvió en una segunda corrida, revisada antes de
ejecutar, con una devolución total hecha por el encargado. No fue un defecto del sistema.

| Rol | Comprobado | Resultado |
|---|---|---|
| Encargado | Pone y quita un precio desde "Precios" | Cumple |
| Vendedor | Venta en efectivo por la pantalla (`C1-000001` y `C1-000002`), con su nota | Cumple |
| Vendedor | Con una línea en el carrito: sin campo de descuento, sin "Vender a crédito", con el texto "Sin permiso de descuento: para bajar precios o descontar, pide a un encargado que venda desde su sesión" | Cumple |
| Vendedor | Venta con descuento enviada directo al servidor: `400 ERP_SIN_PERMISO` | Cumple |
| Vendedor | `anular_venta` y `devolver_venta` sobre una venta real: `400 ERP_SIN_PERMISO` las dos | Cumple |
| Vendedor | Abrir `/panel/ventas/<id>`: vuelve a `/pos` | Cumple |
| Vendedor | Con datos reales: lee las líneas de su venta sin costo; `costo_unitario` 403; reportes `ERP_SIN_PERMISO` | Cumple |
| Encargado | Venta con descuento sobre el tope (0 %): `400 ERP_DESCUENTO_TOPE` | Cumple |
| Encargado | Venta con la caja ya cerrada: el panel no ofrece anular ("La caja de esta venta ya se cerró: no se puede anular. Usa una devolución.") y sí devolver. Devolución total en efectivo por la pantalla, con otra caja abierta | Cumple |
| Encargado | Venta con la caja abierta: anulación por la pantalla con motivo | Cumple |
| Encargado | En el detalle de la venta no ve costo ni ganancia | Cumple |
| Vendedor | Cierre de caja cuadrado en las dos corridas (esperado igual a contado) | Cumple |
| Empleado, los tres | Mismos permisos que el vendedor; entra directo a `/pos`; las 28 rutas del panel lo devuelven a `/pos`; reportes y costos `ERP_SIN_PERMISO` o 403 | Cumple |
| Contador, los tres | Permisos `ver_costos` y `ver_reportes`. Entra a `/panel`; abre Ventas, Reconciliación, Productos, Inventario, Cajas, Reportes y Créditos (Órdenes en lavandería); el resto vuelve a `/panel` | Cumple |
| Contador, tienda | Con datos reales: ve ventas, detalle, reportes, cajas y reconciliación. Ningún formulario ni botón que guarde; en el detalle de venta no se le ofrece anular ni devolver. Las rutas de escritura vuelven a `/panel` | Cumple |
| Contador | `/pos` le dice "Tu rol no puede vender en este negocio" | Cumple |
| Los cuatro roles | Ninguno lee `errores_app` (403) | Cumple |

Contador y empleado se probaron cambiando el rol de las dos cuentas de prueba con la sesión del dueño (seis cambios, uno
por cuenta y negocio) y devolviéndolas después a vendedor y encargado. Ese recorrido fue de solo lectura.

Stock y kardex del producto usado: 4 al empezar y 4 al terminar; cuatro movimientos (venta, devolución, venta,
anulación), neto 0.

Otras cosas vistas:

- **Arreglo del cierre de caja confirmado en producción** (PR #115): tras cerrar ya no aparece "Abrir caja" junto al
  resultado (`capturas-venta2/paso9-cierre.png`).
- "Cajas" del panel se quedó en "Cargando…" 30 segundos una vez, con la cuenta del encargado, justo después de cerrar
  una caja. En la corrida siguiente cargó en menos de un segundo, sin errores de consola ni de red. No se reprodujo y
  no se conoce la causa.
- El contador abre `/panel/creditos` en lavandería escribiendo la dirección (el menú no lo muestra). Es de solo
  lectura y está vacío: lavandería no tiene créditos.
- La revisión de caja ("Marcar revisado") está en "Reconciliación" y solo aparece para cajas con movimientos hechos
  sin conexión. Las cajas de práctica no los tuvieron, así que no se probó.

## No comprobado

Queda cubierto solo por las pruebas locales (pgTAP y Playwright):

- Descuento permitido (un tope mayor que 0 %), venta a crédito hecha por quien sí puede, reservas, órdenes de
  lavandería y cambio de estado.
- Lavandería y frial con ventas: no tienen productos.
- La revisión de caja y todo lo que nace sin conexión.
- Costo y ganancia con valores: ningún producto tiene costo cargado; el reporte del contador avisa "1 línea sin costo
  cargado: la ganancia está incompleta".
- Lo que ve el empleado con la caja abierta, y que el servidor rechace escrituras de contador y empleado (su recorrido
  fue de solo lectura; comparten matriz con lo ya probado para el vendedor, salvo el contador).
- El formulario "Agregar persona de otro negocio" visto como encargado de lavandería.
- La red de seguridad de los scripts: no hizo falta en ninguna corrida.

## Observaciones de separación de funciones (no son defectos; a decidir por el CTO)

- El encargado concentra vender, anular, ajustar inventario, comprar y revertir sus propias compras, y ve costos. Es
  lo habitual en un negocio chico con un encargado por local; el control que queda es la revisión del dueño
  (reconciliación, reportes y el registro de cambios).
- En lavandería el vendedor da descuento hasta el tope y el encargado gestiona al personal. Es lo que pide la matriz
  del SRS.
- El vendedor abre y cierra su caja solo. Escribe lo contado sin ver el esperado, y al cerrar la pantalla le muestra
  el esperado y la diferencia (visto el 2026-11-12; la versión anterior de este documento decía que no los veía). La
  revisión la hace el encargado.
- Vendedor y empleado leen por la API, con su propia sesión, las ventas, devoluciones y cajas cerradas de todo el
  negocio (con esperado, contado y diferencia), no solo las suyas: el filtro es por negocio, no por persona. La
  pantalla no se lo muestra. Es lo habitual en un local chico; se anota por si el dueño quiere que cada cajero vea solo
  lo suyo.

## Qué quedó en producción

- **Cuentas de prueba: desactivadas** (2026-11-12, comprobado: figuran con "Reactivar" y ninguna inicia sesión), con
  sus roles originales (vendedor y encargado en los tres negocios). Se reactivan con ese botón; las claves siguen en
  `~/.cache/erp-recupera/qa-roles/cuentas.json`.
- Multitienda Lider: dos ventas de práctica de Bs 9.999 (`C1-000001` completada con devolución total, `C1-000002`
  anulada), una devolución, tres cajas cerradas sin diferencia, cuatro movimientos de kardex con neto 0 y el cliente
  "QA Cliente (prueba)". `dispositivos.ultimo_numero` de C1 quedó en **2**.
- Lider Clean y Frial Lider: una caja cerrada en cero cada uno; numeración en 0.
- 0 precios, 0 créditos. Los intentos rechazados no dejaron filas.
- En el registro de cambios (`auditoria`), que la limpieza no borra: el precio puesto y quitado dos veces y los
  cambios de rol de las cuentas de prueba.
- Horas de las escrituras (hora de Bolivia, 2026-11-12): 08:46 a 08:48, 09:36 a 09:38 y 13:51 a 13:53.

**Efecto sobre la limpieza previa al paralelo** (`docs/despliegue.md`): hay que correrla con un `--desde` anterior o
igual a `2026-11-12T08:46:00-04:00` (y posterior a la importación del 2026-11-04). Si no se hace, la primera venta real
de Multitienda Lider sale como `C1-000003` y las ventas de práctica quedan en los reportes. Un `--desde` entre las
08:46 y las 13:53 de ese día puede hacer abortar el script (caja o venta anterior al corte y cerrada, devuelta o
anulada después). La limpieza no se corrió, ni en seco.
