# Capacitación

Guía para la sesión con el personal antes del paralelo (`docs/paralelo.md`). Una sesión por rol, con el equipo real y el
lector de códigos. Los textos entre comillas son los que aparecen en pantalla.

Antes de empezar: cada persona tiene su cuenta (panel, "Usuarios"), cada caja está registrada (panel, "Dispositivos") y
el tope de descuento está fijado (panel, "Descuento"; con 0 % nadie descuenta). Si el dueño ya cargó el NIT y los "Datos
para la nota" en "Datos del negocio" (panel), las notas de la práctica salen como saldrán en el paralelo.

## Quién ve qué

| Rol | Entra a | Puede |
|---|---|---|
| Dueño | Panel y punto de venta | Todo. En tienda y frial, es el único que gestiona usuarios, dispositivos, descuento y "Datos del negocio". Solo él crea o cambia a un encargado y le restablece la contraseña (también en lavandería) |
| Encargado | Panel y punto de venta | Todo menos usuarios, dispositivos, descuento y "Datos del negocio" en tienda y frial. En lavandería gestiona usuarios, pero no a otros encargados. Cancela reservas y anula |
| Contador | Panel | Ver productos, inventario, ventas, cajas, reconciliación, créditos y reportes, con costos. No vende ni edita; en "Reconciliación" sí confirma QR y marca ventas revisadas |
| Vendedor y empleado | Solo punto de venta | Vender, abrir y cerrar su caja. No anulan ni devuelven: lo hace el encargado. En tienda y frial, también crear y completar reservas (no cancelarlas) y cobrar cuotas. En lavandería, también descontar y mover órdenes |

Permisos de la fase 7 (crédito, reservas, compras e insumos):

| Función | Quién | Negocio |
|---|---|---|
| Vender a crédito, cargar saldos iniciales y cambiar parámetros del crédito | Dueño y encargado | Tienda y frial |
| Cobrar cuotas | Quien puede usar la caja: dueño, encargado y vendedor | Tienda y frial |
| Ver créditos en el panel ("Créditos") | Dueño, encargado y contador | Tienda y frial |
| Reservas con anticipo (crear y completar) | Dueño, encargado y vendedor | Tienda y frial |
| Cancelar una reserva | Dueño y encargado (exige también el permiso de anular) | Tienda y frial |
| Proveedores, compras y pagos a proveedor | Dueño y encargado | Los tres |
| Consumo de insumos | Dueño y encargado. El empleado de lavandería no lo registra (supuesto, a confirmar con el cliente) | Lavandería |
| Reporte "Insumos" | Quien ve reportes y costos: dueño, encargado y contador | Lavandería |

La lavandería no tiene crédito ni reservas.

Una persona puede tener un rol distinto en cada negocio y cambia de negocio con el selector "Negocio activo".

## Vendedor: punto de venta

**Entrar.** Abrir la app instalada (o la dirección web), "Correo", "Contraseña", "Ingresar". Si hay varios equipos,
elegir el propio en "¿En qué equipo estás?": el equipo fija la ubicación, la numeración de notas y la caja.
La contraseña se cambia con "Cambiar contraseña", junto a "Cerrar sesión"; si se olvida, la restablece quien gestiona
usuarios (el dueño, si quien la olvidó es un encargado).

**Actualizar la app.** Cuando sale "Actualización disponible", en cada equipo con el punto de venta instalado hay que
pulsar "Actualizar ahora" una vez, a mano. Después se actualiza sola al abrirla, si nadie tocó la pantalla y no hay nada
pendiente. Con operaciones sin enviar o rechazadas, el botón queda apagado hasta que se resuelvan.

**Abrir caja.** Contar el efectivo del cajón, escribirlo en "Efectivo inicial (Bs)" y "Abrir caja". Sin caja abierta se
puede armar el carrito pero no cobrar.

**Vender.**
1. Escanear el código con el lector, o escribir código, nombre o marca y Enter. Atajo "/" vuelve a la búsqueda. La
   búsqueda no distingue tildes. Si el código coincide con más de un producto no agrega ninguno: sale "Ese código
   coincide con N productos: elige uno."
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
"Sobrante" o "Faltante". No cierra si hay operaciones sin enviar, una apertura de caja rechazada o cobros sin confirmar
en el equipo: primero volver a tener red y resolverlos. Una venta rechazada no impide cerrar: la caja avisa "Hay N
operaciones rechazadas sin resolver" (con el monto de las ventas) y que el esperado no las cuenta; también avisa de las
"de cajas anteriores".

**Si algo sale rechazado.** El aviso "N operaciones rechazadas al enviar" tiene "Reintentar". Para descartar, avisar al
encargado: el cliente ya pagó y descartar no se deshace. Al cerrar la caja con una venta rechazada, el vendedor cierra
igual y avisa al encargado; este la reintenta o la descarta. El efectivo de esa venta aparece como diferencia del
cierre.

**Cobro sin confirmar.** Los cobros que necesitan conexión (una reserva, una cuota o una venta a crédito) no pasan
por la cola. Si se recarga la página a mitad de uno de esos cobros, queda un aviso fijo "Cobro sin confirmar:
C1-000005, Bs …" con el botón "Verificar cobro". Pulsarlo consulta el estado sin volver a enviar la venta. Mientras
haya un cobro sin confirmar no se cierra la caja.

## Reservas y crédito (tienda y frial)

Todo esto necesita conexión y no se guarda para enviar después. Con el modo "Sin conexión" aparece el aviso y no se opera.

**Reservas** (botón "Reservas" de la barra; lo ven dueño, encargado y vendedor).
1. Llenar el formulario "Nueva reserva": cliente (obligatorio), "Producto" (un solo producto, sin número de serie),
   "Cantidad", "Precio acordado (Bs)" y "Anticipo (Bs)".
2. "Anticipo recibido por": "Efectivo" o "QR". Con QR, marcar "Confirmo que recibí el anticipo por QR en mi cuenta" solo
   después de verlo en el celular. Hace falta caja abierta.
3. "Reservar y cobrar anticipo". El stock queda apartado: baja el disponible y no se reserva más de lo que hay en el equipo.
4. El precio acordado no puede bajar del precio mínimo sin permiso de descuento.
5. En la lista de reservas activas: "Completar venta" carga el producto en el carrito (no se pueden agregar más; el
   anticipo se descuenta del total) y se cobra el saldo. Solo se completa en la ubicación donde se reservó. "Cancelar"
   lo hace un encargado (o el dueño): libera el stock y (por ahora, a confirmar con el cliente) devuelve el anticipo
   por el mismo medio, desde la caja abierta de quien cancela. Al vendedor le sale "Para cancelar la reserva, pide a un
   encargado."

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
2. Pestaña "Órdenes" (necesita red): buscar por número de boleta o por cliente (el cliente se busca con las tildes
   escritas igual) y avanzar el estado: "Pasar a En lavado", "Pasar a
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
| Conteo físico | "Inventario", "Conteo": contar, revisar diferencias contra "Sistema: N (M reservadas)", "Confirmar conteo" |
| Historial de un producto | "Inventario", entrar al producto (kardex, solo lectura, "Descargar Excel") |
| Anular o devolver una venta | "Ventas", entrar a la venta. Anular solo con la caja abierta y sin devoluciones; pasadas 24 h hace falta el permiso de devolución fuera de plazo. No aplica a ventas de reserva ni a crédito |
| Revisar ventas sin conexión y QR | "Reconciliación": "QR cobrado", "QR no llegó", "Marcar revisada". Debajo, el stock negativo |
| Arqueos | "Cajas" |
| Reportes | "Reportes": fechas, "Aplicar", "Descargar Excel". Costos y ganancia solo con permiso de costos |
| Personal | "Usuarios": "Cuenta nueva" o "Agregar persona de otro negocio"; cambiar rol, "Desactivar", "Quitar", "Restablecer contraseña" por fila. A un encargado solo lo gestiona el dueño. Restablecer no cierra las sesiones abiertas |
| Datos del negocio | "Datos del negocio" (dueño en tienda y frial): "NIT" y "Datos para la nota" (dirección, teléfono). Salen en la nota |
| Cambiar la propia contraseña | "Cambiar contraseña" en la cabecera del panel o junto a "Cerrar sesión" en el punto de venta |
| Equipos de caja | "Dispositivos": nombre, prefijo (ej. C2) y ubicación |
| Tope de descuento | "Descuento" |
| Proveedores | "Proveedores": "Nuevo proveedor", editar, y "Registrar pago a …" (medio y "Monto en Bs"; no puede superar la deuda). El pago no pasa por la caja del POS: si sale del cajón, anotar además un gasto en la caja |
| Compra de mercadería | "Compras", "Nueva compra": "Proveedor", "Ubicación de entrada", "Condición" ("Al contado (se paga ahora)" o "A crédito (queda deuda)"), "Registrar compra". Sube el inventario y recalcula el costo. En el frial cada línea pide lote y vencimiento; fuera del frial van vacíos. "Anular compra" (con motivo) la deshace si no tiene pagos vivos ni series y el stock alcanza; si no, un ajuste de inventario. El último pago a un proveedor se corrige con "Anular pago" |
| Créditos (tienda y frial) | "Créditos": "Cuotas vencidas", "Saldo por cliente" y detalle de cada crédito. "Cargar saldo inicial" (cliente, capital, "Cuotas restantes", "Primera cuota vence"; sin interés; "Anular saldo inicial" solo si no tiene pagos). El último pago de una cuota se corrige con "Anular pago" (motivo; si el cobro fue en efectivo, con caja abierta). Los "Documentos entregados" se marcan o desmarcan después, desde el crédito, y el plan se reimprime con "Imprimir plan". "Parámetros del crédito": inicial mínima, "Cuotas por defecto", "Máximo de cuotas" e interés |
| Consumo de insumos (lavandería) | "Inventario", "Consumo" (abre "Salida o ajuste" con el tipo elegido), "Insumo", cantidad y motivo, "Registrar". Un consumo mal cargado se corrige con "Revertir" desde el historial del producto |
| Gasto en insumos (lavandería) | "Reportes", reporte "Insumos": exige poder ver reportes y costos |

Al crear una cuenta o restablecer una contraseña, la contraseña nueva no se vuelve a mostrar: entregarla en persona.

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
- [ ] (Encargado) anular una venta, devolver otra, revisar "Reconciliación"
- [ ] (Encargado) entrada, traslado y un reporte en Excel
- [ ] Recargar la página a mitad del cobro de una reserva o de una cuota y resolver el aviso "Cobro sin confirmar"
      con "Verificar cobro"
- [ ] Con una venta rechazada (si la práctica produce una), ver qué avisa al cerrar la caja y que el encargado la
      reintenta o la descarta
- [ ] Cambiar la propia contraseña con "Cambiar contraseña" y volver a entrar
- [ ] (Dueño) restablecer la contraseña de un encargado
- [ ] (Encargado) subir una foto a un producto
- [ ] Movimiento de caja y cierre con arqueo, al final de todo

**Orden de la práctica.** Anular exige que la caja de esa venta siga abierta; con la caja cerrada solo queda devolver.
Por eso el encargado anula las ventas comunes de práctica, con motivo "Capacitación", **antes** de que cada uno cierre
su caja. Las de reserva y crédito no se anulan: quedan hasta la limpieza de pruebas (`docs/despliegue.md`, "Limpieza de
pruebas antes del paralelo"). Después de cerrar, ya no hay vuelta atrás con "Anular".

**Series.** Con un producto que ya tenía números de serie antes de la capacitación, no trasladarlo ni darlo de baja,
ajustarlo o consumirlo durante la práctica: la limpieza no puede reconstruir esas series y se aborta
(`docs/despliegue.md`). Se puede vender, pero no mover.

**Equipos.** Antes de la limpieza, cada equipo con la caja cerrada y sin avisos de operaciones sin enviar.

## Pendiente antes de la sesión

- Entregar a cada persona el PDF del manual de su rol (`docs/manual/`; el encargado y el dueño reciben también el del vendedor y, en lavandería, el de lavandería; se genera con `scripts/manual/exportar.sh`).
- Probar en los equipos reales del cliente con su lector y su impresora.
