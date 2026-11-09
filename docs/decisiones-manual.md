# Decisiones y reglas para el manual de usuario y la entrega

Registro de todo lo que el usuario final (dueño, encargado, contador, vendedor o empleado) o el cliente tiene que saber:
reglas del sistema, restricciones, límites, riesgos aceptados y supuestos sin confirmar. Lo pidió el CTO el 2026-11-09
para que el manual de usuario, la capacitación (`docs/capacitacion.md`) y el acta de entrega lo estipulen.

**Cómo se usa:**
- El manual de usuario y todo documento de entrega se escriben a partir de este registro. Cada regla _vigente_ tiene que
  aparecer en el manual del rol al que afecta. Cada _supuesto_ y cada _pendiente_ se confirma con el cliente o el CTO antes
  de la entrega, o se entrega escrito como supuesto.
- Cada PR que cambie una regla visible para el usuario actualiza este archivo en el mismo PR.
- Estados: _vigente_ · _supuesto pendiente de confirmar con el cliente_ · _pendiente de decisión CTO_ · _riesgo aceptado_ ·
  _no verificado_. La fuente va al final de cada ítem: `H` = `docs/handoff.md`, `SRS` = `docs/srs.md`, `PF-N` =
  `docs/plan-fase-N.md`, `AUD` = `docs/auditoria-entrega-a.md`, `CAP` = `docs/capacitacion.md`, `MIG` =
  `supabase/migrations/`. Los números de línea son del 2026-11-09 y pueden correrse; algunos planes se citan por sección.

Armado el 2026-11-09 a partir de esas fuentes, del encabezado de cada migración y de los mensajes de
`web/src/lib/erp-errores.ts`. No incluye `docs/relevamiento.md`, `docs/plan-pruebas.md`, `docs/roadmap.md` ni
`docs/plan-modelo-datos.md`: revisarlos al escribir el manual.

## 0. Contradicciones entre fuentes (2026-11-09)

| Tema | Qué decían las fuentes | Resolución |
|---|---|---|
| Vendedor y anulación | `CAP` decía que el vendedor anula dentro del plazo y que la práctica se anula con motivo "Capacitación" | Manda la migración `20261108130000`: el vendedor no anula ni devuelve. `CAP` corregido en este PR |
| Frecuencia de cuotas | RF-CRE-01 pide frecuencia parametrizada | Implementado solo mensual, con un interés por negocio (`PF-7` decisión 7). Anotado en `SRS` |
| Lotes del frial | `H` (2026-11-01) los dejaba fuera de la primera versión | Están implementados en la fase 5 (RF-FRI-04 a 07). `H` corregido |
| Inicio del panel | `CAP` decía que el Inicio no tenía módulos | Corregido en #63. `CAP` corregido; sigue sin cubrir crédito, reservas, compras ni insumos |
| Reporte de insumos | `H` nombraba solo `ver_costos` | Exige `ver_reportes` y `ver_costos`. `H` corregido |
| Consumo de insumos | `PF-7` decisión 10 nombra una RPC `registrar_consumo` | Es un tipo de ajuste de inventario (estado de `PF-7`) |
| Lavandería sin conexión | `H` y `PF-3` decían que la lavandería pide conexión | Superado: la fase 4 crea órdenes sin conexión (RF-LAV-09) |
| Firma del contrato | `SRS` D-04 lo da por firmado; `H` dice pendiente de firma | Sin resolver: confirmar con el CTO |

## 1. Roles y permisos

- **El vendedor y el empleado ya no anulan ni devuelven ventas, ni siquiera dentro de las 24 h.** Anular y devolver
  quedan en dueño y encargado (permiso `anular`). Si el mostrador necesita devolver, hay que crear un permiso `devolver`
  aparte. _Vigente (hay que avisar al cliente)_ · AUD:93-97; MIG 20261108130000 (M3); SRS:275 (P-11)
- **Matriz por rol, tienda y frial.** Dueño: todo. Encargado: todo menos gestionar usuarios. Contador: solo ve costos y
  reportes (no vende ni edita). Vendedor: vender, caja propia y reservas; descontar no. La matriz está en datos y se
  cambia sin tocar código. _Vigente_ · SRS:205-227; MIG 20261101120100
- **Lavandería.** El empleado vende, cobra, descuenta y mueve estados de órdenes. Dueño y encargado además gestionan
  usuarios. La lavandería no tiene crédito ni reservas. _Vigente_ · SRS:209-224; MIG 20261101120100
- **Quién ve los costos.** Solo dueño, encargado y contador (`ver_costos`). Costo, ganancia y valor del stock salen en
  blanco para el resto, también por la API. El vendedor no ve costos. _Vigente_ · SRS:208, RF-REP-05; PF-1 "Decisiones/Datos"; MIG 20261102140000
- **Un usuario puede tener rol distinto en cada negocio** y cambia con el botón "Negocio activo". Solo ve datos del
  negocio elegido. _Vigente_ · SRS:41, RF-TR-02/03
- **Descuentos y precio bajo el mínimo exigen permiso `descontar`** (dueño y encargado; en lavandería también el
  empleado). No existe clave de autorización de un encargado en el equipo del vendedor: el encargado vende desde su propia
  sesión. _Vigente (simplificación del CTO)_ · PF-2:77-79; H:167-170; CAP:36
- **Crear un crédito, saldo inicial o cambiar sus parámetros: solo dueño y encargado** (`gestionar_credito`). Cobrar una
  cuota lo puede hacer quien tenga `caja` (el vendedor). _Vigente_ · PF-7:40-42; MIG 20261108160000
- **Compras, proveedores y pagos a proveedor: solo dueño y encargado** (`gestionar_compras`), también en lavandería.
  _Vigente_ · PF-7:44; SRS:224
- **Reservas: dueño, encargado y vendedor** (más `caja`, porque el anticipo entra y sale del cajón). No existe en
  lavandería. _Vigente_ · PF-7:43; MIG 20261108150000
- **Consumo de insumos y su reversión: solo quien tiene `ajustar_inventario`** (dueño y encargado). El empleado de
  lavandería no puede registrar consumo. _Supuesto pendiente de confirmar con el cliente_ (si lo quiere el empleado, se
  cambia la matriz) · PF-7:45-46
- **Cualquier cuenta del negocio puede leer por la base los créditos y saldos de clientes**, igual que ventas y clientes
  (el POS los necesita). El permiso solo ordena los listados, no los hace secretos. Si se quiere deuda reservada hay que
  cambiar las políticas. _Riesgo aceptado / pendiente de decisión CTO_ · H:19-20; MIG 20261108160000
- **Las ventas, movimientos y devoluciones de caja también las puede leer todo miembro del negocio.** Por eso el arqueo
  ciego no es hermético en la base. _Riesgo aceptado_ · AUD:31, 53; MIG 20261108130000 (M4)
- **Ver el esperado y el desglose de una caja exige `ver_reportes`.** Sin él, `esperado` y sus términos vuelven en blanco;
  queda solo el monto inicial. _Vigente_ · AUD:31; MIG 20261108130000 (M4)
- **Reconciliación, "caja por revisar" y la anulación de ventas marcadas `caja_cerrada` exigen `ver_reportes`.** _Vigente_ ·
  PF-3:57, 131; AUD:29, 32
- **Reporte de insumos exige `ver_reportes` y `ver_costos` a la vez.** _Vigente_ · MIG 20261108140000:210; PF-7:119-120
  (el handoff solo nombra `ver_costos`: H:36)
- **Cuentas por cobrar:** lectura con `gestionar_credito` o `ver_reportes`; las cuentas de un cliente, también con `caja`
  (para cobrar en el POS). _Vigente_ · PF-7:102-103
- **El dueño de un negocio es protegido.** Solo un dueño asigna o modifica a otro dueño. No se puede dejar el negocio sin
  dueño activo (`ERP_ULTIMO_DUENO`) ni cambiar el propio rol ni quitarse a sí mismo. _Vigente_ · AUD:49;
  `web/src/modules/usuarios/domain.ts:124-128`

## 2. Cuentas, usuarios y equipos

- **El registro público está cerrado.** Las cuentas las crea quien tiene el permiso `usuarios` (tienda y frial: solo el
  dueño; lavandería: dueño y encargado). _Vigente_ · H:164-165; SRS:3.1 RF-TR-04
- **La contraseña inicial de una cuenta nueva no se vuelve a mostrar.** Se entrega en persona. Mínimo 8 caracteres con
  letras y dígitos. _Vigente_ · CAP:83; `web/src/modules/usuarios/domain.ts:132`
- **Desactivar una cuenta corta el acceso en la base al instante** (aunque el JWT dure 1 h). El POS sin conexión caduca
  a las 72 h sin hablar con el servidor. _Vigente_ · MIG 20261108130000 (cabecera); AUD:35, 57
- **Un usuario no puede quedarse sin negocio.** Quitar el último negocio de una cuenta se rechaza: hay que desactivarla.
  _Vigente_ · `web/src/modules/usuarios/domain.ts:128-129`
- **Cada caja es un "equipo" (dispositivo) con su prefijo** (`C1`, `L1`, `F1`), su ubicación y su numeración de notas.
  Lo registra quien tenga `usuarios`. Sin equipo elegido no se vende. Un prefijo no se repite en el negocio. _Vigente_ ·
  SRS RF-TR-08; PF-2:30-34; `web/src/modules/usuarios/domain.ts:130`
- **Cajas registradas en producción: una por negocio** (C1 en Multitienda Lider, L1 en Lider Clean, F1 en Frial Lider).
  _Vigente_ · H:250-253
- **Usuarios del personal: faltan correos y roles; se cargan al final** (los entrega el cliente). La cuenta de dueño
  actual es la del CTO; la del cliente se crea desde "Usuarios". Frial Lider está como nombre provisorio. _Pendiente (cliente/CTO)_ ·
  H:227-229, 313
- **Lavandería dice que nadie trabaja en más de un negocio, pero sus 3 personas están en Lider:** se asignan a ambos.
  _Supuesto pendiente de confirmar con el cliente_ · SRS:279 (P-15)
- **Los cambios de productos, precios, usuarios y permisos quedan auditados** (quién, cuándo, antes y después). Se lee
  con `ver_reportes`; la pantalla de auditoría no existe. _Vigente (sin pantalla)_ · SRS RF-TR-09; PF-1 "Auditoría"

## 3. Caja

- **Sin caja abierta se puede armar el carrito pero no cobrar.** Hay una sola sesión abierta por equipo. _Vigente_ ·
  CAP:25-26; SRS RF-CAJ-01
- **Abrir caja y registrar gastos, ingresos y retiros se puede sin conexión.** Entran a la cola y las ventas de esa caja
  van detrás de la apertura. _Vigente_ · PF-3:59-70; H:399-401
- **Gasto, ingreso o retiro: motivo y monto mayores a 0 obligatorios.** _Vigente_ · SRS RF-CAJ-02; PF-2:136
- **Un gasto o retiro mayor al efectivo esperado se rechaza** (`ERP_EFECTIVO_INSUFICIENTE`) cuando se hace en línea. Hecho
  sin conexión se acepta y queda marcado `efectivo_insuficiente`, porque la plata ya salió. _Vigente_ · PF-2:144-145;
  PF-3:65-66; MIG 20261108130000 (M5); `erp-errores.ts:14`
- **Efectivo esperado = efectivo inicial + ventas en efectivo + ingresos + anticipos de reserva y cuotas de crédito
  cobrados en efectivo − gastos − retiros − devoluciones en efectivo (y devoluciones de anticipo).** El QR se muestra
  aparte ("QR cobrado menos devuelto"). Una venta anulada sale del esperado. _Vigente_ · PF-2:137-139; PF-7:47-50;
  MIG 20261108150000, 20261108160000
- **La inicial de una venta a crédito entra a caja como cualquier venta; el anticipo aplicado al completar una reserva no
  se cuenta dos veces.** _Vigente_ · PF-7:65-66, 94-95
- **Arqueo ciego: el POS no muestra el esperado mientras la caja está abierta.** El cajero ve esperado, diferencia (sin
  diferencia / sobrante / faltante) y QR recién al cerrar. _Vigente_ · PF-2:186-187; CAP:48-49
- **Cerrar caja exige conexión y cola vacía en ese equipo** (sin ventas, aperturas ni movimientos sin enviar ni rechazados,
  tampoco si la cola no se puede leer). _Vigente_ · SRS RF-CAJ-03, RN-07; PF-3:67-68; H:392-393
- **Cerrar caja con una venta "en duda" (enviada sin respuesta) no está verificado.** _No verificado (solo Vitest)_ ·
  H:194-195
- **Cerrar una caja repetidas veces con el mismo contado devuelve el mismo resultado; con otro monto da error.** El
  cierre es inmutable. _Vigente_ · PF-2:142-143
- **Si otra persona cierra la caja de un equipo, las ventas hechas sin conexión en ese rango horario se aceptan** (marca
  `caja_cerrada`) si el cierre fue hace menos de 30 días; quien tenga `ver_reportes` puede anularlas, sin plazo de 24 h y sin
  mover efectivo. Fuera de ese rango se rechazan. _Vigente_ · AUD:29; MIG 20261108130000 (A2)
- **Caja sin conexión hecha por un miembro sin permiso `caja`, con hora de más de 30 días o sobre el efectivo disponible
  se acepta marcada** (`usuario_sin_permiso`, `fecha_fuera_de_rango`, `efectivo_insuficiente`) y se revisa en
  `/panel/reconciliacion`, "Caja por revisar". Un no miembro se rechaza. _Vigente_ · AUD:32; MIG 20261108130000 (M5)
- **Una caja por negocio, sin efecto cruzado entre negocios.** _Vigente_ · SRS RF-CAJ-04
- **Los pagos a proveedor no pasan por la caja del POS.** Si se paga con plata del cajón, el encargado registra además un
  "gasto" de caja. _Vigente (`shortcut`)_ · PF-7:49-53
- **Una venta QR devuelta no saca efectivo del cajón;** devolver una venta con QR rechazado solo devuelve lo realmente
  cobrado. Límite aceptado: devolver una venta con QR rechazado baja el QR neto de la sesión aunque esa plata no entró.
  _Vigente / riesgo aceptado_ · PF-2:126-129; H:386-388; `erp-errores`/domain-panel:83
- **El detalle de caja muestra las 200 ventas y 200 movimientos más recientes** ("Mostrando N de M"); los totales no se
  suman sobre la lista truncada. _Vigente_ · PF-2:191-192

## 4. Ventas, precios y descuentos (POS)

- **Se vende en Bs, en efectivo, QR o mixto.** El dólar solo fija precios; no se cobra en dólares. El vuelto se calcula en
  pantalla y no se guarda. _Vigente (P-03 supuesto)_ · SRS RN-01, RF-VEN-02; PF-2:104-107
- **Un producto sin precio en la lista elegida no se puede vender** (`ERP_PRODUCTO_SIN_PRECIO`). Hoy ningún producto de
  Lider tiene precio: no se puede vender ni capacitar hasta que el cliente los cargue. _Vigente / bloqueado por el cliente_ ·
  H:39-40, 303-304; `erp-errores.ts:15`
- **El tope de descuento de cada negocio arranca en 0 %: nadie descuenta hasta que se configure** (panel, "Descuento",
  solo con `usuarios`). Lo define el cliente. _Pendiente (cliente, D-03)_ · PF-2:70-71; H:254
- **Descuento: por línea y por venta, en Bs.** Se rechaza si supera el tope (`ERP_DESCUENTO_TOPE`), medido sobre el
  subtotal. _Vigente_ · PF-2:62-64; `erp-errores.ts:17`
- **Piso de precio = el menor entre el precio `mínimo` y el de la lista elegida.** Hasta el piso se negocia sin permiso;
  por debajo exige `descontar` y cuenta para el tope. El precio final siempre es mayor a 0 y el total de una venta mayor a 0.
  _Vigente_ · PF-2:65-69, 96
- **Lista por defecto: contado** (tienda y frial). El vendedor puede elegir otra lista por línea (crédito, mayorista,
  mínimo). En lavandería: normal o express. _Vigente_ · PF-2:60-61; PF-1 "Listas por tipo"
- **Cliente general en Lider y frial; en lavandería el cliente es obligatorio.** Sin conexión, la lavandería escribe
  nombre y teléfono a mano. _Vigente_ · SRS RF-VEN-04; PF-4 "Cliente sin conexión"
- **El sistema deja vender con stock en 0 o insuficiente** (se ve en rojo "Stock aquí: 0"); queda como stock negativo para
  revisar. _Vigente_ · SRS RN-04; CAP:39-40
- **Un servicio fuera de lavandería se ve en la consulta pero no se vende.** _Vigente_ · PF-2:179
- **Frial: cantidades en kg con hasta 3 decimales; el total redondea a 2.** Productos "por unidad": cantidad entera.
  _Vigente_ · SRS RF-FRI-01; PF-2:94
- **Un producto con número de serie vende una unidad identificada por línea** y exige elegir una serie disponible.
  _Vigente_ · SRS RN-10; PF-2:88-89
- **La venta guarda el tipo de cambio y el precio en Bs que vio el vendedor;** cambios posteriores no la alteran.
  _Vigente_ · SRS RN-02
- **QR en línea: el vendedor debe marcar "Confirmo que recibí Bs … por QR" solo tras verlo en su celular.** Sin eso la
  venta no se registra. _Vigente_ · PF-2:104-107; CAP:32-34
- **La nota de venta se imprime desde el navegador (Ticket 80 mm o A4) o se guarda como PDF.** Lleva negocio, NIT,
  dirección, teléfono, número, vendedor, cliente, líneas, garantía, descuentos y pagos. _Vigente_ · PF-2:160-165; SRS RF-VEN-05
- **Garantía en la nota de venta: parcial, sin confirmar con E2E.** _No verificado_ · AUD:66
- **Tras una venta el POS descuenta el stock local; el catálogo completo se recarga solo si pasaron más de 5 minutos.** Ante
  `ERP_SIN_PERMISO`, `ERP_DESCUENTO_TOPE` o `ERP_PRODUCTO_SIN_PRECIO` se recarga el catálogo. _Vigente_ · PF-2:176-180
- **Una venta enviada sin respuesta queda "en duda"; no se borra hasta un resultado cierto.** Con sesión caducada u otra
  cuenta no se envía, comprueba ni descarta. _Vigente_ · PF-2:169-172
- **La numeración de notas es `PREFIJO-000123` por equipo.** El tope es 999999; después el equipo avisa que agotó la
  numeración. _Vigente_ · SRS RF-VEN-11; PF-2:36-45, 174-175
- **La venta de un producto con serie, consulta de clientes y alta de clientes necesitan conexión.** Ver sección 6.
  _Vigente_ · PF-3:115-122
- **Cliente: CI o NIT único por negocio; un cliente de un negocio no aparece en otro; datos personales fuera de logs.**
  Duplicado: `ERP_CLIENTE_DUPLICADO` ("Búscalo y selecciónalo"). _Vigente_ · PF-2:153-158; `erp-errores.ts:19`
- **Sin integración con Impuestos Nacionales (SIN): no hay factura electrónica.** El comprobante es una nota de venta
  propia. _Vigente (decisión CTO)_ · H:509-511; SRS:25-29
- **Nota de 80 mm imprime en papel de 80 × 297 mm** (CSS no admite alto automático). _Vigente_ · PF-2:181

## 5. Anulación y devolución

- **Anular una venta exige conexión, permiso `anular` y que la caja de esa venta siga abierta.** Con la caja cerrada se
  usa devolución. Genera contramovimientos, conserva la venta ("anulada") y devuelve el stock. _Vigente_ · PF-2:113-116; SRS RF-VEN-06
- **Pasadas 24 h de la venta, anular o devolver exige además `devolver_fuera_plazo`** (dueño y encargado). _Vigente_ ·
  SRS RN-08; PF-2:113-120
- **No se puede anular una venta que ya tiene devoluciones;** se devuelve lo que falta. _Vigente_ · PF-2:123;
  `erp-errores.ts:21`
- **Una devolución puede ser parcial** (por línea y cantidad), nunca más de lo vendido menos lo ya devuelto; devuelve el
  dinero por la caja de la sesión abierta del equipo que devuelve, y el stock por kardex. _Vigente_ · PF-2:117-130
- **Una venta anulada no admite devolución.** _Vigente_ · `erp-errores.ts:20`
- **Una venta que completó una reserva no se anula ni se devuelve desde el sistema** (`ERP_VENTA_DE_RESERVA`). _Vigente
  (`shortcut`: el reverso se diseña si el cliente lo necesita)_ · PF-7:109-113
- **Una venta con crédito no se anula ni se devuelve** (`ERP_VENTA_CON_CREDITO`). _Vigente (`shortcut`)_ · H:34;
  PF-7:109-113
- **Una venta que es una orden de lavandería se anula desde la orden.** Una orden ya entregada no se anula: se registra
  una devolución. _Vigente_ · PF-4 "Anulación"; MIG 20261108130000; `erp-errores.ts:23`
- **Descartar una venta rechazada de la cola exige `devolver_fuera_plazo` y confirmación escrita:** el dinero ya se cobró y
  descartar no se deshace. El vendedor debe avisar al encargado. _Vigente_ · H:386-390; PF-3:97-98; CAP:51-52
- **Las ventas de práctica de la capacitación se "anulan con motivo Capacitación".** Contradice la regla de que el vendedor
  no anula; además el script de limpieza borra lo transaccional anterior al paralelo. _No verificado_ (ver contradicciones) ·
  CAP:100

## 6. POS sin conexión

- **Con internet cortado se sigue vendiendo.** La barra dice "Sin conexión, catálogo de hace N" y la nota queda "guardada
  en este equipo. Se enviará al volver la conexión". _Vigente_ · H:513-529; CAP:42-43; SRS RF-VEN-09
- **Es un extra fuera del contrato; el CTO lo absorbe sin costo y conviene mencionarlo en el acta.** _Vigente / pendiente de
  decisión CTO (D-01)_ · H:531-533; SRS:287
- **Sin conexión se puede:** vender (efectivo y QR pendiente), abrir caja, registrar movimientos de caja y, en lavandería,
  recibir órdenes nuevas. _Vigente_ · H:516; PF-3; PF-4
- **Sin conexión NO se puede:** cerrar caja, cerrar sesión, cambiar de equipo o de negocio, buscar o crear clientes, vender
  productos con número de serie, cambiar el estado de una orden ni ver la pestaña Órdenes, crear reservas, créditos ni
  cobrar cuotas, anular o devolver, y cambiar productos, precios, inventario o usuarios. _Vigente_ · SRS RF-VEN-14; CAP:43-44;
  PF-3:115-122; MIG reservas/credito (`ERP_REQUIERE_CONEXION`)
- **Productos con serie piden conexión (límite aceptado):** hay 0 series cargadas y P-01 sigue abierta. _Riesgo aceptado ·
  supuesto pendiente de confirmar con el cliente_ · PF-3:118-119; SRS:265
- **Reservas y crédito nunca se encolan:** se cobran en línea con reintento en memoria bajo el mismo id, y si no se confirma
  se ofrece "Descartar y verificar". Un reintento con modo sin conexión se rechaza con error claro. _Vigente_ · PF-7:80-81, 88,
  148-149; `use-envio.ts:45`
- **Cada venta entra primero a una cola guardada en el equipo (IndexedDB) y se envía desde ahí.** Se ve siempre el aviso
  "N ventas sin enviar". Si el navegador no puede guardar, no se cobra y el carrito queda. _Vigente_ · PF-3:75-80; SRS RF-VEN-10
- **Riesgo: si se borran los datos del navegador, se pierden las ventas sin enviar.** Se mitiga con el aviso visible y
  `storage.persist()`. Cerrar sesión borra el contexto, nunca la cola. _Riesgo aceptado_ · H:525-526; PF-3:85-86, 108
- **Antes de borrar datos del sitio o limpiar el equipo hay que dejar la cola vacía** (caja cerrada, sin aviso de pendientes).
  _Vigente_ · `docs/despliegue.md` "Limpieza"
- **La cola se envía sola al volver la red** (reintento con espera creciente de 5 s a 5 min; un envío no excede 8 s). Un
  error de red no rechaza la venta; un rechazo con código la deja "rechazada" para decidir a mano y no se borra sola.
  _Vigente_ · PF-3:80-84; AUD:34 (WEB-M1, corregido #82)
- **Sin conexión, el QR o la transferencia no se pueden verificar:** quedan "pendientes de verificar" y el encargado los
  confirma después. _Vigente_ · H:527-528; SRS RF-VEN-12
- **El stock puede quedar negativo; cada equipo solo ve sus propias ventas pendientes.** _Vigente_ · H:528-529; SRS RN-04
- **Sin conexión el servidor no recalcula precios:** una venta con precio bajo el piso, descuento sin permiso, sobre el
  tope, producto inactivo o sin precio se acepta y se marca para revisión (no se rechaza, porque la plata ya se cobró).
  _Vigente / riesgo aceptado_ · PF-3:33-57; AUD:28 (DB-A1)
- **Quien tenga `vender` podría llamar la API con modo offline para saltarse piso y tope;** queda marcado y el encargado lo
  ve, no pasa en silencio. Hay alerta "N ventas por revisar" en el Inicio del panel. _Riesgo aceptado_ · PF-3:54-55; AUD:28
- **El número de la nota puede cambiar al sincronizar** si choca (queda `renumerada`, se conserva el impreso). _Vigente_ ·
  PF-3:95-96
- **Si otra cuenta del mismo negocio envía la cola del vendedor anterior, sale igual** y se marca `otra_cuenta` (cambio de
  turno). Solo se envían filas de negocios de la cuenta activa. _Vigente_ · PF-3:109-111; AUD:37
- **El contexto offline caduca a las 72 h sin contacto con el servidor:** el equipo deja de vender hasta conectarse e iniciar
  sesión (las ventas pendientes no se pierden). _Vigente_ · AUD:35; `use-pos-sesion.ts:22,41`; `pos-sesion.tsx:47`
- **Sesión caducada al reconectar: la cola se pausa, pide iniciar sesión y conserva todo.** _Vigente_ · PF-3:112
- **Primer arranque sin red: sin catálogo guardado no se puede vender.** El equipo tiene que abrir caja con red al menos una
  vez. _Vigente (por diseño)_ · H:448-449
- **"Actualización disponible" solo se puede aplicar con la cola vacía;** si hay operaciones sin enviar dice que se podrá
  aplicar cuando se envíen. _Vigente_ · H:402; PF-3:124-127; `aviso-actualizacion.tsx:105`
- **Recomendación al cliente: un respaldo de internet 4G.** _Vigente (recomendación)_ · H:530
- **La reimpresión de notas pendientes, clientes sin conexión, series sin conexión y Background Sync están fuera de
  alcance.** Implicancia sobre cuándo se envía la cola con la app cerrada: _no verificado_ (inferencia). _Vigente_ · PF-3:149-151
- **Firefox, Safari, instalación PWA real, móvil táctil y red intermitente real no se probaron.** _No verificado_ · H:405-406,
  450; SRS RNF-15
- **Descartes y duplicados.** Reenvío de la misma venta no duplica (20 reenvíos en paralelo = 1 venta). _Vigente_ · H:444-446
- **Límite aceptado:** si fallan a la vez "quitar" y "marcar rechazada" tras un rechazo en línea, la fila queda pendiente y se
  reenvía. _Riesgo aceptado_ · H:393-394

## 7. Reconciliación y revisión (panel)

- **`/panel/reconciliacion` (con `ver_reportes`) lista las ventas hechas sin conexión con motivos legibles, los QR
  pendientes ("QR cobrado" / "QR no llegó"), "Marcar revisada", la sección "Caja por revisar" y el stock negativo por
  ubicación.** Muestra "Sin conexión, enviada por X". _Vigente_ · H:409-418; PF-3:129-136; AUD:32
- **Un QR confirmado en el mostrador (anticipo de reserva, cuota de crédito, venta en línea) no se puede marcar rechazado
  después;** solo el QR pendiente de una venta sin conexión tiene camino de rechazo. _Vigente / pendiente de decisión CTO_ ·
  H:28; PF-7:79, 106-107
- **El Inicio del panel avisa "N ventas por revisar"** a quien las revisa, con vendedor y motivo. _Vigente_ · AUD:28, 88
- **Una venta sin motivos y sin QR pendiente no entra a revisión.** _Vigente_ · PF-3:57

## 8. Catálogo, precios y dólar

- **El cliente carga sus precios en el panel** (grilla `/panel/precios`, 50 por página, guarda solo lo cambiado, filtro "sin
  precio"). La importación no trae precios ni costos. _Vigente (D-03)_ · H:485-486; PF-1 "Pantallas"; SRS RF-CAT-11
- **Listas de precio:** tienda y frial = contado, crédito, mayorista, mínimo; lavandería = normal, express. _Vigente_ · PF-1
  "Datos"
- **Un producto puede tener precio en USD o Bs, pero toda la ficha usa una sola moneda** (`ERP_MONEDA_MIXTA`). Con USD, el Bs
  = `round(monto × tipo de cambio, 2)`. Sin tipo de cambio o sin precio, el precio es "sin precio", nunca 0. _Vigente_ · PF-1
  "Datos"; SRS RF-CAT-05
- **Regla de redondeo de Bs al convertir desde USD: 2 decimales.** _Supuesto pendiente de confirmar con el cliente_ · SRS:272 (P-08)
- **Tipo de cambio: rige el más reciente; si varía más de 20 % la pantalla pide confirmación.** La base no lo limita. Registrar
  uno nuevo cambia los Bs de los productos en USD sin editarlos. _Vigente_ · SRS RF-CAT-06; AUD:33 (DB-M6); H:493
- **La tarjeta del dólar paralelo es solo referencia:** muestra la mediana de paralelo.bo con fuente y hora, dice
  "desactualizado" si pasaron más de 15 min y "sin datos" si falla. "Usar este valor" llena el campo del tipo de cambio pero
  no guarda. Nunca cambia el tipo de cambio vigente ni las ventas. _Vigente_ · SRS RF-CAT-12; `docs/plan-dolar-paralelo.md`
  "Diseño"
- **La fuente paralelo.bo no tiene SLA ni términos de uso (licencia CC-BY 4.0: hay que mostrar la fuente).** Es un extra fuera
  del contrato (suma a D-01). _Riesgo aceptado / pendiente de decisión CTO_ · `docs/plan-dolar-paralelo.md` "Fuente"; H:257
- **Producto con movimientos no se borra: se desactiva.** Una categoría no se puede borrar, solo renombrar. _Vigente_ · SRS
  RF-CAT-09; `categorias/page.tsx:23`
- **Un producto con movimientos no cambia de tipo ni de unidad ni se le quita el control de series** (`ERP_PRODUCTO_CON_MOVIMIENTOS`).
  Activar `controla_serie` con stock sin series se rechaza (`ERP_SERIE_CON_STOCK`). _Vigente_ · PF-2:102-103; AUD:47
- **Variantes (colores, etc.) son productos separados**, cada uno con su código y su stock. _Vigente_ · SRS RF-CAT-10
- **Código interno y código de barras no se repiten en un negocio.** Los 597 productos de Lider conservan los códigos "1" a
  "597" como código interno. _Vigente / supuesto pendiente de confirmar con el cliente_ · SRS RF-CAT-01; SRS:269 (P-05)
- **Qué productos llevan serie:** "todos" no coincide con vasos y platos; se marcan en el panel. La importación no activa series.
  _Supuesto pendiente de confirmar con el cliente_ · SRS:265 (P-01)
- **Fotos de producto: bucket privado, solo JPEG, PNG y WebP, hasta 5 MB.** Sin SVG. _Vigente_ · PF-1 "Fotos"
- **El peso de un paquete cambiado afecta los kilos de ventas pasadas del frial** (el reporte usa el peso actual). Un
  paquete distinto debería ser otro producto. _Riesgo aceptado_ · PF-5 "Paquete al vacío"
- **Filtro por marca y categoría (RF-CAT-02) y dólar paralelo (RF-CAT-12): sin E2E.** _No verificado_ · AUD:65-67

## 9. Inventario y kardex

- **El kardex no se edita ni se borra (append-only): un error se corrige con un contramovimiento.** _Vigente (regla no
  negociable)_ · SRS RN-05, RF-INV-02
- **El stock siempre coincide con la suma del kardex;** hay una consulta de inconsistencias. _Vigente_ · SRS RF-INV-08; PF-1
- **Costo promedio ponderado.** Una entrada con costo lo actualiza; la venta guarda una foto del costo para la ganancia. Un
  producto sin costo cargado no suma ganancia y se cuenta aparte. _Vigente_ · SRS RN-06; PF-5 "Reportes"
- **Salidas que no son venta (dañado, devolución al proveedor, cambio por garantía, ajuste, merma) exigen motivo y permiso
  `ajustar_inventario`.** _Vigente_ · SRS RF-INV-04
- **Traslado entre tienda y depósito:** el total no cambia; con stock insuficiente se permite y la pantalla avisa. _Vigente_ ·
  SRS RF-INV-05; PF-1 "Datos"
- **Conteo físico:** las diferencias se registran como ajustes. _Vigente_ · SRS RF-INV-06
- **Productos "por unidad" aceptan cantidad entera; los de kg, hasta 3 decimales.** _Vigente_ · PF-1; PF-2:94
- **Stock mínimo:** si es null no avisa; el aviso suma ubicaciones. Hoy no hay stock mínimo cargado. _Vigente / pendiente
  (cliente)_ · PF-1 "Datos"; `docs/migracion-datos.md` "Lo que debe hacer el cliente"
- **Cambiar el stock de un producto ya importado es un ajuste, no reimportar.** _Vigente_ · H:501-502
- **Conteo físico inicial (P-17):** se repite antes de arrancar; el stock importado es el punto de partida si no. _Supuesto
  pendiente de confirmar con el cliente_ · SRS:281; `docs/paralelo.md` "Antes del día 1"
- **Lider tiene tienda y depósito por separado; "Eterazama y Sacaba" se tratan como 1 depósito.** _Supuesto pendiente de
  confirmar con el cliente_ · SRS RF-INV-01; SRS:273 (P-09)
- **Costos de stock no visibles para el vendedor por columna;** se leen solo con `ver_costos`. _Vigente_ · PF-1 "Datos"
- **Series:** se cargan aparte de la entrada (los productos importados ya tienen stock); salida o traslado exigen elegir
  series en igual cantidad. _Vigente_ · PF-1 "Datos"

## 10. Reservas con anticipo (solo tienda y frial)

- **Las reservas se hacen en el POS, pestaña "Reservas", y exigen conexión** (no se crean, completan ni cancelan sin red).
  _Vigente_ · H:23-24; PF-7:61; `reservas-pos.tsx:67`
- **Una reserva aparta stock** (movimiento `reserva`, baja el stock disponible) y exige stock suficiente en el equipo
  (`ERP_STOCK_INSUFICIENTE`); no deja stock negativo. _Vigente_ · PF-7:73-75; `erp-errores.ts:24`
- **Una reserva lleva un solo producto.** Un producto con serie no se reserva. Ampliar si el cliente reserva varios.
  _Vigente (`shortcut`)_ · MIG 20261108150000 (cabecera); PF-7:61
- **El precio acordado de la reserva se valida como una línea de venta** (piso mínimo, permiso `descontar`, tope). La venta que
  la completa no re-valida el piso y no admite descuentos ni crédito. _Vigente_ · PF-7:73-74; MIG 20261108150000
- **El anticipo entra por caja, en efectivo o QR,** y se suma al arqueo. _Vigente_ · PF-7:48-49, 63; H:23-24
- **Completar una reserva = venta del POS que carga ese producto;** no se pueden agregar más productos ("Estás completando una
  reserva"). El anticipo se descuenta del total y el stock no se descuenta dos veces. _Vigente_ · PF-7:62-68; `use-venta.ts:209`
- **Cancelar una reserva libera el stock y devuelve el anticipo por caja** (mismo medio y monto, en la sesión abierta de quien
  cancela). Con efectivo insuficiente la cancelación se rechaza. _Supuesto pendiente de confirmar con el cliente_ (P-12) ·
  PF-7:69-71; SRS:276
- **Costo de la venta de una reserva = foto del costo del movimiento `reserva`.** Al cancelar, el stock reingresa con esa
  foto. _Vigente_ · H:26; PF-7:76-78
- **Una venta de reserva nunca se encola.** Se reintenta en memoria con el mismo id y, si no se confirma, se ofrece "Descartar y
  verificar". _Vigente_ · H:25; PF-7:80-81
- **El QR del anticipo se confirma en el mostrador y no se puede marcar como rechazado después.** _Pendiente de decisión CTO_
  · H:28; PF-7:79

## 11. Crédito y cuentas por cobrar (solo tienda y frial)

- **La venta a crédito se hace en el POS y exige conexión;** cliente obligatorio, lista de precios `credito`, y misma validación
  de piso, descuento y tope que contado. _Vigente_ · H:29-31; PF-7:82-89, 94-97
- **Parámetros por negocio (sin fila rigen los por defecto):** inicial mínima 50 %, 3 cuotas, interés 2,5 % mensual; máximo 12
  cuotas por defecto, configurable hasta 36. La inicial debe ser mayor a 0 y menor al total, y el mínimo se redondea al centavo hacia arriba
  (`ERP_INICIAL_INSUFICIENTE`). _Vigente_ · SRS RF-CRE-01; PF-7:92-97; `erp-errores.ts:30`
- **El interés se calcula sobre saldo con cuota fija (sistema francés).** La última cuota absorbe la diferencia de redondeo.
  Si el cliente dice que es sobre el total, cambia solo `plan_cuotas`. _Supuesto pendiente de confirmar con el cliente_ (P-07) ·
  PF-7:31-35; SRS:271; H:21
- **La frecuencia de las cuotas es solo mensual y hay un solo interés por negocio.** El SRS dice "frecuencia parametrizada":
  hoy no es así (ver contradicciones). _Vigente (`shortcut`)_ · MIG 20261108160000:13; PF-7:93
- **Las cuotas vencen la fecha de la venta más k meses (no encadenado), en hora de La Paz;** si el mes es más corto, el último
  día. _Vigente_ · PF-7:35-36, 101
- **El interés vive en las cuotas: no suma a `ventas.total` ni a los reportes de ventas.** _Vigente (`shortcut`, pendiente de
  decisión CTO si debe contabilizarse)_ · H:33; MIG 20261108160000:13
- **Documentos del crédito: 3 casillas (CI, comprobante de domicilio, pagaré), no archivos.** Subir escaneos queda para si
  el cliente lo pide. _Vigente (`shortcut`)_ · PF-7:86-87
- **Plan de cuotas imprimible** al crear el crédito. _Vigente_ · SRS RF-CRE-02; H:31-32
- **El pago de cuotas admite pago parcial, entra por caja (requiere caja abierta del equipo) y cubre las cuotas de la más
  vieja a la más nueva.** Pagar de más se rechaza (`ERP_PAGO_EXCEDE_SALDO`). "Pagada" y "vencida" se calculan, no se guardan. _Vigente_ ·
  PF-7:36-39, 98-99; `erp-errores.ts:31`
- **Cobrar cuotas y consultar saldos desde el POS necesita conexión.** El QR de una cuota se confirma en el mostrador, sin
  camino de rechazo. _Vigente_ · `creditos-pos.tsx:90`; PF-7:106-107
- **No hay recibo imprimible del cobro de cuota:** el comprobante es el saldo en pantalla. Agregar si el cliente lo pide.
  _Vigente (`shortcut`)_ · H:22; PF-7:106
- **Cuentas por cobrar** (`/panel/creditos`): saldo por cliente, cuotas vencidas con días de atraso, detalle, saldos iniciales y
  parámetros. _Vigente_ · H:31-32; SRS RF-CRE-05
- **Saldos iniciales: crédito sin venta ni caja, con capital, cuotas restantes y fecha de la primera cuota; se carga sin interés
  (el monto es lo que se adeuda). Se puede anular solo si no tiene pagos** (`ERP_CREDITO_CON_PAGOS`). _Vigente_ · H:21; PF-7:100,
  108-109; `creditos/domain.ts:83`
- **Cómo entrega el cliente los saldos de crédito:** carga manual de 1 a 20 créditos. _Supuesto pendiente de confirmar con
  el cliente_ · SRS:270 (P-06)
- **Una venta con crédito (o una reserva completada) no se anula ni se devuelve.** El dinero repartido entre cuotas no tiene
  reverso automático. _Vigente (`shortcut`)_ · PF-7:109-113
- **La lavandería no puede crear créditos** (no tiene `gestionar_credito`). _Vigente_ · PF-7:103
- **El crédito con cuotas, las cuentas por cobrar, las reservas y los proveedores no están en la cláusula tercera:** se
  recomendó cotizarlos aparte (cláusula décima). _Pendiente de decisión CTO (D-01)_ · H:135-136, 144-146

## 12. Compras y proveedores (tienda, frial y lavandería)

- **Proveedores por negocio** (alta, edición, consulta). No hay unicidad de nombre: se pueden duplicar. _Vigente (`shortcut`)_ ·
  MIG 20261108120000:12
- **Cada compra genera entradas de inventario y recalcula el costo promedio.** Un producto repetido en los ítems se rechaza. _Vigente_
  · SRS RF-COM-02; MIG 20261108120000
- **Deuda con un proveedor = suma de sus compras − suma de sus pagos.** Una compra al contado registra un pago por el total en
  la misma operación; una compra a crédito sube la deuda. _Vigente_ · PF-7:54-57; MIG 20261108120000
- **Un pago a proveedor no puede superar la deuda** (`ERP_PAGO_EXCEDE_DEUDA`); se valida contra la deuda total del proveedor, no
  de la compra puntual. _Vigente (`shortcut`)_ · MIG 20261108120000:11
- **Los pagos a proveedor son del panel (efectivo, QR o transferencia, sin sesión de caja) y no pasan por la caja del POS.**
  _Vigente_ · PF-7:49-53
- **No hay anulación de compra: un error se corrige con un ajuste de inventario** (tipo `devolucion_proveedor`). _Vigente_ ·
  PF-7:58; MIG 20261108120000:10
- **Totales de compras y costos de ítems solo se ven con `ver_costos`;** la deuda por proveedor la ve quien gestiona compras.
  _Vigente_ · MIG 20261108120000:6-9

## 13. Insumos de lavandería

- **Los insumos (detergente, bolsas, ganchos) son productos de la lavandería con stock, kardex y aviso de stock bajo.** El
  alta es la del catálogo; la entrada es una compra o una entrada de inventario. _Vigente_ · PF-7:115-118; SRS RF-INS-01
- **El consumo se registra desde "Salida o ajuste" (tipo `consumo`) y solo vale para un insumo activo de lavandería.** Idempotente;
  stock negativo permitido. _Vigente_ · H:36; PF-7:166; MIG 20261108140000
- **Se puede revertir un consumo mal cargado desde el kardex:** hace un contramovimiento sin costo que no recalcula el costo
  promedio. _Vigente_ · PF-7:166; MIG 20261108140000
- **Reporte "Insumos" (gasto en insumos):** cantidad × costo foto por insumo y día; exige `ver_reportes` y `ver_costos`. Un
  consumo sin costo no suma al gasto y se cuenta aparte; por día no se mezclan unidades distintas (la cantidad sale solo agrupando
  por insumo). Los consumos revertidos no cuentan. _Vigente_ · PF-7:166; MIG 20261108140000
- **Residuo aceptado:** quien tiene `ajustar_inventario` puede elegir un id de operación igual al de un movimiento y bloquear su
  reversión (solo dentro de su negocio, sin efecto en stock ni costo). _Riesgo aceptado_ · H:36; MIG 20261108140000:11-13
- **Stock de insumos fue pedido por la lavandería y queda fuera del contrato.** _Pendiente de decisión CTO (D-01)_ · H:128

## 14. Lavandería (órdenes)

- **La orden es una venta más su ficha** (mismo número, caja y pagos). La boleta lleva el número de la venta (`L1-000123`).
  _Vigente_ · PF-4 "La orden es una venta"
- **Estados: Recibida, En lavado, Lista para entregar, Entregada** (más Cancelada). Se puede volver un paso atrás; otros saltos se
  rechazan (`ERP_ORDEN_ESTADO`). Cada cambio queda en el historial con el usuario. _Vigente_ · SRS RF-LAV-04; PF-4 "Estados"
- **Cambiar de estado, entregar y ver la pestaña Órdenes necesitan conexión.** Crear la orden se puede sin conexión. _Vigente_ ·
  SRS RF-LAV-09; PF-4 "POS"
- **Se cobra el total al recibir (efectivo, QR o mixto); no hay saldos por cobrar y el reporte de saldos se excluye.** Entregar no
  mira el pago. _Supuesto pendiente de confirmar con el cliente_ (P-14; el form respalda "cobro total al recibir") · SRS:278;
  AUD:54; H:127
- **Solo en Bs;** caja separada de Lider. _Vigente_ · H:127-128
- **Entrega: con boleta o con carnet (si se perdió la boleta, exige el documento) y se registra quién retira.** _Vigente_ ·
  SRS RF-LAV-06; PF-4 "Entrega"
- **Ropa sin recoger: una orden lista hace más de 30 días aparece en "sin recoger".** Es un aviso; qué hacer con la ropa lo decide
  una persona. _Vigente_ · SRS RN-09; PF-4 "Panel"
- **Anular una orden exige `anular` (dueño y encargado) y motivo de 1 a 200 caracteres.** Si la caja sigue abierta, el efectivo
  vuelve a ella; si ya cerró, no toca el dinero y hay que devolver desde Ventas. Con caja abierta, si no hay ese efectivo o pasaron
  24 h sin `devolver_fuera_plazo`, la orden no se cancela hasta que cierre la caja. _Vigente (límite aceptado)_ · PF-4
  "Anulación"
- **Orden sin conexión: cliente escrito a mano (nombre obligatorio, teléfono)** y la venta queda marcada `sin_cliente`;
  vincular a un cliente registrado después queda fuera. _Vigente_ · PF-4 "Cliente sin conexión"
- **Campos de la orden: casillero hasta 20 caracteres, nota hasta 500, fecha prometida no anterior a la de recepción, prendas
  mayor a 0.** Daño o pérdida de prenda: se registra como nota en la orden. _Vigente / supuesto pendiente de confirmar con el
  cliente_ (P-16) · PF-4 "Tablas"; SRS:280
- **Precio por servicio:** normal y express, con forma de cobro por kilo o por pieza. Los precios (25 Bs por kilo declarados,
  prendas, planchado, recargo express, cobro mínimo) los carga el cliente en `Servicios`. _Supuesto pendiente de confirmar
  con el cliente_ (P-13); bloqueado por el cliente · SRS:277; H:39-41, 127-128
- **Lavandería no tiene impresora; sigue con talonario si no imprime.** _Supuesto pendiente de confirmar con el cliente_ (P-10) ·
  SRS:274; H:128
- **El servicio por kg en la demostración del acta debe verificarse.** _No verificado_ · `docs/acta-entrega.md` §2
- **El listado `/panel/ordenes` pagina por cursor; un cambio de estado entre páginas puede saltar una orden.** _Riesgo aceptado
  (`shortcut`)_ · H:370-372
- **Impresión real de la boleta, "sin recoger" con órdenes de más de 30 días, flujo con usuario en producción y móvil real:** _No
  verificado_ · H:378-379

## 15. Frial (carnes al vacío)

- **El sistema se entrega preparado para carnes al vacío; el cliente carga cortes y precios.** Entra sin catálogo inicial. El
  frial aún no abre. _Vigente · pendiente de decisión CTO (D-02: acordarlo por escrito)_ · SRS:288; H:129-131, 196-199
- **Tipos de producto:** por peso variable (unidad `kg`, el cajero escribe lo que pesa), por unidad, o paquete de peso fijo (se
  cobra por paquete y el stock va en paquetes). _Vigente_ · PF-5 "Paquete al vacío"
- **Entrada con lote y fecha de vencimiento** (código de 1 a 40 caracteres; vencimiento no anterior a hoy en La Paz; el producto
  no puede tener series). Solo en frial. _Vigente_ · PF-5 "Lotes"
- **El saldo de un lote es una estimación FIFO por producto en todo el negocio, no se descuenta en cada venta:** el cajero no
  elige lote al vender. Una entrada sin lote desplaza a los lotes viejos. Una entrada ya registrada sin lote no admite lote después.
  _Vigente (límite aceptado)_ · PF-5 "Lotes"
- **"Por vencer" (7/15/30 días) lista lotes con saldo estimado > 0 con vencimiento hasta hoy + N días, incluidos los ya
  vencidos.** _Vigente_ · PF-5 "Lotes"; H:326-327
- **Merma: salida en kg (siempre negativa), solo en frial, con motivo y permiso `ajustar_inventario`.** _Vigente_ · PF-5 "Mermas"
- **Despiece y balanza integrada están fuera de la versión 1.** _Vigente_ · SRS:25-29; H:198-199
- **Precios según tipo de cambio diario es imprescindible para el cliente;** el frial usa la grilla de Lider hasta que abra.
  _Vigente / supuesto_ · H:132; SRS:226-227

## 16. Reportes

- **Reportes por tipo de negocio.** Tienda: ventas (día, vendedor, producto, categoría, marca), más vendidos, stock (valor, stock
  bajo, sin movimiento), caja, kardex. Lavandería: ingresos por día y servicio con kilos, caja. Frial: ventas por día/corte con kg,
  stock, por vencer, caja. _Vigente_ · PF-5 "Qué ve cada negocio"; SRS RF-REP-01 a 03
- **Acceso: dueño, encargado y contador (`ver_reportes`). Ganancia, costo y valor del stock solo con `ver_costos`.** _Vigente_ ·
  SRS RF-REP-05
- **Fecha de una venta = la hora en que llegó al servidor (La Paz):** una venta sin conexión cuenta el día en que se envió.
  Una devolución resta en su propia fecha. _Vigente_ · H:331-332; MIG 20261102140000
- **Ganancia = neto − cantidad × foto del costo;** servicios con costo 0; un producto sin costo queda fuera y se cuenta
  ("ganancia incompleta"). _Vigente_ · MIG 20261102140000; PF-5
- **Límites:** rango hasta 366 días y hasta 5.000 filas (`ERP_LOTE_GRANDE`); el stock da `ERP_LOTE_GRANDE` con más de 5.000 productos
  activos (Lider tiene 597). El total del valor con filtro sale vacío. El kardex a Excel baja hasta 5.000 movimientos. _Riesgo
  aceptado_ · H:334-335, 341; MIG 20261102140000
- **Se descarga a Excel desde el navegador** (nombre `<reporte>-<negocio>-<desde>-<hasta>.xlsx`); no hay PDF de reportes, gráficos,
  reportes por correo ni consolidado de los 3 negocios. _Vigente_ · PF-5 "Panel de reportes", "Fuera de esta fase"
- **Si alguien vuelve a guardar el Excel como CSV y lo abre en otro programa, un texto que empiece con `=`, `+`, `-` o `@` podría
  interpretarse como fórmula.** No se cubre. _Riesgo aceptado_ · PF-5 "Panel de reportes"
- **Abrir el Excel en Excel o LibreOffice reales:** _No verificado_ · H:343-344
- **Un usuario con `ver_reportes` sin `ver_costos` no existe en la matriz.** _No verificado salvo tests unitarios_ · H:343-344
- **No hay panel consolidado de los 3 negocios** (el cliente no lo quiere y el contrato no lo pide). _Vigente_ · H:133-134; SRS:27-28

## 17. Impresión, instalación y equipos

- **Impresión por el navegador o PDF; no hay ESC/POS ni apertura electrónica del cajón.** Funciona con cualquier impresora que
  el equipo reconozca. _Vigente_ · `docs/arquitectura.md` ADR-07; SRS:27-28
- **¿Quién compró la impresora? Lider dice "No sé"; lavandería no tiene.** Nota en PDF hasta confirmar. _Supuesto pendiente de
  confirmar con el cliente_ · SRS:274 (P-10)
- **Impresora térmica real, táctil real y Android/Safari reales no se probaron.** _No verificado_ · H:189, 351; AUD:65-74
- **La app es una PWA instalable (POS y panel por separado); el panel se instala sin service worker, el POS con service worker.**
  Sin conexión el panel muestra "sin conexión", nunca datos viejos. _Vigente_ · H:535-544; PF-5 "PWA"
- **Compatibilidad objetivo: Chrome y Edge en PC, Chrome en Android, Safari en iOS para el panel.** Solo se probó Chromium.
  _No verificado (Firefox, Safari, WebKit)_ · SRS RNF-15; `docs/stack.md` "Safari y Firefox"
- **Tras publicar una versión nueva del POS, el service worker queda en espera: hay que aceptar "Actualización disponible".**
  _Vigente_ · PF-3:124-127; H:190-191
- **La interfaz está en español de Bolivia: moneda `Bs 1.234,50`, fecha `dd/mm/aaaa`.** _Vigente_ · SRS RNF-13
- **Atajos del POS:** "/" vuelve a la búsqueda; F2 cobra; el lector USB busca sin clic extra. _Vigente_ · CAP:29-32
- **Accesibilidad:** sin axe ni lector de pantalla real. _No verificado_ · AUD:73

## 18. Respaldo, hosting y plataforma

- **Backup diario cifrado a las 03:00 (hora de La Paz), fuera de Supabase, con restauración probada en cada corrida.** Se guarda 30
  días como artifact cifrado (`age`). Incluye usuarios y las fotos de productos. _Vigente_ · `docs/backup.md`; SRS RNF-08
- **Pérdida máxima aceptada: 24 h; restauración objetivo menos de 4 h.** El simulacro con datos reales tardó 50 s. _Vigente_ ·
  SRS RNF-09; `docs/backup.md` "Tiempos"
- **Si se pierde la clave privada `age` ningún backup se puede leer;** debe haber copia offline. _Riesgo / pendiente (CTO copiar
  la clave offline)_ · `docs/backup.md` "Requisitos"; H:205-206
- **Si faltan los secretos de fotos, el backup de la base sigue y las fotos se omiten con advertencia amarilla.** _Vigente_ ·
  `docs/backup.md` paso 5
- **El backup no cubre otros buckets de Storage ni la configuración del proyecto** (auth, Edge Functions): se recrea con
  `docs/despliegue.md`. _Vigente_ · `docs/backup.md` "Qué no cubre"
- **Supabase Free se pausa tras ~7 días de baja actividad y no tiene backups propios; Vercel Hobby prohíbe uso comercial.** El CTO
  aceptó ambos riesgos. Pasar a Pro si el proyecto se pausa, se acerca a 500 MB o el negocio lo justifica. _Riesgo aceptado_ ·
  `docs/stack.md` "Condiciones", "Análisis previo"
- **Credenciales expuestas el 2026-11-04 (contraseña de la base y `service_role`): rotar EN LA ENTREGA** (resetear contraseña,
  rotar claves, actualizar Vercel y redesplegar, correr el backup). _Riesgo aceptado hasta la entrega_ · H:238-244
- **Las planillas de carga del cliente tienen acceso "Cualquier persona con el enlace" (decisión del CTO);** recomendado pasarlas
  a Restringido al terminar la carga (contienen costos y datos personales). _Riesgo aceptado_ · H:98-104; `docs/migracion-datos.md`
  "Datos personales"
- **La seguridad usa una CSP con `unsafe-inline` (no se cambia: un nonce obliga a renderizar en cada pedido y el POS debe ser
  estático para funcionar sin conexión).** _Riesgo aceptado_ · AUD:58
- **Producción = ex staging `yfdhiuaeinfkvcegeqfy`; sin previews.** Las migraciones se prueban en local y CI antes de `db push`.
  _Vigente_ · H:218-222
- **Capacidad estimada: 3 negocios, 15 usuarios, 200 operaciones por día, 5 años de datos dentro del límite vigente.** Sin
  estimación de tamaño hecha. _No verificado_ · SRS RNF-03; AUD:71
- **Rendimiento objetivo: búsqueda en POS menos de 200 ms con 2.000 productos (medido 33 a 85 ms); venta confirmada menos de 2 s con
  conexión (sin prueba de tiempo).** _Vigente / no verificado (RNF-02)_ · SRS RNF-01/02; H:467; AUD:62
- **Base centralizada: una sola base para los 3 negocios, datos separados por `negocio_id` y RLS.** _Vigente (decisión CTO)_ ·
  H:505-507

## 19. Carga inicial y arranque

- **Importación de Lider hecha en producción (2026-11-04): 597 productos, 53 categorías, 2.633 unidades (Tienda 1.020, Depósito
  1.613), 292 fotos.** Repetible: una segunda corrida da 0 creados. _Vigente_ · H:232-236
- **Productos con "ubicación" vacía (26 filas, 86 unidades) quedaron en Tienda;** códigos de barras repetidos (19) quedaron solo en la
  primera fila; 13 grupos de posibles duplicados y 2 pares de categorías parecidas no se unieron (el cliente decide). _Vigente /
  pendiente (cliente)_ · `docs/migracion-datos.md` "Reglas de limpieza"
- **Muebles, colchones y motos (marcados en el formulario, 0 productos): sus categorías no se importan.** _Supuesto pendiente de
  confirmar con el cliente_ · SRS:268 (P-04)
- **¿Faltan productos? Declaró 100 a 500 y cargó 597: manda la planilla.** _Supuesto pendiente de confirmar con el cliente_ · SRS:266 (P-02)
- **La planilla de Lider tiene 4 filas con "aro 20/29" en código de barras, 17 códigos repetidos y la fila 582 con EAN-13 inválido
  (volver a escanear).** _Pendiente (cliente)_ · H:123-124
- **Antes de capacitar:** no trasladar ni dar de baja productos con series importadas, o el script de limpieza aborta. _Vigente_ ·
  H:311-312
- **Limpieza de pruebas antes del paralelo (script `limpiar-pruebas`):** borra lo transaccional desde el corte; backup en verde
  justo antes; en cada equipo, cola vacía y borrar el contador local (`erp:pos:contador:<id>`) o los datos del sitio. Excepción
  autorizada a "kardex append-only". `--linked` contra producción no verificado. _Vigente / no verificado_ ·
  `docs/despliegue.md` "Limpieza"; H:285-310
- **Paralelo de 3 días con el cuaderno** (cada venta se anota en ambos). Hasta el fin del paralelo el cuaderno sigue siendo el
  registro oficial. Una diferencia sin causa invalida el día. _Vigente_ · `docs/paralelo.md`
- **Producción lista para cargar datos; bloqueado por el cliente en este orden:** precios, servicios de lavandería y catálogo del
  frial, tope de descuento, conteo físico, usuarios, prueba en equipos reales con lector, capacitación. _Pendiente (cliente/CTO)_ ·
  H:37-48
- **Capacitación (`docs/capacitacion.md`) no cubre la Entrega B** (crédito, reservas, compras, insumos) y dice que el Inicio del
  panel no tiene módulos, cosa ya corregida (#63). _Pendiente (documentación)_ · CAP:102-104; H:211

## 20. Contrato, entrega y alcance

- **Plazo contractual: 30 días calendario desde la firma y la recepción de precios e inventario.** Faltan los precios;
  recomendado avisarlo por escrito. _Pendiente de decisión CTO (D-03)_ · SRS:254; H:137-138
- **Anticipo cobrado (50 %); el saldo (50 %, Bs 5.000) se cobra a la entrega contra firma del acta.** Con la firma corre la
  garantía de 5 años (cláusula novena) y se entregan código fuente, accesos y dominio con el precio total pagado. _Vigente_ ·
  H:56; `docs/acta-entrega.md` §7
- **El alojamiento y el dominio del primer año corren por cuenta del desarrollador; desde el segundo año, por el cliente.**
  _Vigente (borrador de acta)_ · `docs/acta-entrega.md` §7
- **El acta no se firma hasta tener dominio propio (cláusula octava), el paralelo cumplido y las observaciones subsanadas.** El
  dominio se compra al final (RF-TR-10 abierto). _Pendiente de decisión CTO_ · `docs/acta-entrega.md`; H:200
- **D-04: contrato firmado; falta la fecha exacta para contar el plazo.** _Pendiente de decisión CTO_ · H:54-55; SRS:290
- **Alcance v1 incluye todo (Entrega A + B).** Se avisó que no entra razonablemente en 30 días ni en Bs 10.000; mitigación: A
  contractual y B extras. Los extras de B (crédito, reservas, proveedores, insumos), el POS sin conexión, los precios en USD y el
  dólar paralelo están fuera de la cláusula tercera; si entran en la garantía de 5 años está sin definir. _Pendiente de decisión CTO
  (D-01)_ · H:144-146; SRS:287; `docs/acta-entrega.md` §6
- **Entrega A condiciona el acta y el saldo; la Entrega B no.** _Vigente_ · SRS:23
- **Fuera de la versión 1:** factura electrónica o SIN, recordatorios y promociones por WhatsApp, fotos de daños, balanza, ESC/POS y
  cajón, despiece, tienda online, contabilidad, panel consolidado y traspasos entre negocios. _Vigente_ · SRS:25-29
- **Entregar el frial sin catálogo y que no trabe el acta** (porque el saldo depende de ella). _Pendiente de decisión CTO (D-02)_ ·
  H:129-131; SRS:288
- **Codex (revisión de otro laboratorio) no revisó los PRs de las fases 3 a 7; queda pendiente cuando vuelva la cuota (2026-12-03).**
  _No verificado_ · H:10-11, 49-50
- **Verificaciones pendientes del PR `test/brechas-trazabilidad`:** E2E de filtros, dólar paralelo, "sin recoger", garantía en la
  nota, venta menor a 2 s, axe, Firefox, WebKit, `pnpm audit` semanal y el flaky `catalogo.spec.ts:195`. _Pendiente_ · H:12-13;
  AUD:82-91

## 21. Preguntas abiertas para el cliente (P-xx)

Todas tienen un supuesto aplicado para no frenar el diseño. No consta en las fuentes que el cliente haya respondido ninguna.

- **P-01 Series:** `controla_serie` en equipos grandes, a marcar con el cliente; la importación no activa series. _Supuesto pendiente de
  confirmar con el cliente_ · SRS:265
- **P-02 Cantidad de productos:** manda la planilla (597). _Supuesto pendiente de confirmar_ · SRS:266
- **P-03 Moneda:** solo Bs; el dólar solo fija precios. _Supuesto pendiente de confirmar_ · SRS:267
- **P-04 Muebles, colchones y motos:** sin categoría hasta que existan productos. _Supuesto pendiente de confirmar_ · SRS:268
- **P-05 Códigos "1" a "597":** se conservan como código interno. _Supuesto pendiente de confirmar_ · SRS:269
- **P-06 Saldos de crédito:** carga manual de 1 a 20 créditos. _Supuesto pendiente de confirmar_ · SRS:270
- **P-07 Interés 2,5 % mensual:** sobre saldo (francés). _Supuesto pendiente de confirmar_ (afecta solo `plan_cuotas`) · SRS:271
- **P-08 Redondeo de Bs al convertir USD:** 2 decimales. _Supuesto pendiente de confirmar_ · SRS:272
- **P-09 "Eterazama y Sacaba":** 1 depósito. _Supuesto pendiente de confirmar_ · SRS:273
- **P-10 Impresora:** nota en PDF; lavandería con talonario si no imprime. _Supuesto pendiente de confirmar_ · SRS:274
- **P-11 Vendedor anula sin autorización:** resuelto, el vendedor no anula ni devuelve (CTO, 2026-11-08). _Vigente (resuelto)_ ·
  SRS:275
- **P-12 Cancelar una reserva:** se devuelve el anticipo por caja. _Supuesto pendiente de confirmar_ · SRS:276
- **P-13 Precios de lavandería (prenda, planchado, piezas grandes, recargo express, cobro mínimo):** se cargan en `Servicios` antes de
  arrancar. _Supuesto pendiente de confirmar_ · SRS:277
- **P-14 Saldos por cobrar de lavandería:** sin saldos; reporte excluido. _Supuesto pendiente de confirmar_ · SRS:278
- **P-15 Personal de lavandería en Lider:** usuarios asignados a ambos negocios. _Supuesto pendiente de confirmar_ · SRS:279
- **P-16 Prenda perdida o dañada:** se registra como nota en la orden. _Supuesto pendiente de confirmar_ · SRS:280
- **P-17 Conteo inicial del 2026-10-28:** se repite antes de arrancar. _Supuesto pendiente de confirmar_ · SRS:281

## 22. Decisiones abiertas del CTO (D-xx)

- **D-01 Adenda de extras:** registrar por escrito lo que excede la cláusula tercera (Entrega B, venta sin conexión, precios en USD,
  dólar paralelo) y definir si entran en la garantía de 5 años. _Pendiente de decisión CTO_ (recomendado antes de la fase 7; la
  fase 7 se hizo sin resolverlo) · SRS:287; H:8-9, 146
- **D-02 Frial sin catálogo:** entrega preparada para carnes al vacío, a acordar por escrito para que no trabe el acta. _Decidido
  parcialmente (2026-11-01); falta el acuerdo por escrito_ · SRS:288
- **D-03 Aviso de dependencia del cliente:** el cliente carga precios, servicios, series y tope de descuento. _Decidido (no frena el
  desarrollo); falta el aviso escrito_ · SRS:289
- **D-04 Firma del contrato:** `docs/srs.md` lo da por firmado y `docs/handoff.md` (Estado actual) por pendiente de firma; falta la fecha. _Pendiente: confirmar con el CTO_ · SRS:290; H:54-55
- **Otras pendientes del CTO:** dominio (RF-TR-10), rotación de credenciales en la entrega, copia offline de la clave `age`, compartir
  planillas con el cliente, y decidir si los saldos de crédito sin reverso o el interés fuera de `ventas.total` necesitan cambio.
  _Pendiente de decisión CTO_ · H:48, 70, 238-244; PF-7:109-113
