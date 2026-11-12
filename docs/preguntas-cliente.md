# Preguntas para el cliente

Cuestionario para llevar a la reunión con el cliente antes de la operación en paralelo. Cada pregunta dice qué hace el
sistema hoy si nadie responde y qué pasa si la respuesta es otra. Las preguntas salen de `docs/srs.md` (P-01 a P-17) y
la clasificación se verificó contra el código el 2026-11-10.

**Versión que usa el cliente (2026-11-11):** la página publicada "Preguntas antes de empezar"
(<https://claude.ai/artifact/5VpW65FVmxtgsVoaDnr967>), con las mismas 21 preguntas en lenguaje del cliente. La llena
el cliente y devuelve las respuestas como texto para WhatsApp. Este archivo queda como referencia interna.

Hay tres clases de respuesta:

- **La carga el cliente**: es un dato que se escribe en una pantalla del panel. No hay que esperar a nadie.
- **La cargamos nosotros**: es un dato, pero no tiene pantalla. Se carga en la base, sin programar nada.
- **Cambia el sistema**: la regla está escrita en el programa. Una respuesta distinta a la de hoy exige programar,
  probar y publicar; por eso estas preguntas van primero.

## 1. Las que cambian el sistema: preguntar primero

| N.º | Pregunta | Qué hace hoy el sistema | Si la respuesta es otra |
| --- | --- | --- | --- |
| 1 | En la venta a crédito, ¿el interés mensual se calcula sobre lo que el cliente todavía debe o sobre el total de la venta? (P-07) | Sobre lo que todavía debe. La cuota es fija. El porcentaje (2,5 %) sí se cambia en pantalla | Cambia el cálculo del plan de cuotas |
| 2 | Si un cliente paga todo su crédito antes de tiempo, ¿se le cobra el interés de los meses que faltaban? (M-3) | Sí, completo: para cerrar el crédito debe pagar todas las cuotas con su interés | Cambia el cobro de cuotas |
| 3 | Si se cancela una reserva, ¿se devuelve el anticipo? ¿Todo, una parte o nada? (P-12) | Se devuelve todo, por caja y por el mismo medio de pago | Cambia la cancelación de reservas |
| 4 | En la lavandería, ¿se fía? Es decir, ¿un cliente puede dejar la ropa y pagar después, o pagar una parte? (P-14) | No. La orden se cobra completa al recibir la ropa | Cambio grande: la lavandería pasaría a manejar saldos por cobrar |
| 5 | En la lavandería, ¿el servicio express es un precio aparte por prenda o un recargo en porcentaje? ¿Hay un cobro mínimo por orden? (P-13) | Cada servicio tiene dos precios, normal y express. No hay recargo en porcentaje ni cobro mínimo | Se agrega el recargo o el mínimo |
| 6 | Si una prenda se pierde o se daña, ¿qué se hace con el cliente? ¿Se le descuenta, se le paga? (P-16) | Solo se escribe una nota en la orden | Se agrega el registro de la pérdida y su compensación |
| 7 | ¿Qué impresora van a usar para la nota de venta? ¿De qué ancho es el papel? (P-10) | Imprime en papel de 80 mm y en hoja A4, o guarda la nota como PDF | Una impresora de 58 mm necesita un formato nuevo |
| 8 | Al pasar un precio de dólares a bolivianos, ¿cómo redondean? (P-08) | A 2 decimales | Cambia el cálculo de precios |

## 2. Las que cargamos nosotros

| N.º | Pregunta | Qué hace hoy el sistema | Qué necesitamos |
| --- | --- | --- | --- |
| 9 | "Eterazama y Sacaba", ¿son un depósito o dos lugares donde se guarda mercadería por separado? (P-09) | Un solo depósito | Si son dos: el nombre de cada uno y qué mercadería hay en cuál |
| 10 | ¿Alguna persona trabaja en más de un negocio? (P-15) | Cada persona entra a un negocio | El nombre de la persona y los negocios donde trabaja |

## 3. Las que carga el cliente en el panel

| N.º | Pregunta | Dónde se carga |
| --- | --- | --- |
| 11 | ¿Qué productos llevan número de serie? (P-01) | En el producto, la casilla "Controla número de serie"; las series, en Inventario |
| 12 | ¿Qué clientes tienen hoy una deuda a crédito, de cuánto y en cuántas cuotas? (P-06) | En Créditos, "saldo inicial". Estos saldos entran sin interés |
| 13 | ¿Cuál es el porcentaje de interés mensual del crédito? | En Créditos, configuración. Hoy 2,5 % |
| 14 | Precios de la lavandería: por prenda, planchado y piezas grandes (P-13) | En Productos y en Precios, con precio normal y precio express |
| 15 | NIT, dirección y teléfono que deben salir en la nota de venta | En "Datos del negocio" |
| 16 | ¿Cuál es el descuento máximo que puede dar un vendedor sin pedir permiso? | En "Descuento" |
| 17 | ¿Se hizo el conteo de mercadería del 28 de octubre? (P-17) | Si no se hizo o ya pasó tiempo, se repite en Inventario, "Conteo", antes de empezar |

## Lo que el sistema ya da por hecho: confirmar con un sí

Son supuestos aplicados, no respuestas del cliente. Basta con que los confirme.

- El sistema cobra solo en bolivianos; el dólar solo fija precios (P-03).
- Los 597 productos de la planilla son el catálogo (P-02); los códigos "1" a "597" se conservan (P-05).
- Las categorías sin productos (muebles, colchones, motos) no se cargaron (P-04).
- El vendedor no anula ventas; lo hace un encargado o el dueño (P-11).

## Después de la reunión

Las respuestas se anotan en `docs/srs.md`, en la pregunta que corresponda. Toda respuesta de la sección 1 distinta a
lo que el sistema hace hoy se convierte en un cambio de programa con su propio PR, y debe estar publicada antes de
empezar el paralelo: cambiar una regla de dinero con ventas reales ya cargadas es más caro que cambiarla antes.
