# Migración de datos

El arranque carga los 597 productos de Lider con un script repetible, sin precios: el cliente los carga en el panel
(CTO, 2026-11-01). Solo la planilla de carga es fuente; lo que no pase las reglas va a un reporte de rechazos.

## Estado de las fuentes (2026-11-01)

| Negocio | Datos | Falta |
|---|---|---|
| Lider | 597 productos con stock y ubicación | Precios, costos, stock mínimo, series, clientes, usuarios, saldos de crédito |
| Lavandería | Solo respuestas del formulario | Hoja `Servicios` con precios, usuarios |
| Frial | Nada | Se carga cuando abra |

## Reglas de limpieza de `Productos`

Filas numeradas como en Sheets. Cada regla es una función pura de `scripts/importacion/src/reglas.ts` con su prueba.
Las cifras son de la corrida local del 2026-11-01 sobre la planilla real.

| Regla | Filas | Tratamiento aplicado |
|---|---|---|
| Ejemplos | 2, 3 | Se excluyen, por número de fila. También los 2 ejemplos de `Números de serie` (esa hoja no se importa) |
| Fila suelta | 602, solo "598" | Se excluye toda fila con un solo valor. Las filas sin ningún valor no cuentan como datos |
| Espacios | 54 campos | `trim` y colapso de espacios en descripción, marca, modelo y categoría. El código interno solo lleva `trim` |
| Marca o modelo "--" | 185 campos | Se guardan vacíos (null) |
| Código interno | "1" a "597" | Se conserva como texto (P-05). Repetido: se rechaza la fila repetida, con motivo `codigo_repetido` |
| Código de barras | ver abajo | Siempre texto |
| Código de barras repetido | 19 filas | Conserva la primera fila y deja vacío el código en las demás, con aviso `barras_repetida`. El cliente decide cuál queda |
| Posibles duplicados | 13 grupos | No se unen. Solo se listan en el reporte, con sus filas |
| Categorías | 53 en uso | Solo las usadas, con `trim`, unidas por nombre sin distinguir mayúsculas. Sin mapa de parecidas: el reporte avisa los pares (2) |
| Sin ubicación | 26 filas, 86 unidades | "Tienda", con aviso `sin_ubicacion`. Una ubicación que no es tienda ni depósito también va a "Tienda", con aviso `ubicacion_desconocida` |
| Stock | | Número >= 0 sin decimales (todo producto importado es `unidad`). Vacío es 0. Decimal o texto: se rechaza la fila (`stock_decimal`, `stock_invalido`). Con separador de miles (`1.000`, `2,000`: ¿mil o uno?) también se rechaza, con `stock_ambiguo`: el cliente lo corrige en la planilla |
| Fotos | 292 en filas 5 a 296 | **Pendiente**: fuera de la importación. El xlsx las trae embebidas; hay que extraerlas y subirlas a Storage en otro PR |

### Código de barras

| Valor | Tratamiento |
|---|---|
| Vacío | Sin código |
| Solo dígitos (texto) | Se conserva tal cual, con ceros iniciales. Los cortos (25, 35...) también |
| EAN-13 con dígito verificador inválido | Se conserva y se avisa (`ean13_digito_invalido`, 18 filas): viene como texto exacto, no es un daño de conversión |
| Notación científica ("7.75E+12") o número de celda de 12 o más dígitos | Se rechaza **el código**, no el producto (`barras_notacion_cientifica`, 1 fila). Un código dañado es peor que ninguno; se reescanea |
| Número de celda corto | Se conserva como texto, con aviso `barras_numerico`: pudo perder ceros iniciales antes de llegar |
| Una palabra alfanumérica con al menos un dígito (`ab12cd`) | **Decisión del script**: se conserva como código, con aviso `barras_alfanumerico` (50 filas). Puede ser un Code 128 o una serie mal puesta; descartarlo perdería el dato y conservarlo no estorba |
| Dígitos con espacios ("750 123 456") | Se quitan los espacios y se trata como numérico (corrección `barras_espacios`) |
| Texto con espacios o símbolos ("aro 20/29") | Si `modelo` está vacío, pasa a `modelo` (corrección `barras_a_modelo`). Si no, se descarta el código y queda vacío con aviso `barras_no_numerico_descartado` (7 filas) |

`Código de barras` se lee como texto en toda la importación. Nunca como número: una celda numérica se detecta y se trata
como arriba.

## Lo que debe hacer o entregar el cliente antes

1. Cargar en `/panel/precios` contado, crédito, mayorista y mínimo, y marcar qué productos van en USD.
2. Cargar ahí los costos, aunque sean aproximados. Sin costo, ganancia y valor del stock no dan cifras útiles.
3. Stock mínimo, al menos por categoría.
4. Qué productos llevan serie, y las series en stock.
5. Decisiones sobre duplicados y categorías.
6. Usuarios de los 3 negocios.
7. Servicios y precios de lavandería.
8. Saldos de crédito activos (Entrega B).

## Uso del script

`scripts/importacion/` es un paquete aparte de `web/` (usa `service_role`, que nunca entra en `web/`). Node 24, `pnpm install`.
Sin datos reales en el repo: el archivo es un argumento y el reporte se escribe donde se indique.

```bash
cd scripts/importacion
# Seco: no toca la base ni necesita variables de entorno. Solo reporte.
node src/main.ts --archivo <carga-lider.xlsx> --negocio <uuid> --seco --reporte <ruta.json>
# Real: URL y clave solo por entorno, nunca por argumento.
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node src/main.ts --archivo <xlsx> --negocio <uuid> --reporte <ruta.json> --esperadas 597
```

- `--negocio` es el id del negocio. Las ubicaciones se buscan por nombre dentro de él ("Tienda", "Depósito"); si falta una
  que el plan usa, el script falla antes de escribir.
- Una URL que no sea local (`localhost`, `127.0.0.1`, `::1`) exige `--produccion`.
- `--reporte` es obligatorio y debe quedar **fuera de cualquier repo git** (el script sube buscando `.git` y se niega,
  antes de tocar la base). Se escribe con modo 0600, también si ya existía. `.gitignore` excluye `reporte-importacion-*.json`
  solo como red. El reporte lista, por número de fila y motivo, las excluidas, las rechazadas y los avisos, sin valores;
  la consola muestra solo conteos (por motivo).
- `--esperadas <n>` (opcional): las filas que debe dar la planilla. Si aceptadas + rechazadas no es n, la conciliación da DIF.
- Código de salida: 0 todo cuadra, 1 error de uso o de ejecución, 2 la conciliación tiene diferencias.
- Lotes de 200, sin transacción única: si se corta, se vuelve a correr.
- `categorias` y `productos` se insertan directo con `service_role`: son catálogo, no contabilidad. La migración
  `20261101170000_importacion_service_role` le da solo esos `insert`. El stock inicial entra por la RPC
  `registrar_stock_inicial(negocio, items)` (solo `service_role`, hasta 500 items por llamada; el script manda 200): el
  kardex no se escribe directo. El trigger crea `stock` y `auditoria`; los productos importados quedan auditados con
  `usuario_id` null.
- Sin precios ni costos (los carga el cliente en el panel). El stock entra como movimiento `inicial` con
  `ref_tipo = 'importacion'` y sin costo. Cantidad 0 no genera movimiento.

Idempotencia: el producto se identifica por `(negocio_id, codigo)`; si existe, no se toca y se cuenta como "ya existía".
El stock inicial es idempotente **por producto**: si el producto ya tiene un movimiento `inicial` en cualquier ubicación,
la RPC lo omite completo (cuenta como "ya existía"). Así reimportar tras corregir una ubicación no duplica stock; para
cambiar el stock de un producto ya importado se usa un ajuste, no la importación. Una segunda corrida no cambia nada. Un
código de barras que ya tenga otro producto del negocio deja el producto nuevo sin código (`barrasEnConflicto`).

Pruebas: `pnpm test` (reglas, plan, lectura y reporte, con fixtures sintéticos) y `pnpm test:integracion` (Supabase local, xlsx
generado en la prueba, corridas repetidas, conciliación en un negocio con productos previos). pgTAP cubre la RPC
(`supabase/tests/rpc-registrar-stock-inicial.sql`). CI corre las tres.

## Proceso

1. Corrida seca y revisión del reporte con el cliente.
2. Corrida real en el proyecto de prueba; la segunda corrida debe dar 0 creados.
3. Revisar el reporte con el cliente: duplicados, categorías parecidas, barras repetidas, ubicaciones por defecto.
4. Producción (fase 6) con `--produccion`. Es idempotente por `(negocio_id, codigo)`.
5. Conciliar.

## Conciliación

El script la calcula al final de cada corrida real, en el reporte y en consola. Los controles de stock importado y de
auditoría se limitan a los productos de este archivo (por `codigo` dentro del negocio): productos previos del negocio no
mueven el resultado. El control `stock` = kardex sí es del negocio entero. Con `--esperadas 597` se suma el control de filas.

| Control | Esperado | Corrida local 2026-11-01 |
|---|---|---|
| Filas de datos = aceptadas + rechazadas + excluidas | 600 = 597 + 0 + 3 | Cuadra |
| Stock inicial de este archivo en la base = stock aceptado | Entero exacto; rechazado y fuente quedan en el reporte | 2.633 = 2.633 (rechazado 0) |
| Stock tienda y depósito | 934 y 1.613, más las 86 unidades sin ubicación | Tienda 1.020 (934 + 86 por defecto), Depósito 1.613 |
| `stock` = suma de movimientos | Sin diferencias | 0 diferencias |
| Productos auditados con usuario | 0 (no hay sesión) | 0 |
| Fotos | 292 asociadas | Pendiente (fuera de este PR) |

## Arranque

1. Conteo físico cerca de la fecha de salida (P-17). Sus diferencias entran como ajustes.
2. Crear usuarios, dispositivos y cajas.
3. Operar en paralelo con el cuaderno 3 días.
4. Comparar ventas, caja y stock contra el cuaderno.
5. Dejar el cuaderno y firmar el acta.

Plan de vuelta atrás: hasta el fin del paralelo, el cuaderno sigue siendo el registro oficial.

## Datos personales

- Las planillas tienen hoy acceso "Cualquier persona con el enlace". Pasarlas a Restringido cuando termine la carga.
- Los exportados de trabajo no se suben al repo.
- `scripts/importacion/` no contiene datos reales. Los reportes de corrida listan filas del cliente: fuera del repo.
