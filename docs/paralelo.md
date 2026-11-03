# Operación en paralelo

Criterio de salida de la Entrega A (`docs/plan-pruebas.md`): 3 días de operación en paralelo con el cuaderno, sin
diferencias sin explicar. Hasta el fin del paralelo **el cuaderno sigue siendo el registro oficial**
(`docs/migracion-datos.md`, plan de vuelta atrás).

## Antes del día 1

- [ ] Carga real en producción conciliada: 597 productos, stock por ubicación y fotos (`docs/migracion-datos.md`)
- [ ] Precios cargados por el cliente en el panel; "Productos" con el filtro "Sin precio" vacío o explicado
- [ ] Usuarios, equipos ("Dispositivos") y tope de descuento listos
- [ ] Capacitación hecha (`docs/capacitacion.md`)
- [ ] Equipos reales probados: app instalada, lector de códigos, impresión de ticket y A4
- [ ] Backup diario en verde al menos una vez (`docs/backup.md`)
- [ ] Conteo físico de arranque si el cliente lo hace (P-17); si no, el stock importado es el punto de partida

## Cada día

Cada venta se anota en el cuaderno **y** se registra en el sistema, en el momento. Lo mismo con entradas de mercadería,
gastos y retiros de caja, y en lavandería, cada orden.

Al cierre, el encargado y el CTO comparan, por negocio:

| Control | Sistema | Cuaderno |
|---|---|---|
| Cantidad de ventas (u órdenes) | "Reportes", "Ventas" (o "Ingresos"), Hoy | Líneas del día |
| Total vendido en Bs | Mismo reporte | Suma del día |
| Efectivo | "Cajas": "Esperado" y "Contado" de cada sesión | Arqueo del cuaderno |
| QR | "Cajas": "QR (cobrado menos devuelto)" | Lo recibido en la cuenta |
| Anulaciones y devoluciones | "Ventas", filtro "Anulada"; detalle de cada devolución | Tachados o notas |
| Stock de 10 productos al azar | "Inventario" por ubicación | Conteo físico en el momento |
| Ventas sin conexión y QR por revisar | "Reconciliación" vacío al final del día | — |

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
  nunca editando: el kardex no se edita.
- **Error del sistema:** se anota con el número de venta, la hora y la pantalla, y se abre como bug. Cuenta como
  observación por escrito (cláusula sexta).

Una diferencia sin causa invalida el día. Hay que repetirlo.

## Al terminar

- 3 días seguidos con todas las diferencias explicadas: se deja el cuaderno y se pasa al acta (`docs/acta-entrega.md`).
- Si hubo errores del sistema, se corrigen y se repite al menos un día después del arreglo.
- Las planillas firmadas de los 3 días se adjuntan al acta.
