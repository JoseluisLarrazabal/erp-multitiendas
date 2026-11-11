# Rediseño visual: las dos propuestas y la deliberación

Registro de la fase 3.2 de `docs/plan-paralelo-rediseno.md`.

**Decisión del CTO, 2026-11-10: el híbrido recomendado.** Base A en todo el producto, más tres piezas del tablero de B
(avisos con detalle y un botón por aviso, cajas abiertas con las ventas de cada una, stock bajo como tabla compacta).
Del punto de venta de B no se toma nada. El CTO eligió sin haber podido abrir la página publicada de B (dijo "no veo la
propuesta b"); se le enviaron cuatro capturas suyas. La causa de que no la viera no se averiguó.

Ajustes que el chairman suma a la base A por los defectos vistos: etiquetas del gráfico de 7 días legibles, acciones
frecuentes arriba también en el celular, iconos de `lucide-react` (los que ya usa el proyecto) en lugar de los SVG
propios de la maqueta, y las fuentes servidas por `next/font` porque la CSP del producto no admite Google Fonts.

## Las maquetas

Son HTML estático con datos inventados; ningún nombre real de negocio ni de persona. Cada una trae nueve pantallas
(tablero de escritorio y de celular, variantes del frial y la lavandería, lista de productos, formulario de producto,
punto de venta de celular, cobro, punto de venta de escritorio y acceso) y una sección "Tokens" lista para portar a
`web/src/app/globals.css`.

| | Propuesta A | Propuesta B |
| --- | --- | --- |
| Enlace (privado, cuenta del CTO) | <https://claude.ai/artifact/4s14XMyBE9W1AcZhVWnoRX> | <https://claude.ai/artifact/Bfu1BpBSvGL9GSQ8SWcQAx> |
| Hecha con | taste-skill (`redesign-existing-projects`, `minimalist-ui`) | `impeccable` |
| Fondo y tipografía | Papel cálido, Figtree, texto base de 15 px | Blanco frío, Schibsted Grotesk, base de 14 px y tablas de 12 a 13 px |
| Estructura | Secciones separadas por filetes, una sola tarjeta para las ventas del día | Cada bloque es un panel con borde y cabecera en mayúsculas |
| Menú lateral | 5 grupos, con iconos | 5 grupos, sin iconos |
| Lo que pide acción | Banda ámbar "Por revisar" arriba, con enlaces | Caja ámbar "Por atender" a la derecha, con detalle y un botón por aviso |
| Cajas abiertas | Lista con la hora de apertura | Tabla con cajero, hora y ventas de cada caja |
| Controles | 40 px en el panel, 44 a 56 px en el punto de venta | 36 px en el panel, 44 a 52 px en el punto de venta |
| Punto de venta en celular | Total y "Cobrar" fijos abajo; cantidad en un campo, como hoy | Barra inferior con las 5 secciones; total y "Cobrar" dentro del desplazamiento; cantidad con botones de más y menos |
| Nombres de los tokens | Los que ya usa el proyecto (`--background`, `--primary`, ...) | Nuevos (`--paper`, `--ink`, `--pri`, ...) |

Seis de las nueve pantallas de cada una se capturaron en local a 1360 px y a 390 px: ninguna tiene desplazamiento
horizontal ni errores de JavaScript. Las otras tres (variantes por negocio, formulario y acceso) no se revisaron en
captura.

## Lo que salió mal en el concurso

Las dos propuestas llegaron al mismo concepto: "libro de caja", cifras en IBM Plex Mono, un solo color de marca
(petróleo) y ámbar solo para lo que pide acción. Son dos ejecuciones de una dirección, no dos direcciones. La causa
probable es el brief común, que ya fijaba paleta azul con acento ámbar y tipografía de datos; no está verificado si
además un subagente leyó el archivo del otro (compartían carpeta). Consecuencia: el CTO elige entre temperatura,
densidad y estructura, no entre dos mundos visuales. Si ninguna convence, hace falta una tercera propuesta con una
dirección distinta, hecha con un brief que no fije paleta ni tipografía.

## Defectos vistos en las capturas

- **B, punto de venta en celular:** con dos líneas en el carrito, el total queda cortado por la barra inferior y
  "Cobrar" queda fuera de la pantalla. La barra inferior y los botones de más y menos cambian la interacción, y el plan
  dice que en el punto de venta solo cambia la piel.
- **B:** "2 líneas" queda pegado al botón "Cliente: General"; la acción principal del tablero es "Nueva compra" y el
  punto de venta queda último.
- **A:** las etiquetas del gráfico de 7 días son muy chicas; mezcla una tarjeta con secciones de filete; en el tablero
  de celular las acciones frecuentes quedan al final.
- **Las dos:** el contraste se calculó en la maqueta, no se midió con herramienta sobre el producto. Las cifras son
  inventadas y distintas entre sí.

## Deliberación (`/council`, 2026-11-10)

Cuatro voces. Las tres externas recibieron la descripción de las diferencias escrita por el chairman, que ya nombraba
el defecto de "Cobrar" en B: hay sesgo de anclaje y la unanimidad vale menos de lo que parece.

- **Chairman (posición previa):** base A. El punto de venta de A respeta "solo piel"; sus controles y su texto son más
  grandes para celulares baratos; sus tokens conservan los nombres actuales y se portan cambiando un archivo.
- **Escéptico:** base A con el contenido de B en el tablero, sin su CSS. Las 31 pruebas E2E son la prueba de que el
  punto de venta quedó intacto, y pesan más que el voto estético. El vendedor debería caer en el punto de venta, no en
  el tablero.
- **Pragmático:** base A. Renombrar tokens obliga a tocar los 121 componentes; el manual y la capacitación dependen de
  que "Cobrar" no cambie de lugar.
- **Crítico:** base A. Antes de copiar el tablero de B hay que comprobar que sus datos existen (ventas por caja,
  monto de la diferencia de caja); la utilidad no debe verse sin el permiso `ver_costos`.

**Recomendación:** base A, con tres cosas de B solo en el tablero: los avisos con detalle y un botón por aviso, la
tabla de cajas abiertas con las ventas de cada una, y el stock bajo como tabla compacta. Nada del punto de venta de B.

**Disenso más fuerte:** un híbrido es un tercer diseño que nadie vio; por eso lo que se toma de B es contenido y no
estilo.

## Lo que falta

- Implementación por tramos (R1 a R5 del plan), en ramas empujadas sin PR; los PR se abren desde el 2026-12-01.
- Por verificar antes de construir el tablero: que las ventas por caja abierta y el monto de la diferencia de una caja
  cerrada salgan de consultas que ya existen (`sesionesAbiertas`, `listarCajaPorRevisar`); el plan no admite una RPC
  nueva para el tablero.
- El contraste AA se mide sobre el producto con `accesibilidad.spec.ts`, no sobre la maqueta.
- Ya resuelto en el código actual y que no cambia: el vendedor sin permisos de panel entra directo al punto de venta
  (`PERMISOS_PANEL` en `web/src/modules/usuarios/domain.ts`).
