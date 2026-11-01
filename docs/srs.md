# SRS — ERP Multitiendas

Especificación de requisitos de software. Versión 1.0 (2026-11-01). Basada en ISO/IEC/IEEE 29148, en forma reducida.

## 1. Propósito y alcance

Sistema web y PWA para gestionar 3 negocios de un mismo dueño: Multitienda Lider, Lider Clean (lavandería) y un frial
de carnes. Reemplaza el cuaderno. Cada negocio tiene sus datos separados y un botón selector.

Fuentes de este documento:

- **CT:** contrato, cláusula tercera.
- **RL:** `docs/relevamiento.md`.
- **HO:** decisiones del CTO en `docs/handoff.md`.

### Versión 1

| Entrega | Contenido | Origen |
|---|---|---|
| A | Alcance contractual, precios por tipo de cambio, venta sin conexión | CT, RL, HO |
| B | Crédito y cuentas por cobrar, reservas, proveedores y sus deudas, stock de insumos | Decisión CTO 2026-11-01 |

El acta de entrega y el saldo se apoyan en la Entrega A. La Entrega B no los condiciona.

### Fuera de la versión 1

Factura electrónica o integración con el SIN, recordatorios y promociones por WhatsApp, fotos de daños, integración con
balanza, impresión ESC/POS y apertura electrónica del cajón, lotes y despiece, tienda online, contabilidad, panel
consolidado de los 3 negocios, y traspasos entre negocios.

## 2. Actores

| Rol | Quién | Uso principal |
|---|---|---|
| Dueño | Gerente propietario | Panel, reportes, usuarios, autorizaciones |
| Encargado | Administración | Panel, productos, inventario, caja |
| Contador | Contabilidad | Solo lectura de reportes |
| Vendedor | Personal de Lider y frial | POS, caja propia, consulta de stock |
| Empleado | Personal de lavandería | POS de lavandería, órdenes, caja propia |

Un usuario puede tener un rol distinto en cada negocio.

## 3. Requisitos funcionales

Cada requisito es verificable por su criterio. Entrega A salvo que se indique B.

### 3.1 Transversales

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-TR-01 | Inicio de sesión con correo y contraseña | Sin sesión, `/panel` y `/pos` redirigen al login | CT |
| RF-TR-02 | Selector de negocio | Un usuario con 2 negocios cambia con un botón y solo ve datos del elegido | CT |
| RF-TR-03 | Aislamiento de datos por negocio | Un usuario sin acceso al negocio B no lee ni escribe sus datos, ni por API | CT, HO |
| RF-TR-04 | Gestión de usuarios | Con permiso, crea, desactiva y asigna negocio y rol. Un usuario desactivado no entra | CT |
| RF-TR-05 | Permisos por rol y tipo de negocio | Sin permiso, la acción no aparece y el servidor la rechaza | RL |
| RF-TR-06 | Panel protegido para gestionar contenido | Con permiso, crea, edita y consulta productos, precios, servicios y clientes desde celular y PC | CT, HO |
| RF-TR-07 | Instalable como PWA | Se instala en PC y celular desde el navegador | CT |
| RF-TR-08 | Registro de dispositivos POS | Cada equipo POS tiene prefijo propio. Lo registra quien tenga el permiso `usuarios` | HO |
| RF-TR-09 | Auditoría de cambios | Cambios de productos, precios, usuarios y permisos guardan quién, cuándo, antes y después | HO |
| RF-TR-10 | Publicación | El sistema responde por HTTPS en el dominio de la cláusula octava | CT |

### 3.2 Catálogo

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-CAT-01 | Productos con código interno, código de barras, descripción, marca, modelo, categoría y foto | Se crean y editan. Código repetido en un negocio se rechaza | CT, RL |
| RF-CAT-02 | Catálogo por categoría y marca | Se filtra por ambas | CT |
| RF-CAT-03 | Búsqueda por código de barras, código interno o texto | El lector USB encuentra el producto sin clic adicional | RL |
| RF-CAT-04 | Listas de precio por negocio | Lider: contado, crédito, mayorista y mínimo | RL |
| RF-CAT-05 | Precio en USD o Bs por producto | Un producto en USD muestra Bs según el tipo de cambio vigente | RL |
| RF-CAT-06 | Tipo de cambio con historial | Al registrar uno nuevo, cambian los Bs de los productos en USD sin editarlos | RL |
| RF-CAT-07 | Número de serie opcional por producto | Si `controla_serie`, la venta exige una serie disponible | RL |
| RF-CAT-08 | Plazo de garantía por producto | La nota muestra la garantía | RL |
| RF-CAT-09 | Desactivar en vez de borrar | Un producto con movimientos no se borra | HO |
| RF-CAT-10 | Variantes como productos separados | Cada color tiene su código y su stock | RL |
| RF-CAT-11 | Carga masiva de precios en el panel | El encargado edita listas y moneda en una grilla, filtra los productos sin precio y guarda solo lo cambiado | HO |

### 3.3 Inventario y kardex

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-INV-01 | Stock por ubicación | Lider ve tienda y depósito por separado | RL |
| RF-INV-02 | Kardex de entradas y salidas por producto | Cada movimiento muestra fecha, tipo, cantidad, usuario y referencia. No se edita ni se borra | CT |
| RF-INV-03 | Entrada con costo | Actualiza stock y costo promedio | CT, RL |
| RF-INV-04 | Salidas que no son venta | Dañado, devolución al proveedor y cambio por garantía exigen motivo y permiso | RL |
| RF-INV-05 | Traslado entre ubicaciones | Tienda y depósito cambian en la misma operación; el total no cambia | RL |
| RF-INV-06 | Conteo físico | El conteo registra diferencias como ajustes | RL |
| RF-INV-07 | Avisos de stock bajo | Lista los productos bajo su stock mínimo | RL |
| RF-INV-08 | Consistencia del stock | `stock` coincide con la suma del kardex | HO |

### 3.4 Punto de venta

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-VEN-01 | Registrar venta | Descuenta stock y genera kardex en una sola transacción | CT |
| RF-VEN-02 | Pagos en efectivo Bs y QR, combinables | La suma de pagos iguala el total | RL |
| RF-VEN-03 | Descuento con tope | Sin permiso se pide autorización. Sobre el tope por negocio se rechaza | RL |
| RF-VEN-04 | Cliente general o registrado | Lider permite cliente general; lavandería exige datos | RL |
| RF-VEN-05 | Nota de venta | Se imprime desde el navegador o baja en PDF con negocio, dirección, teléfono y garantía | HO, RL |
| RF-VEN-06 | Anular venta | Con conexión y permiso. Genera contramovimientos y conserva la venta | HO |
| RF-VEN-07 | Devolución | Dentro de 24 h, devuelve dinero por caja y stock por kardex | RL |
| RF-VEN-08 | Consulta rápida de stock y precio | Desde el POS, buscar un producto muestra precio y stock por ubicación sin iniciar una venta | HO |
| RF-VEN-09 | Venta sin conexión | Se registra sin internet. Al volver se envía sin duplicarse | HO |
| RF-VEN-10 | Aviso de pendientes | Se ve "N ventas sin enviar" | HO |
| RF-VEN-11 | Numeración por equipo | Formato `C1-000123`, sin choques entre equipos | HO |
| RF-VEN-12 | QR sin conexión | Queda "pendiente de verificar" | HO |
| RF-VEN-13 | Reconciliación | Reporte de ventas sin conexión y stock negativo | HO |
| RF-VEN-14 | Bloqueos sin conexión | Productos, precios, ajustes, cierre de caja, usuarios y cambios de estado piden internet | HO |

### 3.5 Caja

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-CAJ-01 | Apertura con monto inicial | Se permite sin conexión; 1 sesión abierta por equipo | HO |
| RF-CAJ-02 | Gastos, ingresos y retiros | Exigen motivo y monto | RL |
| RF-CAJ-03 | Cierre con arqueo | Requiere conexión y cola vacía. El servidor calcula esperado y diferencia | RL, HO |
| RF-CAJ-04 | Caja separada por negocio | Las sesiones de un negocio no afectan a otro | RL |

### 3.6 Clientes

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-CLI-01 | Registro y consulta | Nombre, CI o NIT, teléfono y dirección; búsqueda por nombre o documento | CT, RL |
| RF-CLI-02 | Clientes por negocio | El cliente de un negocio no aparece en otro | RL |

### 3.7 Lavandería

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-LAV-01 | Servicios y precios | Cada servicio tiene forma de cobro y precios normal y express; la orden toma el que corresponde | RL |
| RF-LAV-02 | Recepción de orden | Cliente, servicios, peso o cantidad, prendas, casillero y fecha prometida | CT, RL |
| RF-LAV-03 | Boleta de la orden | Numerada, imprimible o en PDF, con negocio, dirección y teléfono | RL |
| RF-LAV-04 | Estados | Recibido, En lavado, Listo para entregar, Entregado. Todo cambio queda en historial | CT, RL |
| RF-LAV-05 | Cobro al recibir | Efectivo o QR, por caja | CT, RL |
| RF-LAV-06 | Entrega | Con boleta, o con carnet si se perdió. Registra quién recoge | CT, RL |
| RF-LAV-07 | Ropa sin recoger | Lista órdenes listas con más de 1 mes | RL |
| RF-LAV-08 | Empleado que atendió | Cada orden guarda quién la recibió | RL |
| RF-LAV-09 | Orden nueva sin conexión | Se crea sin internet, no se duplica. Cambiar estado pide conexión | HO |
| RF-LAV-10 | Anular orden | Con permiso y motivo. Conserva el historial | RL |

### 3.8 Frial

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-FRI-01 | Venta por peso y corte | Acepta kg con 3 decimales; el total redondea a 2 | CT |
| RF-FRI-02 | Inventario y kardex por corte | Entradas y salidas en kg con decimales | CT |
| RF-FRI-03 | Uso sin catálogo inicial | El negocio funciona vacío; el encargado carga cortes y precios | HO |

### 3.9 Reportes

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-REP-01 | Reportes de Lider | Ventas del día y del mes, por vendedor, por producto, categoría o marca, ganancia, valor del stock, más vendidos, sin movimiento, stock bajo, kardex y caja diaria | CT, RL |
| RF-REP-02 | Reportes de lavandería | Ingresos del día y del mes, kilos, ingresos por servicio y caja diaria | CT, RL |
| RF-REP-03 | Reportes de frial | Ventas por día, por corte y kg vendidos, stock y caja diaria | CT |
| RF-REP-04 | Exportación | Cada reporte se ve en pantalla y baja en Excel | RL |
| RF-REP-05 | Acceso | Dueño, encargado y contador. La ganancia exige `ver_costos` | RL |

### 3.10 Carga inicial

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-MIG-01 | Importar catálogo de Lider | Script repetible con reporte de filas rechazadas. Stock total igual a la fuente. Los precios los carga el cliente | CT, RL |
| RF-MIG-02 | Stock inicial | Se carga con movimientos `inicial` del kardex | HO |

### 3.11 Entrega B

| ID | Requisito | Criterio de aceptación | Origen |
|---|---|---|---|
| RF-CRE-01 | Venta a crédito | Con inicial, plazo, interés y frecuencia parametrizados por negocio; por defecto 50 %, 3 meses, 2,5 %, mensual | RL |
| RF-CRE-02 | Plan de cuotas | Se genera al crear el crédito y se imprime | RL |
| RF-CRE-03 | Documentos del crédito | Registra CI, comprobante de domicilio y pagaré | RL |
| RF-CRE-04 | Pago de cuotas | Admite pago parcial, entra por caja y reduce el saldo | RL |
| RF-CRE-05 | Cuentas por cobrar y cuotas vencidas | Muestra saldo por cliente. Una cuota impaga pasada su fecha aparece vencida, con sus días de atraso | RL |
| RF-CRE-06 | Saldos iniciales | Permite cargar los créditos activos al arrancar | RL |
| RF-RES-01 | Reserva con anticipo | Aparta stock y registra el anticipo por caja | RL |
| RF-RES-02 | Completar reserva | Se convierte en venta y descuenta el anticipo del total | RL |
| RF-RES-03 | Cancelar reserva | Libera stock y resuelve el anticipo según P-12 | RL |
| RF-COM-01 | Proveedores | Alta, edición y consulta por negocio | RL |
| RF-COM-02 | Compras | Cada compra genera entradas y recalcula costo promedio | RL |
| RF-COM-03 | Deudas a proveedores | Muestra saldo por proveedor y registra pagos | RL |
| RF-INS-01 | Insumos de lavandería | Detergente, bolsas y ganchos con stock, kardex y aviso de stock bajo | RL |
| RF-INS-02 | Consumo de insumos | Se registra y alimenta "gasto en insumos" | RL |

## 4. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | El dinero se cobra y registra en Bs. El dólar solo fija precios (supuesto de P-03) |
| RN-02 | La venta guarda el tipo de cambio y el precio en Bs que vio el vendedor. Cambios posteriores no la alteran |
| RN-03 | El servidor no recalcula precios de una venta sin conexión; guarda el de lista para comparar |
| RN-04 | Stock negativo permitido: se marca para revisar, no se bloquea |
| RN-05 | El kardex es append-only. Una corrección es un contramovimiento |
| RN-06 | El costo es promedio ponderado. La venta guarda foto del costo para la ganancia |
| RN-07 | Cierre de caja imposible con envíos pendientes en ese equipo |
| RN-08 | Devolución dentro de 24 h con permiso `anular`. Después, exige `devolver_fuera_plazo` |
| RN-09 | Ropa sin recoger: se avisa a los 30 días. La salida del local la decide una persona |
| RN-10 | Un producto con series vende una unidad identificada por línea |

### Matriz de permisos inicial

Datos de `rol_permisos`, editables sin cambiar código. D dueño, E encargado, C contador, V vendedor o empleado.

| Permiso | Tienda y frial | Lavandería |
|---|---|---|
| `vender` | D, E, V | D, E, V |
| `ver_costos` | D, E, C | D, E, C |
| `descontar` | D, E | D, E, V |
| `anular` | D, E, V (P-11) | D, E, V (P-11) |
| `devolver_fuera_plazo` | D, E | D, E |
| `ajustar_inventario` | D, E | D, E |
| `editar_productos` | D, E | D, E |
| `ver_reportes` | D, E, C | D, E, C |
| `caja` | D, E, V | D, E, V |
| `usuarios` | D | D, E |
| `cambiar_estado_orden` | — | D, E, V |
| `gestionar_credito` | D, E | — |
| `gestionar_reservas` | D, E, V | — |
| `gestionar_compras` | D, E | D, E |

El cliente marcó "Vender" y varias acciones de lavandería solo para vendedor o empleado. Se amplió a dueño y encargado,
que son quienes cubren al personal. Frial usa la grilla de Lider hasta que abra.

## 5. Requisitos no funcionales

| ID | Atributo | Requisito | Medición |
|---|---|---|---|
| RNF-01 | Rendimiento | Búsqueda en POS por debajo de 200 ms con 2.000 productos | Prueba E2E con catálogo de ese tamaño |
| RNF-02 | Rendimiento | Venta confirmada en menos de 2 s con conexión | Prueba E2E |
| RNF-03 | Capacidad | 3 negocios, 15 usuarios, 200 operaciones por día, 5 años de datos dentro del límite vigente | Estimación de tamaño antes de producción |
| RNF-04 | Disponibilidad | El POS vende sin internet | E2E sin conexión |
| RNF-05 | Integridad | Reenvíos no duplican; `stock` igual a la suma del kardex | pgTAP |
| RNF-06 | Seguridad | RLS en toda tabla operativa. Sin escritura directa en tablas contables | pgTAP |
| RNF-07 | Seguridad | `service_role` nunca llega al navegador. Secretos fuera del repo | Revisión y escaneo en CI |
| RNF-08 | Respaldo | Backup diario cifrado fuera de Supabase, con restauración probada | Simulacro antes de producción |
| RNF-09 | Recuperación | Pérdida máxima 24 h. Restauración en menos de 4 h | Simulacro cronometrado |
| RNF-10 | Mantenibilidad | Cumple `docs/estandares-codigo.md`. CI verde para mergear | CI |
| RNF-11 | Pruebas | Cumple `docs/plan-pruebas.md` | CI |
| RNF-12 | Portabilidad | Despliegue reproducible, movible de proveedor en horas | Documentado y ensayado |
| RNF-13 | Usabilidad | Interfaz en español de Bolivia. Moneda `Bs 1.234,50`, fecha `dd/mm/aaaa` | Revisión |
| RNF-14 | Accesibilidad | Navegable por teclado, contraste WCAG AA, POS operable con lector | Auditoría `web-design-guidelines` |
| RNF-15 | Compatibilidad | Chrome y Edge actuales en PC; Chrome en Android; Safari en iOS para el panel | E2E y prueba manual |
| RNF-16 | Observabilidad | Errores de RPC registrados, sin datos personales en logs | Revisión |

## 6. Restricciones

- Stack en `docs/stack.md`: Next.js 16, Supabase Free con backups propios, Vercel Hobby. Riesgos aceptados por el CTO.
- Una sola app, una sola base. Datos separados por negocio.
- Plazo contractual: 30 días calendario desde la firma y la recepción de la información (cláusulas quinta y undécima).
- Sin integración con Impuestos Nacionales.

## 7. Preguntas abiertas

Cada una tiene un supuesto para no frenar el diseño. Si el cliente responde otra cosa, se ajusta el requisito indicado.

### Para el cliente

| ID | Pregunta | Supuesto | Afecta |
|---|---|---|---|
| P-01 | ¿Qué productos llevan número de serie? "Todos" no coincide con vasos y platos, y hay 0 series cargadas | `controla_serie` activo en equipos grandes, a marcar con el cliente | RF-CAT-07 |
| P-02 | ¿Faltan productos? Declaró 100 a 500 y cargó 597 | La planilla manda | RF-MIG-01 |
| P-03 | ¿Se cobra en dólares? Marcó "Ambas", pero solo acepta efectivo en Bs y QR | Solo Bs | RN-01 |
| P-04 | ¿Existen muebles, colchones y motos? Marcados en el form, con 0 productos | Categorías sin productos no se importan | RF-MIG-01 |
| P-05 | ¿Se conservan los códigos "1" a "597"? Dijo no usar códigos propios | Se conservan como código interno | RF-CAT-01 |
| P-06 | ¿Cómo entrega los saldos de crédito? Quiere migrarlos y no tiene lista de clientes | Carga manual de 1 a 20 créditos | RF-CRE-06 |
| P-07 | ¿El 2,5 % mensual es sobre saldo o sobre el total? | Sobre saldo. **Bloquea RF-CRE-02** | RF-CRE-02 |
| P-08 | Regla de redondeo de Bs al convertir desde USD | 2 decimales | RF-CAT-05 |
| P-09 | ¿"Eterazama y sacaba" son 2 depósitos? | 1 depósito | RF-INV-01 |
| P-10 | ¿Quién compró impresora? Lider dice "No sé", lavandería no tiene | Nota en PDF hasta confirmar; lavandería sigue con talonario si no imprime | RF-VEN-05, RF-LAV-03 |
| P-11 | ¿El vendedor puede anular sin autorización? | Se respeta la grilla. Recomendado limitarlo | Matriz |
| P-12 | Al cancelar una reserva, ¿se devuelve el anticipo? | Se devuelve por caja | RF-RES-03 |
| P-13 | Precios de lavandería por prenda, planchado y piezas grandes; recargo express; cobro mínimo | Se cargan en `Servicios` antes de arrancar | RF-LAV-01 |
| P-14 | Lavandería pide "saldos por cobrar" pero cobra todo al recibir | Sin saldos; reporte excluido | RF-REP-02 |
| P-15 | Lavandería dice que nadie trabaja en más de un negocio, pero sus 3 personas están en Lider | Usuarios asignados a ambos | RF-TR-02 |
| P-16 | Respuesta ante prenda perdida o dañada | Se registra en la orden como nota | RF-LAV-10 |
| P-17 | ¿Se hizo el conteo inicial del 2026-10-28? | Se repite antes de arrancar | RF-MIG-02 |

### Para el CTO

| ID | Decisión | Recomendación |
|---|---|---|
| D-01 | Registrar por escrito lo que excede la cláusula tercera: Entrega B, venta sin conexión y precios en USD | Adenda o mención en el acta, según cláusula décima, antes de la fase 7. Define si entra en la garantía de 5 años |
| D-02 | Entrega de frial sin catálogo | Acordarlo por escrito para que no trabe el acta |
| D-03 | Aviso de que el arranque depende de que el cliente cargue sus precios | Escrito al cliente. Ya no frena el desarrollo ni la importación (CTO, 2026-11-01) |
| D-04 | Firma del contrato | Confirmar la fecha. `docs/handoff.md` la da como pendiente |

## 8. Trazabilidad con el contrato

| Cláusula tercera | Requisitos |
|---|---|
| Sistema multi-negocio, web y PWA | RF-TR-02, RF-TR-03, RF-TR-06, RF-TR-07 |
| Tienda: ventas y punto de venta | RF-VEN-01 a RF-VEN-14, RF-CAJ-01 a RF-CAJ-04 |
| Tienda: inventario de productos | RF-INV-01, RF-INV-03 a RF-INV-08 |
| Tienda: kardex | RF-INV-02 |
| Tienda: catálogo por categoría y marca | RF-CAT-01 a RF-CAT-11 |
| Tienda: clientes | RF-CLI-01, RF-CLI-02 |
| Tienda: reportes de ventas | RF-REP-01, RF-REP-04, RF-REP-05 |
| Lavandería: recepción de órdenes | RF-LAV-01 a RF-LAV-03, RF-LAV-08, RF-LAV-09 |
| Lavandería: estado de cada orden | RF-LAV-04, RF-LAV-07, RF-LAV-10 |
| Lavandería: pago y entrega | RF-LAV-05, RF-LAV-06 |
| Lavandería: reportes | RF-REP-02 |
| Frial: ventas por peso y corte | RF-FRI-01 |
| Frial: inventario y kardex | RF-FRI-02, RF-FRI-03 |
| Frial: reportes | RF-REP-03 |
| Funciones comunes: usuarios y accesos | RF-TR-01, RF-TR-04, RF-TR-05 |
| Funciones comunes: panel protegido | RF-TR-06 |
| Funciones comunes: reportes básicos | RF-REP-01 a RF-REP-05 |
| Publicación en dominio y alojamiento | RF-TR-10, RNF-08, RNF-12 |

Modelo y RPC por módulo en `docs/plan-modelo-datos.md`. Fases en `docs/roadmap.md`. Casos de prueba en
`docs/plan-pruebas.md`.
