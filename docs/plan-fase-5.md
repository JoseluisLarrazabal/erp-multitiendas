# Plan — Fase 5: frial, reportes y PWA

Objetivo: el frial vende por peso y por paquete, registra lotes con vencimiento y mermas; los tres negocios tienen sus
reportes en pantalla y en Excel; el panel se usa desde el celular y la app se instala. Requisitos: RF-FRI-01 a 07,
RF-REP-01 a 05, RF-TR-06, RF-TR-07, RN-06. Casos: DB-11, E2E-10, E2E-11. Implementa Sonnet; el chairman revisa,
verifica y cierra.

## PRs, en orden

| # | Rama | Contenido | Se comprueba con |
|---|---|---|---|
| 1 | `feat/frial-datos` | `productos.peso_paquete_kg`, tabla `lotes`, RPC `registrar_entrada_lote` y `lotes_por_vencer`, movimiento `merma`; seed del frial | pgTAP: DB-11, lotes, saldo estimado, merma |
| 2 | `feat/frial-ui` | Entrada con lote y vencimiento, salida por merma, página de vencimientos, peso del paquete en el producto, POS del frial | Vitest; E2E-10 y E2E de lote y merma |
| 3 | `feat/reportes-datos` | RPC `reporte_ventas`, `reporte_stock`, `reporte_caja` | pgTAP de cada reporte, permisos y ganancia |
| 4 | `feat/reportes-panel` | `/panel/reportes` por tipo de negocio, filtros de fecha, tablas, Excel; Excel también en el kardex | Vitest; E2E-11 y E2E de permisos |
| 5 | `feat/pwa-responsive` | Manifiestos e íconos del POS y del panel; tablas sin desborde a 390 px | E2E de manifiesto y de ancho en cada ruta del panel |

## Decisiones

### Paquete al vacío (RF-FRI-04)

Los tres casos ya entran en `productos.unidad`, con un solo agregado:

- **Peso variable:** producto con unidad `kg`. El cajero escribe lo que pesa. Ya funciona.
- **Por unidad:** producto con unidad `unidad`. Ya funciona.
- **Peso fijo:** producto con unidad `unidad` y `peso_paquete_kg numeric(12,3)`, mayor que 0. Se cobra por paquete y el
  stock va en paquetes. La columna solo sirve para que el reporte del frial sume kilos vendidos (RF-REP-03). Un `check`
  la prohíbe con unidad `kg`.
- **Límite aceptado:** el reporte usa el peso actual del producto, no una foto. Cambiar el peso de un paquete ya vendido
  cambia los kilos de ventas pasadas. Es raro: un paquete distinto debería ser otro producto. Lo dice la ayuda del
  campo.

### Lotes (RF-FRI-05 y 06)

- Tabla `lotes`: `id`, `negocio_id`, `producto_id`, `ubicacion_id`, `codigo` (de 1 a 40 caracteres), `vence` (date),
  `cantidad`, `movimiento_id` (la entrada que lo creó), `usuario_id` y `created_at`. Append-only con
  `rechazar_modificacion()`, RLS de select por `mis_negocios()` y sin escritura directa.
- `registrar_entrada_lote(p_operacion_id, p_negocio_id, p_producto_id, p_ubicacion_id, p_cantidad, p_costo_unitario,
  p_motivo, p_lote, p_vence)` es una RPC nueva. Hace la entrada con la misma lógica de `registrar_entrada`, idempotente
  por la misma operación, y crea el lote. No se cambia la firma de `registrar_entrada`: sumar parámetros con default
  crea una sobrecarga ambigua para PostgREST.
- El producto no puede tener series. `vence` no puede ser anterior a hoy (La Paz).
- **El saldo del lote se estima, no se descuenta.** La venta no elige lote: el cajero no sabe de qué lote sale cada
  corte, y cambiar `registrar_venta` y la cola sin conexión por esto no vale la pena. El saldo se calcula con FIFO
  por producto en todo el negocio, no por ubicación: así un traslado no lo cambia. Saldo de un lote = su cantidad,
  limitada a `stock total − entradas más nuevas`. Las entradas más nuevas son las de tipo `inicial`, `compra` o
  `entrada` posteriores a la del lote, tengan lote o no. Así el stock que entró sin lote también desplaza a los lotes
  viejos. Las mermas y ventas bajan el stock, y con eso el saldo, sin escribir nada en `lotes`. Una operación que ya
  existe como entrada sin lote no acepta un lote después (`ERP_OPERACION_REPETIDA`).
- `lotes_por_vencer(p_negocio_id, p_dias int default 7)` devuelve los lotes con saldo estimado mayor que 0 y `vence`
  hasta hoy + `p_dias`, vencidos incluidos, con producto, ubicación, días restantes y saldo. Permiso
  `ajustar_inventario` o `ver_reportes`. Hoy es la fecha de La Paz.

### Mermas (RF-FRI-07)

- Nuevo tipo de movimiento `merma`: se suma al `check` de `movimientos_inventario.tipo` y a los tipos que acepta
  `ajustar_inventario`, solo en negocios de tipo `frial`. Siempre negativo. Motivo obligatorio y permiso `ajustar_inventario`, como `danado`.
- Revisar cada lugar que filtra por tipo (trigger de stock, costo promedio, kardex, etiquetas en TypeScript) para que
  `merma` se trate igual que `danado`.

### Reportes (RF-REP-01 a 05)

**Se agregan en el servidor.** Una RPC `security definer` por familia, con permiso `ver_reportes` sobre el negocio.
Devuelven `jsonb` (`{ filas, totales }`): una función que devuelve filas pasa por el `max_rows` de 1.000 de PostgREST y
se truncaría en silencio. Tope de 5.000 filas; si se pasa, `ERP_LOTE_GRANDE`. Rango de fechas de hasta 366 días,
fechas en hora de La Paz y ambos días incluidos.

| RPC | Agrupa por | Columnas |
|---|---|---|
| `reporte_ventas(p_negocio_id, p_desde, p_hasta, p_agrupar)` | `dia`, `vendedor`, `producto`, `categoria`, `marca` | ventas, cantidad, kg, bruto, devuelto, neto; costo y ganancia solo con `ver_costos` |
| `reporte_stock(p_negocio_id, p_dias_sin_movimiento default 30)` | producto | stock total, mínimo, stock bajo, última venta, sin movimiento; valor solo con `ver_costos` |
| `reporte_caja(p_negocio_id, p_desde, p_hasta)` | sesión de caja | equipo, cajero, apertura, cierre, ventas en efectivo, QR, ingresos y egresos, esperado, contado, diferencia |

- **Qué cuenta como venta:** las no anuladas, con la misma fecha que muestra `/panel/ventas`. La devolución resta en su
  propia fecha, atribuida al vendedor y al producto de la línea original, como hace la caja.
- **Ganancia (RN-06):** neto menos `cantidad × venta_items.costo_unitario`, que es la foto del costo. En devoluciones,
  la parte devuelta resta con ese mismo costo. Una línea sin costo (producto sin costo cargado) no suma ganancia y se
  cuenta en `totales.lineas_sin_costo`, para que el reporte avise que la ganancia está incompleta. Sin `ver_costos`,
  `costo` y `ganancia` vuelven nulos.
- **Kilos:** cantidad de líneas con unidad `kg`, más paquetes × `peso_paquete_kg`. En la lavandería, los kilos de
  servicio (RF-REP-02).
- **Más vendidos** es `reporte_ventas` por producto ordenado por cantidad o neto. **Sin movimiento** y **stock bajo**
  son filtros de `reporte_stock`. **Kardex** es la vista que ya existe, más Excel. No hay RPC aparte para estos.
- `reporte_caja` reutiliza los cálculos de `efectivo_esperado` y `resumen_caja`; no repite fórmulas.

**Qué ve cada negocio** (RF-REP-01 a 03): la página arma la lista de reportes según el tipo.

| Tienda | Lavandería | Frial |
|---|---|---|
| Ventas por día, vendedor, producto, categoría y marca; más vendidos; ganancia; stock, valor, sin movimiento, stock bajo; caja | Ingresos por día y por servicio, kilos, caja | Ventas por día, por corte con kg, stock, por vencer, caja |

### Panel de reportes y Excel (RF-REP-04)

- `/panel/reportes?r=<reporte>&desde=&hasta=&negocio=`. Filtros en la URL y validados con Zod, como el resto del panel.
  Atajos: hoy, este mes y mes anterior.
- La tabla se arma en el servidor. El botón Excel genera el archivo en el navegador con las mismas filas ya cargadas:
  no hace falta otro endpoint ni otra consulta.
- **Librería:** `write-excel-file` (MIT, solo escribe, corre en el navegador). Antes de agregarla, el PR 4 comprueba
  licencia, tamaño, última versión y si tiene avisos de seguridad. `xlsx` (SheetJS) queda descartado: la versión de npm
  está congelada en 0.18.5 con avisos conocidos. Si `write-excel-file` no pasa, se usa `exceljs`, y se deja escrito el
  motivo en `docs/stack.md`.
- Montos con formato `#,##0.00`, kilos con `0.000` y fechas como fecha, no como texto.
- **Inyección de fórmulas (cambio del PR 4):** no se antepone apóstrofo. `write-excel-file` escribe cada texto como
  shared string (`t="s"`), y Excel y LibreOffice nunca lo evalúan como fórmula. El apóstrofo quedaría visible y
  alteraría datos legítimos ("-3 rotos"). Un test verifica que `=1+1` sale como celda de texto. El riesgo que queda es
  que alguien vuelva a guardar el archivo como CSV y lo abra en otro programa: no se cubre.
- **CSP:** `worker-src 'self' blob:` (CTO, 2026-11-02). `fflate` comprime las hojas de más de 160 KB en un worker creado
  desde un Blob; sin `blob:`, el Excel del stock de Lider fallaría.
- **Kardex:** se exporta completo, hasta 5.000 movimientos, no solo la página visible.
- Nombre del archivo: `<reporte>-<negocio>-<desde>-<hasta>.xlsx`, sin acentos ni espacios.
- Menú: Reportes con `ver_reportes`. Ganancia y valor del stock no aparecen sin `ver_costos`.

### PWA (RF-TR-07)

- Dos manifiestos estáticos en `web/public/`:
  - `pos.webmanifest` ("Caja", `start_url` `/pos`, `scope` `/pos`).
  - `panel.webmanifest` ("Panel", `start_url` `/panel`, `scope` `/panel`).
- Cada layout lo enlaza con `metadata.manifest`. Son dos apps instalables: el empleado instala la caja y el dueño, el
  panel. Un solo manifiesto con scope `/` obligaría a elegir un solo `start_url`.
- Íconos de 192, 512 y 512 maskable, `apple-touch-icon` de 180 y favicon. Un monograma simple con los colores del tema,
  hecho en SVG y convertido a PNG por un script. Sin marca del cliente: no hay logo.
- El panel sigue sin service worker (decisión del 2026-10-26). **No verificado:** si Chrome instala sin service worker
  en Android y escritorio. Se comprueba en el PR 5 con DevTools (Application, Manifest, Installability). Si exige uno,
  se vuelve al CTO antes de agregarlo, porque cambia esa decisión.
- `proxy.ts` debe dejar pasar los manifiestos y los íconos sin sesión. Si no, la instalación pide login y falla.
- `display: standalone`, `theme_color` y `background_color` del tema, `lang: es-BO`.

### Panel responsive (RF-TR-06)

- El menú móvil ya existe. Falta lo de adentro: tablas en un contenedor con `overflow-x-auto`, filtros que se apilan y
  botones que no se cortan.
- Un E2E recorre cada ruta del panel a 390 px y exige `scrollWidth <= clientWidth` del documento. Reemplaza al chequeo
  suelto de `reconciliacion.spec.ts`.
- UI por camino único: `impeccable` y el estilo que ya tiene el panel; gate `web-design-guidelines`.

## Trampas

- Cambiar el `check` del kardex exige `drop constraint` y `add constraint` en la misma migración. La tabla sigue siendo
  append-only.
- Revisar con `grep` los tipos de movimiento en TypeScript (etiquetas, esquemas Zod y filtros del kardex) al sumar
  `merma`.
- `venta_items.costo_unitario` no tiene grant de select a propósito. La ganancia solo sale por la RPC.
- Fechas: usar la zona `America/La_Paz` en SQL, no la del servidor ni la de Vercel.
- Tipos con `pnpm db:types` después de cada migración.
- Migración en staging antes del deploy que la usa.
- Seed solo local, nunca en staging: equipo `F1` del frial, un producto de peso fijo y lotes con fechas relativas a hoy.
- Los specs E2E del frial usan su propio equipo, para no chocar con la caja de la tienda (aprendido en la fase 4).
- La descarga del E2E-11 se lee con `read-excel-file` como dependencia solo de desarrollo.
- Un archivo bajo `/pos` en `public/` caería bajo el scope del service worker. Los manifiestos van en la raíz de
  `public/`.

## Fuera de esta fase

Gráficos, consolidado entre negocios (descartado), despiece, elegir lote al vender, balanza, reportes por correo o
programados, PDF de reportes y logo del cliente.

## Verificación

- pgTAP, Vitest, E2E y build en verde en cada PR. `/code-review` y `/ponytail-review` en todos. `/security-review` en
  los PRs 1, 3 y 4 (RPC nuevas, costos y archivo generado con datos del cliente).
- DB-11: 1,255 kg a Bs 59,99 se guardan con 3 decimales y suman 75,29.
- E2E-10: venta de un corte por peso en el POS del frial; el kardex baja 1,255 kg.
- E2E-11: descargar un reporte, leer el archivo y encontrar las filas que muestra la pantalla.
- La ganancia no aparece para el vendedor, ni en la RPC ni en la pantalla.
- Tras cada merge: producción con Playwright, sin sesión; manifiestos e íconos responden 200.
- Codex: no verificado (sin cuota hasta el 2026-11-16).
