# Prueba en los equipos reales

Lista para marcar con los equipos del cliente en la mano: el celular o la computadora de cada caja, el lector de
códigos y la impresora. Es el punto "Equipos reales probados" de `docs/paralelo.md`. Hasta hoy todo esto se probó solo
con un navegador de escritorio que simula un celular; ningún equipo real pasó por aquí.

La hace el CTO, porque exige tener los equipos. Se hace **antes** de la limpieza de pruebas
(`docs/despliegue.md`, "Limpieza de pruebas antes del paralelo"): las ventas de práctica de esta lista se anulan al
terminar y la limpieza las borra.

Por cada equipo, anotar marca, modelo y navegador. Lo que falle se anota con una foto de la pantalla y la hora: con la
hora se busca el error en la tabla `errores_app`.

## 1. Instalar el punto de venta (cada celular y cada computadora de caja)

- [ ] Abrir la dirección del sistema, entrar con la cuenta del vendedor y pasar a "Punto de venta".
- [ ] Instalar la aplicación desde el menú del navegador ("Instalar aplicación" o "Agregar a la pantalla de inicio").
- [ ] Abrirla desde su ícono: arranca sin barra de direcciones y pide elegir el equipo.
- [ ] Elegir el equipo y abrir la caja con un monto inicial.
- [ ] A pleno sol o con el brillo bajo, los textos y los botones se leen.
- [ ] Los botones se pueden tocar con el pulgar sin tocar el de al lado.

## 2. Lector de códigos de barras

- [ ] Con el cursor en la búsqueda, escanear un producto con código de barras: se agrega al carrito sin tocar la
      pantalla. Si no se agrega, lo más probable es que el lector no mande "Enter" al final: se configura en el
      lector.
- [ ] Escanear el mismo producto tres veces seguidas, rápido: la cantidad debe quedar en 3. Si queda otra, anotarla.
- [ ] Escanear cinco productos distintos seguidos: entran los cinco, en orden.
- [ ] Escanear un código que no existe: no se agrega nada al carrito. Anotar qué muestra la pantalla.
- [ ] En el panel, "Productos": escanear en el campo "Código de barras" de un producto nuevo lo llena completo.
- [ ] Si el lector es Bluetooth: se apaga solo tras unos minutos; al volver a escanear se reconecta sin reiniciar.

## 3. Impresión de la nota

- [ ] Hacer una venta de práctica en efectivo y llegar a la nota.
- [ ] Imprimir en "80 mm" en la impresora térmica: salen el nombre del negocio, el NIT, la dirección, la fecha, cada
      línea con su precio y el total. Nada se corta por el borde derecho.
- [ ] El papel se corta al final de la nota y no deja medio metro en blanco. Si sobra papel, se ajusta el tamaño de
      página en la configuración de la impresora, no en el sistema.
- [ ] Imprimir la misma nota en "A4" en una impresora común.
- [ ] En una venta a crédito de práctica, imprimir el plan de cuotas.
- [ ] Anotar el ancho real del papel. Si la impresora es de 58 mm, el sistema hoy no tiene ese formato: es un cambio
      de programa (`docs/preguntas-cliente.md`, pregunta 7).

## 4. Sin conexión (cada celular)

- [ ] Con la caja abierta, poner el celular en modo avión y hacer una venta en efectivo: se guarda y aparece el aviso
      de operaciones sin enviar.
- [ ] Quitar el modo avión: la venta se envía sola y el aviso desaparece.
- [ ] En el panel, "Ventas": la venta figura una sola vez, con el número del equipo.
- [ ] Cerrar la aplicación con una venta sin enviar y volver a abrirla: la venta sigue en la lista y se envía.

## 5. Cierre

- [ ] Anular las ventas de práctica desde el panel con la cuenta de un encargado.
- [ ] Cerrar la caja y anotar lo esperado y lo contado.
- [ ] Dejar el punto de venta instalado y con la sesión cerrada.

## Resultado

| Equipo (marca y modelo) | Navegador | Instalar | Lector | Imprimir | Sin conexión | Observaciones |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

Todo lo anotado en "Observaciones" se pasa a `docs/handoff.md` y, si es un defecto del sistema, se arregla antes del
paralelo.
