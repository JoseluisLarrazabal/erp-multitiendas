# Capacitación

Guía para la sesión con el personal antes del paralelo (`docs/paralelo.md`). Una sesión por rol, con el equipo real y el
lector de códigos. Los textos entre comillas son los que aparecen en pantalla.

Antes de empezar: cada persona tiene su cuenta (panel, "Usuarios"), cada caja está registrada (panel, "Dispositivos") y
el tope de descuento está fijado (panel, "Descuento"; con 0 % nadie descuenta).

## Quién ve qué

| Rol | Entra a | Puede |
|---|---|---|
| Dueño | Panel y punto de venta | Todo. En tienda y frial, es el único que gestiona usuarios, dispositivos y descuento |
| Encargado | Panel y punto de venta | Todo menos usuarios, dispositivos y descuento en tienda y frial (en lavandería, también eso) |
| Contador | Panel | Ver productos, inventario, ventas, cajas, reconciliación y reportes, con costos. No vende ni edita |
| Vendedor y empleado | Solo punto de venta | Vender, abrir y cerrar su caja, anular dentro del plazo. En lavandería, también descontar y mover órdenes |

Una persona puede tener un rol distinto en cada negocio y cambia de negocio con el selector "Negocio activo".

## Vendedor: punto de venta

**Entrar.** Abrir la app instalada (o la dirección web), "Correo", "Contraseña", "Ingresar". Si hay varios equipos,
elegir el propio en "¿En qué equipo estás?": el equipo fija la ubicación, la numeración de notas y la caja.

**Abrir caja.** Contar el efectivo del cajón, escribirlo en "Efectivo inicial (Bs)" y "Abrir caja". Sin caja abierta se
puede armar el carrito pero no cobrar.

**Vender.**
1. Escanear el código con el lector, o escribir código, nombre o marca y Enter. Atajo "/" vuelve a la búsqueda.
2. En el carrito se corrige cantidad (en frial, "Kg" con hasta 3 decimales), precio y lista.
3. Cliente: "General" por defecto. "Elegir" para buscar o "Nuevo cliente". En lavandería es obligatorio.
4. "Cobrar" o F2. Efectivo: escribir lo recibido y ver el "Vuelto". QR: "Todo QR" y marcar "Confirmo que recibí Bs … por
   QR en mi cuenta" solo después de verlo en el celular. Mixto: escribir el monto QR; el efectivo se ajusta solo.
5. "Confirmar cobro", elegir "Ticket 80 mm" o "A4", "Imprimir", "Nueva venta".

**Descuentos.** Quien no tiene permiso ve "Sin permiso de descuento": el encargado vende desde su propia sesión. No hay
clave de autorización en pantalla.

**Stock en cero.** El sistema deja vender igual ("Stock aquí: 0" en rojo). La diferencia aparece en "Reconciliación" para
el encargado.

**Sin internet.** Se sigue vendiendo: la barra dice "Sin conexión" y la nota "guardada en este equipo. Se enviará al
volver la conexión". El QR queda "pendiente de verificar". Sin red no se puede: cerrar caja, cerrar sesión, cambiar de
equipo o de negocio, buscar o crear clientes, vender productos con serie, ni ver órdenes de lavandería.

**Movimientos de caja.** Botón "Caja": "Ingreso", "Gasto" o "Retiro", con monto y motivo.

**Cerrar caja.** "Caja", contar el efectivo, "Efectivo contado (Bs)", "Cerrar caja" y confirmar. Sale "Sin diferencia",
"Sobrante" o "Faltante". No cierra si hay operaciones sin enviar: primero volver a tener red.

**Si algo sale rechazado.** El aviso "operación(es) rechazada(s)" tiene "Reintentar". Para descartar, avisar al
encargado: el cliente ya pagó y descartar no se deshace.

## Lavandería: órdenes

1. Pestaña "Nueva orden": agregar los servicios, elegir el cliente, completar "Datos de la orden" ("Express", "Prendas",
   "Casillero", "Fecha prometida", "Nota") y cobrar igual que una venta. Sale una "BOLETA".
2. Pestaña "Órdenes" (necesita red): buscar por número o cliente y avanzar el estado: "Pasar a En lavado", "Pasar a
   Lista", "Entregar". Se puede volver un paso atrás.
3. "Entregar": anotar "Quién retira", "Con boleta" o "Con carnet" (con el documento).
4. "Anular" pide motivo. Si la caja de la orden sigue abierta, devuelve el efectivo.

## Encargado y dueño: panel

| Tarea | Dónde |
|---|---|
| Crear producto | "Productos", "Nuevo producto". Los precios van aparte |
| Cargar o cambiar precios | "Precios": grilla, "Guardar cambios". La moneda de la fila vale para todas sus listas |
| Dólar | "Tipo de cambio", "Registrar tipo de cambio". Rige el más reciente |
| Entrada de mercadería | "Inventario", "Entrada". En frial, lote y vencimiento |
| Daño, merma, garantía, ajuste | "Inventario", "Salida o ajuste". El motivo es obligatorio |
| Mover entre tienda y depósito | "Inventario", "Traslado" |
| Conteo físico | "Inventario", "Conteo": contar, revisar diferencias, "Confirmar conteo" |
| Historial de un producto | "Inventario", entrar al producto (kardex, solo lectura, "Descargar Excel") |
| Anular o devolver una venta | "Ventas", entrar a la venta. Anular solo con la caja abierta y sin devoluciones; pasadas 24 h hace falta el permiso de devolución fuera de plazo |
| Revisar ventas sin conexión y QR | "Reconciliación": "QR cobrado", "QR no llegó", "Marcar revisada". Debajo, el stock negativo |
| Arqueos | "Cajas" |
| Reportes | "Reportes": fechas, "Aplicar", "Descargar Excel". Costos y ganancia solo con permiso de costos |
| Personal | "Usuarios": "Cuenta nueva" o "Agregar persona de otro negocio"; cambiar rol, "Desactivar", "Quitar" |
| Equipos de caja | "Dispositivos": nombre, prefijo (ej. C2) y ubicación |
| Tope de descuento | "Descuento" |

Al crear una cuenta, la contraseña inicial no se vuelve a mostrar: entregarla en persona.

## Práctica

Cada persona hace, en su equipo, con productos reales:

- [ ] Abrir caja con el efectivo real
- [ ] Venta en efectivo escaneando con el lector
- [ ] Venta por QR y venta mixta
- [ ] Venta con cliente nuevo
- [ ] Venta con el wifi apagado y ver que se envía al volver
- [ ] (Frial) venta por peso con decimales
- [ ] (Lavandería) orden completa hasta "Entregar"
- [ ] Movimiento de caja y cierre con arqueo
- [ ] (Encargado) anular una venta, devolver otra, revisar "Reconciliación"
- [ ] (Encargado) entrada, traslado y un reporte en Excel

Las ventas de práctica se anulan al terminar, con motivo "Capacitación".

## Pendiente antes de la sesión

- El "Inicio" del panel todavía dice que no hay módulos activos: corregir antes de capacitar.
- Probar en los equipos reales del cliente con su lector y su impresora.
