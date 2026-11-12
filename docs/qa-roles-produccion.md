# QA de roles en producción (2026-11-11 y 2026-11-12)

Qué puede y qué no puede tocar un vendedor y un encargado en los tres negocios, comprobado en producción
(<https://erpmultitiendas.vercel.app>). Lo pidió el CTO el 2026-11-11. Es el punto "QA con roles en producción" de la
fase 2 de `docs/plan-paralelo-rediseno.md`. Tuvo dos pasadas: el 2026-11-11 en **solo lectura** y el 2026-11-12 con
**escrituras de práctica** aprobadas por el CTO ese día (sección "Segunda pasada").

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
| Vendedor, los tres | No lee `errores_app` (403); no lee costos (`stock`, `venta_items.costo_unitario`, `movimientos_inventario.costo_unitario`: 403); `costos_stock`, `reporte_ventas` y `reporte_stock` responden `ERP_SIN_PERMISO` | Cumple |
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

## No comprobado

Queda cubierto solo por las pruebas locales (pgTAP y Playwright). Lo de venta se puede completar en minutos cuando
exista un producto con precio (reactivando las cuentas de prueba):

- Venta de práctica, y que el servidor rechace una anulación, una devolución o un descuento enviados por un vendedor.
  Anular y devolver están en el panel (`/panel/ventas/[id]`), al que el vendedor no entra; el rechazo del servidor no
  se probó porque exige una venta real.
- Los controles de la venta con una línea en el carrito (textos de descuento y tope).
- La anulación hecha por un encargado y la revisión de caja.
- El formulario "Agregar persona de otro negocio" visto como encargado de lavandería (no apareció: no había personas
  por agregar).
- Reservas, órdenes y cambio de estado.
- Costos con datos reales: producción tiene 0 ventas.
- Roles contador y empleado: no se crearon cuentas de prueba para ellos.
- La red de seguridad del script: no hizo falta, las tres cajas cerraron por la interfaz.

## Observaciones de separación de funciones (no son defectos; a decidir por el CTO)

- El encargado concentra vender, anular, ajustar inventario, comprar y revertir sus propias compras, y ve costos. Es
  lo habitual en un negocio chico con un encargado por local; el control que queda es la revisión del dueño
  (reconciliación, reportes y el registro de cambios).
- En lavandería el vendedor da descuento hasta el tope y el encargado gestiona al personal. Es lo que pide la matriz
  del SRS.
- El vendedor abre y cierra su caja solo. Escribe lo contado sin ver el esperado, y al cerrar la pantalla le muestra
  el esperado y la diferencia (visto el 2026-11-12; la versión anterior de este documento decía que no los veía). La
  revisión la hace el encargado.

## Qué quedó en producción

- **Cuentas de prueba: desactivadas el 2026-11-12** desde "Usuarios" con la sesión del dueño. Comprobado: las dos
  figuran con "Reactivar" y ninguna puede iniciar sesión. Se reactivan con ese botón; las claves siguen en
  `~/.cache/erp-recupera/qa-roles/cuentas.json`.
- Tres sesiones de caja cerradas, una por negocio, abiertas y cerradas por "QA Vendedor (prueba)" con Bs 0 (primera
  apertura `2026-11-12T12:46:56Z`, último cierre `2026-11-12T12:47:51Z`; 08:46 a 08:47 hora de Bolivia).
- Un cliente en Multitienda Lider: "QA Cliente (prueba)", CI "0000000".
- 0 ventas, 0 créditos; `dispositivos.ultimo_numero` sigue en 0 en C1, L1 y F1. Los intentos rechazados no dejaron
  filas.

**Efecto sobre la limpieza previa al paralelo** (`docs/despliegue.md`): con `--desde` anterior o igual a
`2026-11-12T08:46:00-04:00` se borran las tres cajas y el cliente. Con un `--desde` posterior a las 08:48 de ese día
quedan (cajas en cero y un cliente de práctica; no alteran la numeración). Un `--desde` entre las 08:46 y las 08:48
de ese día hace abortar el script (caja abierta antes del corte y cerrada después).
