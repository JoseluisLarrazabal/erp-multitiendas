# Plan de implementación del rediseño (fase 3.3)

Baja a pasos la fase 3.3 de `docs/plan-paralelo-rediseno.md`. La dirección visual ya está decidida
(`docs/rediseno-propuestas.md`): base de la propuesta A en todo el producto, más tres piezas del tablero de B. Plan
redactado por Opus el 2026-11-10 sobre el código real y validado por el chairman; lo marcado "no verificado" no se
comprobó.

Maquetas y capturas de referencia, fuera del repo: `~/.cache/erp-recupera/rediseno/` (`propuesta-a.html`,
`propuesta-b.html`, `cap/*.png`). Publicadas en los enlaces de `docs/rediseno-propuestas.md`.

## Decisiones del chairman sobre lo que el plan dejó abierto

- "Ayer a esta hora" no existe (no hay ventas por hora): el tablero dice "Ayer, día completo: Bs X", sin porcentaje.
- Cajas abiertas: se agrega `abierta_en` a la lectura de sesiones y se cruza con `reporte_caja`. La columna se rotula
  "Cobrado en ventas" (efectivo más QR; no incluye ventas a crédito).
- El aviso "caja cerrada con diferencia" de la maqueta B queda fuera: no hay marca de "revisada" y pediría una regla
  nueva. Avisos del tablero: ventas por reconciliar, movimientos de caja por revisar, lotes por vencer (frial) y órdenes
  listas sin recoger (lavandería).
- "Por cobrar esta semana" se omite: solo se podría aproximar.
- "Por pagar a proveedores" usa solo la RPC de deudas, para no pasar de unas 11 consultas por carga.
- Los iconos de la aplicación pasan al color primario nuevo en R4.

## Restricciones duras (todos los tramos)

- No tocar `@page` ni `.nota-80` de `web/src/app/globals.css` (impresión del ticket), ni `nota-venta.tsx`,
  `plan-cuotas-imprimible.tsx` y `catalogo/foto.ts:29` en lo que hace al color.
- Conservar los nombres accesibles "Principal", "Abrir menú", "Cerrar menú", "Inicio" y
  `data-testid="aviso-por-revisar"`. Las specs E2E se apoyan en `getByRole` y `getByLabel`: una spec solo se toca si el
  cambio lo obliga, y se dice cuál y por qué.
- En el punto de venta cambia la piel, no el flujo ni el orden de los pasos.
- El tablero solo lee, sin RPC nueva. `service_role` nunca entra en `web/`.
- Solo tema claro. Contraste AA. E2E-08 (búsqueda del punto de venta) bajo 200 ms.
- Nada de `<link>` a Google Fonts: la CSP solo admite `'self'` y Supabase. Las fuentes van por `next/font/google`.

## R1, base

**`web/src/app/globals.css`** (solo las líneas 1 a 65):

```css
:root{color-scheme:light;
 --background:#f4f2ee;--foreground:#1d2321;--card:#fff;--card-foreground:#1d2321;
 --popover:#fff;--popover-foreground:#1d2321;--surface:#fbfaf7;
 --muted:#ebe8e1;--muted-foreground:#59615e;--border:#ddd9cf;--input:#868c88;
 --primary:#0e5e5a;--primary-foreground:#fff;--primary-hover:#0a4a47;
 --secondary:#dcefec;--secondary-foreground:#0a4a47;--accent:#dcefec;--accent-foreground:#0a4a47;
 --ring:#0e7c76;--warning:#8a5300;--warning-soft:#fdefd0;--warning-line:#e8c27a;
 --destructive:#a3281f;--destructive-soft:#fbe4e0;--success:#1c6b3b;--success-soft:#e0f0e5;
 --chart-bar:#5f9c97; /* 3,1:1 sobre card; el #9fc7c3 de la maqueta da 1,8:1 */
 --radius:0.5rem;}
@theme inline{ /* se conservan los mapeos actuales y se agregan: */
 --color-surface:var(--surface);--color-primary-hover:var(--primary-hover);
 --color-warning:var(--warning);--color-warning-soft:var(--warning-soft);--color-warning-line:var(--warning-line);
 --color-destructive-soft:var(--destructive-soft);--color-success:var(--success);--color-success-soft:var(--success-soft);
 --color-chart-bar:var(--chart-bar);
 --radius-lg:var(--radius);--radius-md:calc(var(--radius) - 2px);--radius-sm:calc(var(--radius) - 4px);
 --shadow-card:0 1px 2px rgb(29 35 33 / .06);
 --font-sans:var(--font-figtree),ui-sans-serif,system-ui,sans-serif;
 --font-mono:var(--font-plex-mono),ui-monospace,monospace;}
@utility cifra{font-family:var(--font-mono);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
```

`body` pasa a 15 px con interlínea 1,45. `--text-base` no se toca: los campos usan 16 px para que iOS no haga zoom.
Contraste calculado por el plan: texto apagado sobre el fondo 5,7:1; ámbar, rojo y verde sobre su fondo suave entre
5,5 y 6,0:1; blanco sobre el primario 7,6:1; borde de campos 3,07:1; anillo de foco 4,51:1.

**`web/src/app/layout.tsx`**: `Figtree({subsets:["latin"],variable:"--font-figtree",display:"swap"})` e
`IBM_Plex_Mono({subsets:["latin"],weight:["600"],variable:"--font-plex-mono"})`; `themeColor` a `#0e5e5a`. Inter ya se
carga con `next/font/google`, así que la CSP no cambia y las fuentes nuevas entran solas al precache del punto de venta
(`web/src/app/(pos)/sw-pos/[path]/route.ts:14`). Peso nuevo del precache: no verificado.

**Manifiestos** `web/public/panel.webmanifest` y `pos.webmanifest`: `theme_color #0e5e5a`, `background_color #f4f2ee`.

**Primitivos, `web/src/components/ui/`**

- `button.tsx`: `font-semibold`; `default` con `hover:bg-primary-hover`; `outline` con
  `border-input bg-card hover:bg-muted`; `destructive` con `bg-destructive-soft text-destructive`. Tamaños: `default`
  h-10 px-4, `sm` h-8 px-3, `lg` h-11 px-5 text-base, `icon` size-10, y uno nuevo `xl` h-14 text-lg para "Cobrar" (R4).
- `input.tsx`: de h-8 a h-10, `bg-card`, px-3. `select-nativo.tsx`: `bg-card`, px-3. `label.tsx`: `font-semibold`.
- `alert-dialog.tsx`: fondo de `bg-black/10` a `bg-foreground/40`.
- Nuevo `tabla.tsx`: `Tabla`, `Th` (12 px, seminegrita, color apagado, `border-b-2 border-foreground`) y `Td` (h-11,
  `border-b`). Nuevo `estado-vacio.tsx` (la clase `vacio` está repetida en 5 archivos).

**Menú, `web/src/components/panel/panel-items.ts`**

```ts
export const GRUPOS = ["Ventas","Inventario","Compras","Dinero","Configuración"] as const;
// Item suma grupo?: (typeof GRUPOS)[number]; Inicio queda sin grupo.
export const gruposVisibles = (permisos: readonly string[], tipo: string) => {
  const v = itemsVisibles(permisos, tipo);
  return GRUPOS.map((grupo) => ({ grupo, items: v.filter((i) => i.grupo === grupo) })).filter((g) => g.items.length);
};
```

Ventas: Ventas, Reconciliación, Clientes, Descuento, Órdenes. Inventario: Productos, Inventario, Precios. Compras:
Compras, Proveedores. Dinero: Cajas, Créditos, Tipo de cambio, Reportes. Configuración: Usuarios, Dispositivos, Datos
del negocio. Los iconos actuales ya son de `lucide-react` y se conservan. `itemsVisibles` e `itemDeRuta` no cambian.
Pruebas nuevas en `panel-nav.test.ts`: todo ítem salvo `/panel` tiene grupo; la unión de `gruposVisibles` más Inicio es
igual a `itemsVisibles` para varios conjuntos de permisos y los 3 tipos de negocio (garantía de que agrupar no cambia
qué ve cada rol); un grupo sin ítems no aparece.

**`panel-nav.tsx`**: Inicio suelto arriba; por grupo, `<p id>` con la etiqueta (12 px, seminegrita, apagado) y
`<ul aria-labelledby>`. Las etiquetas no son encabezados ni enfocables: no cambia el orden de Tab que mide
`panel-menu.spec.ts:24`. Ítem de 36 a 40 px y 14 px; activo con `bg-secondary` e icono `text-primary`.

**`panel-shell.tsx`**: menú de 232 px con `bg-surface`; se conservan la cabecera, `DolarParalelo`, los `aria-label` y
`<a href="/pos">`. **`catalogo/components/encabezado-pagina.tsx`**: h1 de 26 px negrita, descripción de 14 px,
`Seccion` con `shadow-card`.

**Color directo: 23 archivos** (el plan general decía 16). `shadow-[0_2px_5px_#34345a0d]` pasa a `shadow-card` en
`app/(auth)/layout.tsx`; `app/(panel)/panel/{page,usuarios/page,dispositivos/page,productos/nuevo/page,productos/[id]/page,productos/categorias/page}.tsx`;
`catalogo/components/{lista-productos,grilla-precios,encabezado-pagina}.tsx`; `usuarios/components/usuarios-tabla.tsx`;
`reportes/components/tabla-reporte.tsx`; `caja/components/lista-sesiones.tsx`;
`ventas/components/{lista-ventas,lista-ordenes}.tsx`; `compras/components/{proveedores-panel,lista-compras}.tsx`;
`creditos/components/{detalle-credito,tablas-cuentas}.tsx`; `clientes/components/clientes-panel.tsx`;
`inventario/components/{lista-kardex,lista-stock,lista-vencimientos}.tsx`. Además `alert-dialog.tsx:26` y
`layout.tsx:18`. `panel/page.tsx` lo reescribe R2.

**Verificación de R1**: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`;
`pnpm exec playwright test panel-menu contador usuarios catalogo ordenes-panel auth negocio accesibilidad responsive pos-venta pwa`;
`grep -rn "34345a0d\|bg-black/10\|5348e0" web/src web/public/*.webmanifest` sin resultados (salvo los iconos, que son
de R4); capturas a 390 y 1280 px de `/panel/productos` y del menú contra `cap/a-productos.png`.

## R2, tablero

Datos comprobados en el código:

| Bloque | Consulta | Permiso | Negocio |
| --- | --- | --- | --- |
| Ventas de hoy, ayer y 7 días, cantidad, utilidad | `leerReporte` con `r:"ventas"`, `agrupar:"dia"`, de hoy-6 a hoy: una llamada | `ver_reportes` | todos |
| Más vendidos | `reporte_ventas` con `agrupar:"producto"`, 7 días | `ver_reportes` | tienda y frial |
| Cajas abiertas | `sesionesAbiertas` (más `abierta_en`) y `reporte_caja` | `ver_reportes` | todos |
| Por revisar | `listarReconciliacion` y `listarCajaPorRevisar` | `ver_reportes` | todos |
| Stock bajo | RPC `productos_stock_bajo` | cualquier miembro; el bloque sigue al ítem Inventario | todos |
| Lotes por vencer | `leerLotesPorVencer(…, 7)` | `ajustar_inventario` o `ver_reportes` | frial |
| Cuotas vencidas | `cargarCuentas({soloVencidas:true, limite:200})` | `gestionar_credito` o `ver_reportes` | tienda y frial |
| Reservas activas | `cargarReservasActivas` | `gestionar_reservas` | tienda y frial |
| Por pagar a proveedores | RPC `deudas_proveedores` (ya la usa `listarProveedores`) | `gestionar_compras` | todos |
| Órdenes listas sin recoger | `listarOrdenes({estado:"lista"}, 50)` | miembro; el bloque sigue al ítem Órdenes | lavandería |

- Ventas: la fecha es la de llegada al servidor en hora de La Paz; los días sin ventas no vienen y se rellenan con 0;
  `ganancia` llega `null` sin `ver_costos`.
- Más vendidos: los 5 primeros por monto neto, en Bs. La lavandería no lo muestra.
- Cajas abiertas: `sesionesAbiertas` (`ventas/lecturas-panel.ts:30`) hoy solo trae `id` y `dispositivoId`; se agrega
  `abierta_en` (su tipo solo crece). Después `leerReporte({r:"caja", desde: día de la caja abierta más antigua, hasta:
  hoy})` filtrando `cerrada_en === null`. Columnas: equipo, cajero (`usuario_apertura`), hora, "Cobrado en ventas".
- Por revisar: el detalle del aviso de ventas sale de la primera fila más "y N más"; el de caja, de `detalle`, `monto` y
  `usuario`.
- Stock bajo: `contarStockBajo` solo cuenta. Se agrega `listarStockBajo(supabase, negocioId, 5)` en
  `inventario/queries.ts` con `{count:"exact"}`, `.order("cantidad")` y `.limit(5)`: total y 5 filas en una petición.
- Cuotas vencidas: con más de 200, "200+". Reservas: cantidad y suma de anticipos (exportar la función desde
  `ventas/panel.ts`). Proveedores: cantidad con deuda y suma. Órdenes: con más de 50, "50+"; aparte las de más de
  `DIAS_SIN_RECOGER`.
- Vacío: frase explícita por bloque; los avisos devuelven `null`. Error: `<p role="alert">` con enlace al módulo; nunca
  tumba la página.

**Componentes** en `web/src/app/(panel)/panel/_tablero/`: `bloques.ts` (`bloquesTablero(permisos, tipo)`, función pura
que decide cada bloque, la utilidad y las acciones: "Abrir punto de venta" pide `vender` y es `<a href="/pos">`;
"Nueva compra" pide `gestionar_compras`; "Entrada de inventario", `ajustar_inventario`; "Ver reportes",
`ver_reportes`); `serie.ts` (`serieSieteDias` y la escala); un server component async por bloque (`avisos`,
`ventas-hoy` con `grafico-semana`, `cajas-abiertas`, `creditos-pagos`, `stock-bajo`, `mas-vendidos`, `lotes`,
`ordenes-listas`). `page.tsx` hace `await exigirPanel()` y envuelve cada bloque en su `Suspense` con un esqueleto de
alto fijo.

- Título: `<h1><span className="sr-only">Inicio: </span>Martes 10 de noviembre</h1>` con `Intl` en `America/La_Paz`,
  para que `auth.spec.ts:46` y `responsive.spec.ts` sigan pasando. La descripción conserva
  `${activo.nombre} · ${etiquetaRol}` (`negocio.spec.ts:21,25,35`).
- Avisos: cada uno es un solo `<Link>` de fila completa con título, detalle y un botón visual (`<span>` con
  `buttonVariants`). El de ventas lleva `data-testid="aviso-por-revisar"` y el texto `textoPorRevisar(n, hayMas)`:
  `reconciliacion.spec.ts:160-163` pasa sin cambios.
- Gráfico: el SVG dibuja solo barras y guías (`fill-chart-bar`, hoy `fill-primary`); días y montos van en HTML, en una
  grilla de 7 columnas a 12 o 13 px, para que el escalado no los encoja. `role="img"` con `aria-label` y una tabla
  `sr-only` con los 7 valores.

**Pruebas**: Vitest `_tablero/serie.test.ts` (días vacíos, cruce de mes, todo en 0) y `_tablero/bloques.test.ts`
(dueño, encargado, contador, encargado de lavandería, y sin `ver_costos` no hay utilidad). E2E
`web/tests/e2e/tablero.spec.ts` sobre estructura, no montos: dueño en tienda (tablas "Hay / Mínimo" y de cajas, acciones
antes de "Ventas de hoy" a 390 px), dueño en frial (lotes), contador (sin "Nueva compra", "Abrir punto de venta" ni
reservas), encargado de lavandería (órdenes, sin créditos ni más vendidos). Ningún rol de panel carece de `ver_costos`,
así que "no ve utilidad" solo se prueba en Vitest. Quitar la grilla de enlaces no rompe ninguna spec; sí cambian la
captura `panel-inicio` y los textos `docs/manual/encargado-y-dueno.md:36-43` y `contador.md:24` (R5).

**Verificación de R2**: la de R1 más `tablero.spec.ts` y `reconciliacion.spec.ts`; capturas de `/panel` en tienda,
frial y lavandería a 390 y 1280 px; probado con dueño, contador y encargado de lavandería.

## R3 y R4, reparto

Antes de los lotes: `BarraFiltros` en `components/ui/` (5 formularios de filtros con la misma disposición); el
`Paginador` de catálogo se reutiliza. Los 221 `h-10` sueltos que quedan redundantes se limpian en R3.

Lotes de archivos disjuntos (páginas de `web/src/app/(panel)/panel/` más componentes del módulo):

1. Catálogo: `productos/**`, `precios`, `tipo-cambio` y `catalogo/components/*` menos `encabezado-pagina` y
   `dolar-paralelo`.
2. Inventario: `inventario/**` e `inventario/components/*`.
3. Ventas del panel: `ventas/**`, `reconciliacion`, `ordenes/**`, `negocio`, `descuento` y sus componentes.
4. Dinero: `cajas/**`, `creditos/**`, `clientes` y sus componentes, menos `plan-cuotas-imprimible`.
5. Compras y reportes.
6. Usuarios: `usuarios`, `dispositivos` y `usuarios/components/*` menos `login-form` y `pos-sesion`.

R4: `app/(pos)/**` y lo que importa `pos-venta.tsx`, `caja/components/{apertura-caja,panel-caja}`, `pos-sesion`,
`selector-cliente`, `aviso-actualizacion`; acceso (`app/(auth)/**`, `login-form`); `app/page.tsx`, `app/error.tsx`,
`panel/{loading,error}.tsx` y los iconos. R5: capturas y textos del manual.

Verificación de R3 y R4: todas las specs de `web/tests/e2e/` y capturas de cada pantalla tocada.

## Trampas

- Contraste: confirmar con `accesibilidad.spec.ts` sobre `/panel`.
- Fuentes: el ajuste de la fuente de respaldo para IBM Plex Mono no está verificado; los totales pueden saltar al
  cargar. Mirar con la caché vacía.
- El radio de 8 px y los botones de 40 px hacen crecer las vistas densas (`grilla-precios`); `responsive.spec.ts` solo
  detecta desbordes.
- Punto de venta: R1 no baja ningún alto; correr `pos-venta.spec.ts` (incluye E2E-08).
- PWA: fuentes nuevas implican precache nuevo; correr `pwa.spec.ts` y `pos-offline.spec.ts`.
- `next/font/google` descarga las fuentes al compilar: sin red el build falla y no es un fallo del código.
- Los 16 usos actuales de `font-mono` pasan a IBM Plex Mono.
- El tablero hace unas 11 consultas por carga, en paralelo. Si pesa, se consolida después.
