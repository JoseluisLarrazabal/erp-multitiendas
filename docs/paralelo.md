# Operación en paralelo

Criterio de salida de la Entrega A (`docs/plan-pruebas.md`): 3 días de operación en paralelo con el cuaderno, sin
diferencias sin explicar. Hasta el fin del paralelo **el cuaderno sigue siendo el registro oficial**
(`docs/migracion-datos.md`, plan de vuelta atrás).

## Antes del día 1

- [ ] Carga real en producción conciliada: 597 productos, stock por ubicación y fotos (`docs/migracion-datos.md`)
- [ ] Precios cargados por el cliente en el panel; "Productos" con el filtro "Sin precio" vacío o explicado
- [ ] Usuarios, equipos ("Dispositivos") y tope de descuento listos
- [ ] Equipos reales probados: app instalada, lector de códigos, impresión de ticket y A4
- [ ] Conteo físico de arranque si el cliente lo hace (P-17); si no, el stock importado es el punto de partida
- [ ] Capacitación hecha (`docs/capacitacion.md`); las ventas de práctica se anulan antes de cerrar la caja
- [ ] Backup en verde justo antes de limpiar: dos corridas `base` por día y el `completo` del domingo
      (`docs/backup.md`)
- [ ] Limpieza de pruebas, primero en seco (con los conteos revisados) y después aplicada
      (`docs/despliegue.md`, "Limpieza de pruebas antes del paralelo"; `docs/plan-limpieza-pruebas.md`)
- [ ] En cada equipo, borrar el contador local de numeración (`docs/despliegue.md`, "Qué hacer en cada equipo")
- [ ] El dueño carga el NIT y los "Datos para la nota" en "Datos del negocio", en los tres negocios
- [ ] En cada equipo con el punto de venta instalado, "Actualizar ahora" una vez: la primera actualización es a mano
- [ ] Comprobar que la primera venta real de cada equipo sea `<prefijo>-000001`

**Estado al 2026-11-11.** Todas las cargas del cliente siguen siendo requisito del día en que arranque el paralelo:
precios (sin precio un producto no se vende: `ERP_PRODUCTO_SIN_PRECIO`), NIT y datos para la nota, catálogo del frial,
precios de lavandería, tope de descuento, conteo y usuarios del personal. El cliente las hace cuando quiera y se las
pasa al CTO; el CTO dijo el 2026-11-11 que no bloquean el trabajo actual. La fecha de inicio del paralelo no está
fijada (la decide el CTO). El contrato se firmó el 2026-11-01 (D-04). El repositorio ya es público y el CTO aceptó el
2026-11-11 que el backup cifrado siga en los artifacts de Actions, así que eso ya no frena el paralelo (decisión en
`docs/handoff.md`). Siguen abiertas: rotar credenciales y la cláusula decimotercera (confidencialidad).

**A vigilar durante el paralelo.** El 2026-11-12 una pantalla del panel ("Cajas") se quedó en "Cargando…" 30 segundos,
una sola vez y sin causa confirmada (`docs/qa-roles-produccion.md`). Desde el PR #120 una lectura colgada corta a los
15 segundos y muestra un error. Si alguien del cliente lo ve, anotar la hora y la pantalla: con la hora se busca en
`errores_app` y en los registros de Vercel.

## Cada día

Cada venta se anota en el cuaderno **y** se registra en el sistema, en el momento. Lo mismo con entradas de mercadería,
gastos y retiros de caja, y en lavandería, cada orden.

Al cierre, el encargado y el CTO comparan, por negocio:

| Control | Sistema | Cuaderno |
|---|---|---|
| Cantidad de ventas (u órdenes) | "Reportes", "Ventas" (o "Ingresos"), Hoy | Líneas del día |
| Total vendido en Bs | Mismo reporte | Suma del día |
| Efectivo | "Cajas": "Esperado" y "Contado" de cada sesión | Arqueo del cuaderno |
| Anticipos de reservas y cuotas de crédito en efectivo (tienda y frial) | "Cajas": "Anticipos de reservas en efectivo" y "Cuotas de crédito en efectivo" de cada sesión | Lo cobrado aparte de las ventas |
| QR | "Cajas": "QR (cobrado menos devuelto)" | Lo recibido en la cuenta |
| Anulaciones y devoluciones | "Ventas", filtro "Anulada"; detalle de cada devolución | Tachados o notas |
| Stock de 10 productos al azar | "Inventario" por ubicación | Conteo físico en el momento |
| Compras y deuda con proveedores | "Compras" del día y "Proveedores" (deuda de cada uno) | Facturas y pagos a proveedores |
| Consumo de insumos (lavandería) | Kardex del insumo; reporte "Insumos" | Anotación de insumos usados |
| Ventas rechazadas y ventas tardías | Aviso "operaciones rechazadas" en el POS; "Cajas" cerradas con "Esperado con lo que llegó después" | — |
| Ventas sin conexión y QR por revisar | "Reconciliación" vacío al final del día | — |

"Ventas" cuenta lo vendido: una venta a crédito entra entera el día de la venta; las cuotas, el interés y los
anticipos de reservas no entran ahí sino en "Cajas", que cuenta lo cobrado. Por eso el efectivo del cuaderno se compara
con "Cajas" y el total vendido, con "Ventas". Cada reporte trae escrito su criterio.

Registro de cada día (una fila por negocio):

| Día | Negocio | Ventas S/C | Total S/C | Efectivo dif. | QR dif. | Stock dif. | Diferencias y explicación | Firma encargado |
|---|---|---|---|---|---|---|---|---|
| 1 | | / | / | | | | | |
| 2 | | / | / | | | | | |
| 3 | | / | / | | | | | |

S/C: sistema / cuaderno.

## Qué es una diferencia explicada

Una diferencia tiene causa identificada y anotada:
- **Error de anotación:** se corrige en el lado equivocado. En el sistema, por anulación, devolución o ajuste con motivo,
  nunca editando: el kardex no se edita. Las ventas a crédito y las que completan una reserva no se anulan ni se
  devuelven; sí se revierten el pago de una cuota, una compra y un pago a proveedor (con el permiso de anular y un motivo).
- **Error del sistema:** se anota con el número de venta, la hora y la pantalla, y se abre como bug. Cuenta como
  observación por escrito (cláusula sexta).

Una diferencia sin causa invalida el día. Hay que repetirlo.

## Al terminar

- 3 días seguidos con todas las diferencias explicadas: se deja el cuaderno y se pasa al acta (`docs/acta-entrega.md`).
- Si hubo errores del sistema, se corrigen y se repite al menos un día después del arreglo.
- Las planillas firmadas de los 3 días se adjuntan al acta.
