# Plan — Fase 1: Catálogo e inventario

Objetivo: productos, precios en USD o Bs, tipo de cambio, kardex, stock por ubicación, auditoría e importación de Lider.
Requisitos: RF-CAT-*, RF-INV-*, RF-MIG-*, RF-TR-09. Casos: DB-02, DB-04, DB-07, DB-09, DB-10, DB-12, DB-16, DB-17, DB-27
y E2E-03 completo. Implementa Sonnet; el chairman revisa, verifica y cierra. Todo local.

## Decisión del CTO (2026-11-01)

**El cliente carga sus precios en el sistema.** La importación trae productos y stock sin precios, y ya no espera a nadie.
Consecuencias:

- Hace falta una pantalla de edición masiva: 597 productos por 4 listas no se cargan de a uno (RF-CAT-11).
- Un producto sin precio se puede listar, no vender. El filtro "sin precio" muestra cuánto falta.
- El costo también se carga en el sistema, y el kardex es append-only: se registra con un movimiento `ajuste_costo`.
- P-01 a P-05 ya no bloquean la importación: el script corre con los supuestos del SRS y es repetible.

## PRs, en orden

| # | Rama | Contenido | Se comprueba con |
|---|---|---|---|
| 1 | `feat/catalogo-datos` | Categorías, productos, precios, tipos de cambio, auditoría, RPC | pgTAP: DB-07, DB-09, DB-27 |
| 2 | `feat/kardex` | Kardex, stock, series, conteos, RPC de inventario | pgTAP: DB-02, DB-04, DB-10, DB-12, DB-16, DB-17 |
| 3 | `feat/catalogo-panel` | Productos, categorías, fotos, tipo de cambio, precios masivos | E2E de catálogo y precios |
| 4 | `feat/inventario-panel` | Stock, kardex, entrada, salida, traslado, conteo, stock bajo | E2E-03 y E2E de inventario |
| 5 | `feat/importacion` | `scripts/importacion/`, reglas, reporte, conciliación | Vitest por regla y corrida local con la planilla real |

## Decisiones

### Datos

- **Escritura solo por RPC**, también en catálogo: un producto y sus precios se guardan en una transacción. Las tablas
  dan `select` a `authenticated` y ninguna escritura.
- **RPC nuevas sobre el catálogo original:** `guardar_categoria`, `guardar_producto`, `desactivar_producto`,
  `guardar_precios` (lote, máximo 200 productos), `registrar_series`, `fijar_costos`.
- **`producto_precios` lleva `negocio_id`,** para RLS y auditoría. FK compuesta `(negocio_id, producto_id)`, así una fila
  no apunta a un producto de otro negocio. Mismo patrón en `movimientos_inventario`, `stock` y `series`.
- **Una sola fórmula de Bs:** la vista `producto_precios_bs` (`security_invoker`) calcula `round(monto * tipo_cambio, 2)`;
  `precio_bs` lee de ella. Sin tipo de cambio o sin precio devuelve null, nunca 0.
- **Moneda:** la columna es por fila, la pantalla asigna la misma a todas las listas de un producto.
- **Listas por tipo de negocio** en `domain.ts`: tienda y frial `contado`, `credito`, `mayorista`, `minimo`; lavandería
  `normal`, `express`.
- **Tipos de producto por negocio:** tienda y frial `producto`; lavandería `servicio` e `insumo`.
- **Costos ocultos por columna.** RLS filtra filas, no columnas, y un vendedor lee `stock`. Por eso `authenticated` no tiene
  `select` sobre `stock.costo_promedio` ni `movimientos_inventario.costo_unitario`. Se leen por `costos_stock(negocio_id)` y
  `kardex_producto(...)`, que devuelven el costo solo con `ver_costos`.
- **`stock.costo_promedio` es `numeric(12,4)`:** a 2 decimales el promedio deriva. La venta seguirá guardando foto a 2.
- **Promedio dentro del `on conflict do update`** del trigger, para leer la fila vigente con ventas concurrentes. Stock
  previo negativo cuenta como 0; costo previo desconocido toma el costo nuevo.
- **`ajuste_costo`:** tipo nuevo de movimiento, `cantidad = 0`, fija `costo_promedio`. Es el único tipo con cantidad 0.
  `fijar_costos` exige `ajustar_inventario` y `ver_costos`.
- **Operaciones de inventario idempotentes.** `registrar_entrada`, `ajustar_inventario`, `trasladar_stock` y
  `registrar_conteo` reciben `p_operacion_id` generado al abrir el formulario. Índice único parcial sobre
  `(ref_id, producto_id, ubicacion_id, tipo)`. Reintentar no duplica stock.
- **Traslado** lleva el costo promedio del origen, así el valor total no cambia. Con stock insuficiente se permite (RN-04):
  la pantalla avisa.
- **Producto en `unidad`:** `cantidad` entera, la RPC rechaza decimales. Un `servicio` no genera movimientos.
- **Series:** `registrar_series` carga números para unidades ya existentes, separado de la entrada, porque los productos
  importados ya tienen stock. Traslados y salidas de productos con serie exigen `serie_ids` en igual cantidad.
- **Stock bajo:** suma de ubicaciones contra `stock_minimo`. Null no avisa.
- **`stock_inconsistente(negocio_id)`:** devuelve diferencias entre `stock` y la suma del kardex (RF-INV-08), con `ver_reportes`.

### Auditoría (RF-TR-09)

- `auditoria` es append-only, con `negocio_id` nullable (`rol_permisos` no tiene negocio).
- Trigger genérico sobre `productos`, `producto_precios`, `tipos_cambio`, `usuario_negocio` y `rol_permisos`.
- Se lee con `ver_reportes`. Sin pantalla en esta fase; los reportes llegan en la fase 5.
- Desactivar una cuenta pasa por la API admin, donde `auth.uid()` es null. `admin-usuarios` llama `auditar_cuenta` con `service_role`
  (solo ese rol la ejecuta), pasando el id verificado del llamador, tras el baneo, y deja una fila por negocio de esa cuenta.

### Fotos

Bucket privado `productos` creado por migración, 5 MB, solo JPEG, PNG y WebP. Sin SVG, que ejecuta scripts. Ruta
`<negocio_id>/<producto_id>.<ext>`. Policies sobre `storage.objects`: leer con `mis_negocios()`, escribir con
`editar_productos`. URLs firmadas en lote. La CSP debe sumar el origen de Supabase a `img-src`.

### Pantallas

Sin bake-off: `impeccable`, tokens existentes y `lucide-react`. Gate `web-design-guidelines`.

| Ruta | Permiso | Contenido |
|---|---|---|
| `/panel/productos` | `editar_productos` o `ver_costos` | Lista paginada en servidor, filtros por categoría, marca, sin precio, inactivos; búsqueda por código, barras o texto |
| `/panel/productos/nuevo`, `/panel/productos/[id]` | `editar_productos` | Formulario, foto, activar y desactivar |
| `/panel/productos/categorias` | `editar_productos` | Crear y renombrar |
| `/panel/precios` | `editar_productos` | Grilla masiva, 50 por página, guarda solo lo cambiado, costo con `ver_costos` |
| `/panel/tipo-cambio` | `editar_productos` | Vigente, registrar nuevo, historial |
| `/panel/inventario` | `ajustar_inventario` o `ver_reportes` | Stock por ubicación, stock bajo |
| `/panel/inventario/[productoId]` | igual | Kardex |
| `/panel/inventario/entrada`, `salida`, `traslado`, `conteo` | `ajustar_inventario` | Operaciones |

### Importación

- `scripts/importacion/` es un paquete propio, fuera de `web/`, porque usa `service_role`. Sin datos reales.
- Lee el xlsx con `exceljs` y valida con Zod. Código de barras siempre como texto.
- Cada regla de `docs/migracion-datos.md` es una función pura con su prueba.
- `--seco` no escribe y genera el reporte. El reporte queda fuera del repo.
- Idempotente: `(negocio_id, codigo)` y un índice único parcial que admite un solo `inicial` por producto y ubicación.
- Barras repetidas: conserva la primera fila y deja vacías las demás, con aviso en el reporte, hasta que el cliente decida.
- Producción se ejecuta en la fase 6.

## Trampas

- Una tabla o función nueva sin `revoke` y `grant` explícitos rompe `supabase/tests/seguridad-generica.sql`.
- Las vistas exigen `grant` propio y `security_invoker`, o saltan RLS.
- CI usa cerca de 25 de los 30 logins por 5 minutos: las E2E nuevas reutilizan el estado de `auth.setup`, sin logins nuevos.
- Cada página de `/panel` llama su guarda.
- Server actions solo por `panel.ts`, para no entrar al bundle de `/pos`.
- Bucket de Storage en migración, no en `config.toml`, para que producción lo reciba igual.
- El snapshot del POS debe cambiar de versión con un tipo de cambio nuevo: se resuelve en `catalogo_pos`, fase 2 o 3.

## Fuera de esta fase

- `catalogo_pos` y búsqueda en POS: fases 2 y 3. E2E-08 también.
- Pantalla de auditoría y reporte de reconciliación: fase 5.
- CRUD de ubicaciones: se crean por script y seed. Son 2 en Lider y 1 en los demás.
- Unir duplicados, marcas y categorías parecidas: esperan al cliente; el reporte los lista.
- Venta con serie (DB-15): fase 2.

## Verificación

- CI verde en cada PR.
- `stock` = suma del kardex tras una secuencia mixta.
- Vendedor no lee costos ni por API.
- Corrida local con la planilla real: 597 entre importados y rechazados, 2.633 unidades menos lo rechazado.
- Pantallas verificadas en navegador real, en PC y celular.
