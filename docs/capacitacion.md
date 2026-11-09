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
| Contador | Panel | Ver productos, inventario, ventas, cajas, reconciliación, créditos y reportes, con costos. No vende ni edita; en "Reconciliación" sí confirma QR y marca ventas revisadas |
| Vendedor y empleado | Solo punto de venta | Vender, abrir y cerrar su caja. No anulan ni devuelven: lo hace el encargado. En tienda y frial, también reservas y cobrar cuotas. En lavandería, también descontar y mover órdenes |

Permisos de la fase 7 (crédito, reservas, compras e insumos):

| Función | Quién | Negocio |
|---|---|---|
| Vender a crédito, cargar saldos iniciales y cambiar parámetros del crédito | Dueño y encargado | Tienda y frial |
| Cobrar cuotas | Quien puede usar la caja: dueño, encargado y vendedor | Tienda y frial |
| Ver créditos en el panel ("Créditos") | Dueño, encargado y contador | Tienda y frial |
| Reservas con anticipo | Dueño, encargado y vendedor | Tienda y frial |
| Proveedores, compras y pagos a proveedor | Dueño y encargado | Los tres |
| Consumo de insumos | Dueño y encargado. El empleado de lavandería no lo registra (supuesto, a confirmar con el cliente) | Lavandería |
| Reporte "Insumos" | Quien ve reportes y costos: dueño, encargado y contador | Lavandería |

La lavandería no tiene crédito ni reservas.

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

**Sin internet.** Se sigue vendiendo: la barra dice "Sin conexión. Catálogo de hace …. Lo registrado se enviará al volver la red. Cerrar sesión necesita conexión." (con la hora real del catálogo) y la nota "guardada en este equipo. Se enviará al
volver la conexión". El QR queda "pendiente de verificar". Abrir caja y los movimientos de caja también se hacen sin red.
Sin red no se puede: cerrar caja, cerrar sesión, cambiar de equipo o de negocio, buscar o crear clientes, vender productos
con serie, anular o devolver, crear reservas, vender a crédito, cobrar cuotas, ni ver órdenes de lavandería.

**Movimientos de caja.** Botón "Caja": "Ingreso", "Gasto" o "Retiro", con monto y motivo.

**Cerrar caja.** "Caja", contar el efectivo, "Efectivo contado (Bs)", "Cerrar caja" y confirmar. Sale "Sin diferencia",
"Sobrante" o "Faltante". No cierra si hay operaciones sin enviar: primero volver a tener red.

**Si algo sale rechazado.** El aviso "N operaciones rechazadas al enviar" tiene "Reintentar". Para descartar, avisar al
encargado: el cliente ya pagó y descartar no se deshace.

## Reservas y crédito (tienda y frial)

Todo esto necesita conexión y no se guarda para enviar después. Con el modo "Sin conexión" aparece el aviso y no se opera.

**Reservas** (botón "Reservas" de la barra; lo ven dueño, encargado y vendedor).
1. Llenar el formulario "Nueva reserva": cliente (obligatorio), "Producto" (un solo producto, sin número de serie),
   "Cantidad", "Precio acordado (Bs)" y "Anticipo (Bs)".
2. "Anticipo recibido por": "Efectivo" o "QR". Con QR, marcar "Confirmo que recibí el anticipo por QR en mi cuenta" solo
   después de verlo en el celular. Hace falta caja abierta.
3. "Reservar y cobrar anticipo". El stock queda apartado: baja el disponible y no se reserva más de lo que hay en el equipo.
4. El precio acordado no puede bajar del precio mínimo sin permiso de descuento.
5. En la lista de reservas activas: "Completar venta" carga el producto en el carrito (no se pueden agregar más; el anticipo se
   descuenta del total) y se cobra el saldo. Solo se completa en la ubicación donde se reservó. "Cancelar" libera el stock y
   (por ahora, a confirmar con el cliente) devuelve el anticipo por el mismo medio, desde la caja abierta de quien cancela.

**Venta a crédito** (la hace el dueño o el encargado, desde su sesión).
1. Armar el carrito y elegir un cliente: es obligatorio. La lista de precios es `credito`; vale el mismo piso de precio y
   el mismo tope de descuento que al contado.
2. Marcar "Vender a crédito" e indicar "Inicial (Bs)" (hay un mínimo: la pantalla lo muestra) y "Cuotas".
3. Marcar los "Documentos recibidos": "Cédula de identidad", "Comprobante de domicilio" y "Pagaré firmado". Son casillas,
   no se suben archivos.
4. Revisar el "Plan de cuotas" en pantalla y cobrar la inicial ("Cobrar", "Cobrar la inicial del crédito", "Confirmar cobro"). Las cuotas vencen
   una por mes y llevan interés. Desde la nota, "Plan de cuotas" abre el plan para imprimir en A4.

**Cobrar una cuota** (botón "Cuotas" de la barra; lo ve quien puede usar la caja). Buscar al cliente, ver sus "Créditos
con saldo", "Cobrar cuota", escribir el monto (efectivo, QR o mixto). Acepta pago parcial y cubre primero la cuota más vieja.
No se cobra más que el saldo. Hace falta caja abierta. No hay recibo impreso: el saldo en pantalla es el comprobante.

**Regla:** una venta que completó una reserva o que se hizo a crédito no se anula ni se devuelve desde el sistema. Antes de
cobrar, confirmar con el cliente.

## Lavandería: órdenes

1. Pestaña "Nueva orden": agregar los servicios, elegir el cliente, completar "Datos de la orden" ("Express", "Prendas",
   "Casillero", "Fecha prometida", "Nota") y cobrar igual que una venta. Sale una "BOLETA".
2. Pestaña "Órdenes" (necesita red): buscar por número o cliente y avanzar el estado: "Pasar a En lavado", "Pasar a
   Lista", "Entregar". Se puede volver un paso atrás.
3. "Entregar": anotar "Quién retira", "Con boleta" o "Con carnet" (con el documento).
4. "Anular" solo aparece con el permiso de anular (encargado y dueño; el empleado no lo ve) y pide motivo. Si la caja de la orden sigue abierta, devuelve el efectivo.

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
| Anular o devolver una venta | "Ventas", entrar a la venta. Anular solo con la caja abierta y sin devoluciones; pasadas 24 h hace falta el permiso de devolución fuera de plazo. No aplica a ventas de reserva ni a crédito |
| Revisar ventas sin conexión y QR | "Reconciliación": "QR cobrado", "QR no llegó", "Marcar revisada". Debajo, el stock negativo |
| Arqueos | "Cajas" |
| Reportes | "Reportes": fechas, "Aplicar", "Descargar Excel". Costos y ganancia solo con permiso de costos |
| Personal | "Usuarios": "Cuenta nueva" o "Agregar persona de otro negocio"; cambiar rol, "Desactivar", "Quitar" |
| Equipos de caja | "Dispositivos": nombre, prefijo (ej. C2) y ubicación |
| Tope de descuento | "Descuento" |
| Proveedores | "Proveedores": "Nuevo proveedor", editar, y "Registrar pago a …" (medio y "Monto en Bs"; no puede superar la deuda). El pago no pasa por la caja del POS: si sale del cajón, anotar además un gasto en la caja |
| Compra de mercadería | "Compras", "Nueva compra": "Proveedor", "Ubicación de entrada", "Condición" ("Al contado (se paga ahora)" o "A crédito (queda deuda)"), "Registrar compra". Sube el inventario y recalcula el costo. Una compra no se anula: un error se corrige con un ajuste de inventario ("Salida o ajuste") |
| Créditos (tienda y frial) | "Créditos": "Cuotas vencidas", "Saldo por cliente" y detalle de cada crédito. "Cargar saldo inicial" (cliente, capital, "Cuotas restantes", "Primera cuota vence"; sin interés; "Anular saldo inicial" solo si no tiene pagos). "Parámetros del crédito": inicial mínima, "Cuotas por defecto", "Máximo de cuotas" e interés |
| Consumo de insumos (lavandería) | "Inventario", "Consumo" (abre "Salida o ajuste" con el tipo elegido), "Insumo", cantidad y motivo, "Registrar". Un consumo mal cargado se corrige con "Revertir" desde el historial del producto |
| Gasto en insumos (lavandería) | "Reportes", reporte "Insumos": exige poder ver reportes y costos |

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
- [ ] (Tienda y frial) reserva con anticipo y completarla
- [ ] (Encargado, tienda y frial) venta a crédito con plan de cuotas
- [ ] (Tienda y frial) cobro de una cuota
- [ ] (Encargado) compra al contado, compra a crédito y pago a proveedor
- [ ] (Encargado, lavandería) consumo de un insumo
- [ ] Movimiento de caja y cierre con arqueo
- [ ] (Encargado) anular una venta, devolver otra, revisar "Reconciliación"
- [ ] (Encargado) entrada, traslado y un reporte en Excel

El encargado anula las ventas comunes de práctica al terminar, con motivo "Capacitación". Las de reserva y crédito no se
anulan: quedan hasta la limpieza de pruebas (`docs/despliegue.md`, "Limpieza de pruebas antes del paralelo").

## Pendiente antes de la sesión

- Entregar a cada persona el PDF del manual de su rol (`docs/manual/`; el encargado y el dueño reciben también el del vendedor y, en lavandería, el de lavandería; se genera con `scripts/manual/exportar.sh`).
- Probar en los equipos reales del cliente con su lector y su impresora.
