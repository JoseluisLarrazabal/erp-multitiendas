# Plan: de la preentrega al paralelo, y rediseño visual con tablero

Aprobado por el CTO el 2026-11-10. Estado por fase: `docs/handoff.md`, sección "Próxima sesión". Cuestionario del
cliente: `docs/preguntas-cliente.md`.

**Estado al 2026-11-11:** fase 0 cerrada (2026-11-10); fase 1 cerrada (PR #103); fase 3 cerrada, en un solo PR en vez
de tres (ver 3.4); fase 2 pendiente, con el QA de roles en producción en curso. El texto de abajo se conserva como se
aprobó, salvo donde dice "reemplazado".

## Contexto

El plan de preentrega cerró el 2026-11-10 (PR #95, #97, #99 y #101). El CTO pidió el 2026-11-10 atacar lo que falta en
el orden recomendado (registro de errores, hardware real, QA con roles, paralelo) y sumar un rediseño: el sistema se
ve poco atractivo, el inicio del panel repite el menú lateral y debe ser un tablero con métricas, y las pantallas
deben ser más intuitivas. Pregunta si es factible.

**Es factible.** Lo que lo hace barato: el 87 % de los componentes ya usa tokens semánticos (`web/src/app/globals.css`),
solo hay 5 primitivos en `web/src/components/ui/`, y casi todas las métricas del tablero ya tienen consulta con su
permiso. Lo que cuesta: 36 pantallas, 121 componentes, 25 capturas del manual y 4 PDF que hay que regenerar.

**Corrección a mi recomendación anterior.** Dije "UI/UX después del paralelo". Vale para cambios de flujo, no para la
estética: un cambio visual después de capacitar obliga a capacitar de nuevo y a rehacer el manual. El rediseño visual
va **antes** de la capacitación y del paralelo. Los cambios de flujo del POS esperan a lo que diga el paralelo.

## Restricciones medidas

- Minutos de Actions: noviembre lleva unos 1.630 de 2.000 (CI 1.537 en 156 corridas, backup 86). El backup necesita
  unos 190 hasta fin de mes. Margen real: entre 50 y 180 minutos. El cupo se renueva el 2026-12-01.
- `ci.yml` corre **solo en `pull_request`**. Empujar una rama sin PR cuesta 0 minutos; cada push a una rama con PR
  abierto vuelve a correr (~17 min).
- Regla de trabajo que sale de ahí: se trabaja en rama empujada sin PR, se verifica todo en local con
  `scratchpad/verificar.sh` (los mismos 8 pasos del CI) y el PR se abre una sola vez, ya terminado. En noviembre cabe
  **un** PR de código (el A). Los del rediseño se abren desde el 2026-12-01.
- No se paga nada. Codex: no verificado (sin cuota hasta el 2026-12-03).

## Fase 0: registro y preguntas al cliente (solo documentos)

Rama `docs/plan-paralelo-rediseno`, un PR (solo corre gitleaks, ~1 min):

- Este plan a `docs/plan-paralelo-rediseno.md`, enlazado en `docs/handoff.md` como plan activo (reglas 8 y 8.b).
- Decisiones del CTO del 2026-11-10 en el handoff: el NIT y los datos de la nota los carga el cliente; el contrato se
  firmó "hace 3 semanas" (falta la fecha exacta, D-04); los extras se hicieron sin costo; la rotación de credenciales
  sigue diferida al cierre.
- `docs/preguntas-cliente.md`: el cuestionario para llevar al cliente, con lo que el sistema hace hoy y qué cuesta
  cambiarlo. Clasificación verificada en el código:

| Pregunta | Quién lo resuelve | Evidencia |
| --- | --- | --- |
| Tasa de interés (el porcentaje) | El cliente, en Créditos, configuración | `credito_config.interes_mensual_pct`, `form-config.tsx` |
| Saldos de crédito antiguos (P-06) | El cliente, en Créditos, "saldo inicial". Sin interés | `crear_credito_inicial`, `form-saldo-inicial.tsx` |
| Productos con serie (P-01) | El cliente, en el producto y en Inventario | `campos-producto.tsx:186`, `FormSeries` |
| Precios de lavandería (P-13) | El cliente, en Productos y Precios (listas normal y express). No existe pantalla "Servicios" | `catalogo/domain.ts:3,7` |
| Tope de descuento, tipo de cambio, NIT | El cliente, en el panel | `/panel/descuento`, `/panel/tipo-cambio`, `/panel/negocio` |
| Segundo depósito, Eterazama y Sacaba (P-09) | Nosotros, por SQL: no hay pantalla de ubicaciones | `scripts/alta/alta-produccion.sql` |
| Persona en dos negocios (P-15) | Nosotros, por SQL: la pantalla no asigna a un usuario que ya existe (no verificado en la interfaz) | `asignar_usuario`, `ERP_CORREO_EXISTE` |
| Interés sobre el total, o perdonar interés al pagar antes (P-07, M-3) | Código y migración | `plan_cuotas`, `pagar_cuota` en `20261108160000_credito.sql` |
| Retener el anticipo al cancelar una reserva (P-12) | Código y migración | `cancelar_reserva` devuelve siempre el total |
| Redondeo distinto a 2 decimales (P-08) | Código y migración | `precios_bs.sql`, `catalogo/grilla.ts:85` |
| Recargo express en porcentaje o cobro mínimo (P-13) | Código y migración: no existen | `lavanderia.sql:797` |
| Fiado en lavandería (P-14) | Código y migración, cambio grande | `registrar_venta` exige pago completo |
| Prenda perdida o dañada con algo más que una nota (P-16) | Código y migración | solo `ordenes.nota` |
| Impresora de 58 mm (P-10) | Código: hoy 80 mm y A4 | `nota-venta.tsx:28` |

Las que alteran el software se preguntan **ya**, antes del paralelo: P-07, P-12, P-14, P-09 y P-10. Si la respuesta
difiere del supuesto, entra un PR propio que no está en este plan.

## Fase 1: PR A, registro de errores (`feat/registro-errores`), noviembre

Cierra M-15 y RNF-16. Sin esto el paralelo corre a ciegas.

**Decisión:** registro propio en Supabase, sin proveedor externo. Sentry queda descartado: dependencia nueva en una PWA
para celulares baratos, la CSP (`web/next.config.ts:22`) solo admite `'self'` y Supabase, manda datos del negocio del
cliente a un tercero y suma una credencial que entregar. Costo aceptado: no hay alertas por correo ni stack traces
legibles; la tabla se consulta por SQL o en el panel de Supabase. Sin pantalla nueva.

Diseño ya criticado por Opus (2026-11-10); sus cinco correcciones están incorporadas. Tres subagentes Sonnet sobre
archivos disjuntos; el de base de datos va primero porque los otros necesitan los tipos.

**A, base de datos.** `supabase/migrations/20261110140000_errores_app.sql`, con el patrón de `guardar_datos_negocio`
(`20261109130100_datos_negocio.sql`, incluido su `revoke all ... from public, anon, authenticated` antes del `grant`):

- Tabla `errores_app` (negocio nullable, usuario, origen con check `rpc`, `cola`, `accion`, `js`; código; mensaje;
  contexto jsonb) con índice `(usuario_id, created_at)`. **RLS activa y ninguna política**: nadie la lee ni la
  escribe desde la web; el CTO la consulta en el panel de Supabase o por SQL.
- RPC `registrar_error(p_origen, p_codigo, p_mensaje, p_contexto, p_negocio_id default null) returns void`,
  `security definer`, `set search_path = ''`. Nunca lanza: sin `auth.uid()` sale; un negocio que no está en
  `mis_negocios()` se guarda como null; tope de 60 filas por usuario y hora; `left()` a todo texto; descarta el
  contexto de más de ~1 KB.
- **Saneo dentro de la RPC**, porque Postgres y `JSON.parse` citan lo que escribió el usuario (22P02: `invalid input
  syntax ...: "<valor>"`): se corta lo que sigue a `: "` y toda secuencia de 5 o más dígitos pasa a `#` (carnets,
  teléfonos). Límite conocido: no cubre texto libre sin comillas.
- Atajo anotado en el archivo: sin purga; purgar si pasa de ~50.000 filas.
- pgTAP `supabase/tests/rpc-errores-app.sql` (copia de `rpc-datos-negocio.sql`): inserción válida, negocio ajeno
  queda en null, la fila 61 no entra, el 22P02 sale saneado, `anon` no ejecuta, `authenticated` no hace `select` ni
  `insert` directo. Después `pnpm db:types`.

**B, web.** `web/src/lib/registro-errores.ts` con `registrarError(origen, codigo, mensaje, contexto?)`: todo el cuerpo
en `try` y la promesa con `.catch(() => {})` (si no, un `AbortError` de postgrest-js dispara `unhandledrejection`, que
vuelve a registrar: bucle); sale si `typeof window === "undefined"` (`errorRpc` también corre en el servidor) o si
`!navigator.onLine`; deduplica el mismo mensaje durante un minuto; no pasa por `errorRpc`. Contexto: operación,
`location.pathname` (nunca la query, puede llevar búsquedas de clientes) e id de build. Ganchos:

- `web/src/lib/erp-errores.ts:55-57`: si el error no tiene código `ERP_*` ni es de red, origen `rpc`. Cubre también
  la cola y el envío de ventas, que ya pasan por ahí (no hace falta tocar `resultadoDeError` ni `envio-venta.ts`).
- `web/src/lib/offline/cola.ts:268`: el `catch {}` que se traga las excepciones del enviador, origen `cola`.
- `web/src/components/panel/use-accion.ts`: cuando la acción falla sin código y sin ser de red, origen `accion`; en
  el `catch`, solo con `navigator.onLine`. Para distinguirlo, los `fallo` de
  `modules/{catalogo,creditos,compras,inventario,usuarios}/actions.ts` pasan a devolver `codigo` (ventas ya lo hace).
- `web/src/app/error.tsx` y `web/src/app/(panel)/panel/error.tsx`: `useEffect` con origen `js` y `error.digest` como
  código (en producción el mensaje llega vacío; el `digest` cruza con los logs de Vercel).
- Componente cliente de ~15 líneas en `web/src/app/layout.tsx` para `error` y `unhandledrejection`.
- Vitest `registro-errores.test.ts`: nunca lanza, no hace nada en servidor, deduplica, un `ERP_*` y un error de red
  no registran.

**C, bordes.** `supabase/functions/admin-usuarios/index.ts`: `console.error` con la acción y el código (sin mensaje)
en los caminos `ERP_INTERNO`. `web/src/modules/ventas/components/nota-venta.tsx:31`: `formatearFechaHora`
(`web/src/lib/format/fecha.ts`) en vez de `toLocaleString`, para que la nota diga `09/11/2026 17:29` con hora de
Bolivia. E2E `web/tests/e2e/errores-app.spec.ts` (patrón `page.route` de `reservas.spec.ts:273`): una RPC que
responde 500 con `XX000` produce una llamada 2xx a `rpc/registrar_error`; un `ERP_STOCK_INSUFICIENTE` simulado no
produce ninguna.

Fuera: pantalla en el panel, política de lectura, registrar desde las server actions en el servidor, cola sin
conexión para los propios errores, purga. Trampa por comprobar al implementar: si algún `.single()` usa `PGRST116`
como "no existe", hará ruido y hay que excluirlo.

- Revisión: `/code-review`, `/ponytail-review`, `/security-review` y revisión de Opus (RPC nueva abierta a todo
  usuario con sesión).
- Despliegue: backup manual, `supabase db push --linked --dry-run`, revisar, `db push --linked`, verificación en
  producción con Playwright.

## Fase 2: verificación sin código (en paralelo con las fases 1 y 3)

- **Hardware real.** Solo lo puede hacer el CTO con los equipos: impresora térmica de 80 mm, lector de códigos de
  barras y un celular Android instalando el POS. Claude prepara la lista de comprobación de una página a partir de
  `docs/despliegue.md`; el CTO la marca y anota lo que falle.
- **QA con roles en producción.** El CTO crea desde el panel una cuenta de vendedor y una de encargado y escribe las
  contraseñas en el navegador de Playwright. Claude recorre cada rol en **solo lectura**: menú visible, pantallas que
  cargan, páginas prohibidas que rechazan, 0 errores de consola. Sin ventas ni cobros: el kardex no se borra.
- **Paralelo.** Depende del cliente (catálogo del frial, D-02; conteo inicial; respuestas de la fase 0). Durante el
  paralelo, Claude consulta `errores_app` al inicio de cada sesión.

## Fase 3: rediseño visual y tablero

Alcance: todo el producto en lo visual (panel, POS, acceso). En el POS **solo cambia la piel**, no el flujo ni el orden
de los pasos: es lo que más se usa y lo que está cubierto por el manual y por 31 archivos de pruebas E2E.

**3.1 Auditoría y brief (sin código, noviembre).** Capturas del estado actual en local con el seed. Auditoría con
`redesign-existing-projects` e `impeccable critique`. Consulta a `ui-ux-pro-max` para el brief común: ERP de comercio
minorista en Bolivia, usuarios con poca práctica digital, celulares Android baratos, POS donde manda la velocidad,
contraste AA, densidad de datos alta en el panel.

**3.2 Dos propuestas (regla 7.b).** Dos subagentes Sonnet en paralelo, cada uno con las mismas 4 pantallas en un mock
HTML: tablero del dueño, una lista con formulario (Productos), POS a 390 px y en escritorio, y acceso. A con
taste-skill (`redesign-existing-projects` más el skill de estilo que encaje), B con `impeccable`. Se publican como
Artifacts con datos inventados. `/council` (regla 6) sobre las dos. **El CTO elige A, B o un híbrido.** Nada de código
del producto antes de esa elección.

**3.3 Implementación**, en ramas empujadas sin PR, por tramos con archivos disjuntos:

- **R1, base:** tokens, tipografía, sombras y colores de estado en `web/src/app/globals.css`; primitivos de
  `web/src/components/ui/`; `PanelShell`, `PanelNav` y `EncabezadoPagina`. El menú de 18 ítems planos pasa a grupos
  (Ventas, Inventario, Compras, Dinero, Configuración). Se limpian los 16 archivos con color directo. No se tocan
  `@page` ni `.nota-80` (`globals.css:70-92`): son la impresión del ticket.
- **R2, tablero** en `web/src/app/(panel)/panel/page.tsx`. Sin RPC nueva: cada tarjeta reusa una consulta existente,
  que ya valida su permiso, dentro de su propio `Suspense`, y solo se muestra si el rol y el tipo de negocio la
  admiten:
  - ventas de hoy y de los últimos 7 días, y los más vendidos: `leerReporte` (`reportes/queries.ts`, `ver_reportes`);
    utilidad solo con `ver_costos`;
  - cajas abiertas: `sesionesAbiertas` (`ventas/lecturas-panel.ts`); por revisar: `listarCajaPorRevisar` y
    `listarReconciliacion` (se conserva `data-testid="aviso-por-revisar"`);
  - stock bajo: `contarStockBajo`; lotes por vencer en el frial: `leerLotesPorVencer` (`inventario/queries.ts`);
  - cuotas vencidas y por cobrar: `cargarCuentas` (`creditos/queries.ts`); reservas activas:
    `cargarReservasActivas`;
  - órdenes sin recoger en la lavandería: `listarOrdenes` (`lecturas-ordenes.ts`);
  - cuentas por pagar: `deudas_proveedores` existe en SQL pero la web no la usa; se verifica antes de construir;
  - 3 o 4 acciones frecuentes en lugar de la grilla de 18 enlaces.
    El gráfico de 7 días se dibuja en SVG propio con la guía del skill `dataviz`: sin librería nueva.
- **R3, pantallas del panel** por módulo (listas, formularios, detalle, estados vacío, de carga y de error).
- **R4, POS y acceso:** piel nueva, mismos pasos. `theme-color` en `public/*.webmanifest` si cambia el color primario.
- **R5, cierre:** `pnpm manual:capturas`, `scripts/manual/exportar.sh`, textos del manual que nombren cosas que
  cambiaron de lugar.

Trampas: las pruebas se apoyan en nombres accesibles (858 `getByRole`, 305 `getByLabel`): se conservan "Principal",
"Abrir menú", "Cerrar menú" e "Inicio", o la prueba se actualiza en el mismo tramo. E2E-08 sigue bajo 200 ms. El POS
instalado toma el diseño nuevo solo (PR 3) cuando el equipo está sin uso.

**3.4 PRs, desde el 2026-12-01 (reemplazado el 2026-11-11):** B (R1 y R2), C (R3), D (R4 y R5). Cada uno se abre una vez, con `verificar.sh` en
verde, `web-design-guidelines`, `impeccable audit`, `/code-review` y `/ponytail-review`. Tras cada merge, verificación
en producción con Playwright y handoff.

**Fase 3 cerrada el 2026-11-11, desvío del plan decidido por el CTO.** El rediseño completo (R1 a R5) se abrió y se
mergeó en un solo PR, #109 (squash `ee132a7`), el 2026-11-11, con CI en verde, sin esperar al 2026-12-01 y sin
partirlo en B, C y D. Motivo: los tramos dependen entre sí (R3 y R4 usan los primitivos de R1) y partirlos exige rehacer
la historia; un solo CI de ~17 minutos en lugar de tres. No lleva migraciones. Si algo falla: `git revert ee132a7`.

## Verificación

- PR A: los 8 pasos de `verificar.sh`; en producción, `supabase migration list` igual en local y remoto, y una
  consulta de solo lectura que confirme que `errores_app` existe y que la web no puede leerla.
- Rediseño: `accesibilidad.spec.ts` (axe) y `responsive.spec.ts` en verde; las 31 pruebas E2E; capturas a 390 px y
  1280 px de cada pantalla tocada, comparadas contra la propuesta elegida; el tablero probado con cada rol y cada tipo
  de negocio en local (un vendedor o un contador no ven costos ni utilidad).

## Riesgos y no verificado

- El rediseño corre el arranque del paralelo si el cliente ya está listo antes de diciembre. La fecha exacta del
  contrato sigue sin anotarse, así que el plazo no está medido. (Reemplazado el 2026-11-11: el contrato se firmó el
  2026-11-01, D-04.)
- El tablero hace entre 8 y 10 consultas por carga. Aceptable con ~10 usuarios; si pesa, se consolida después.
- No verificado: minutos facturados exactos (la cifra es por reloj); si Vercel expone el id de build al navegador;
  cuánto tiempo guarda Vercel Hobby los logs que cruzan con el `digest`; si los despliegues de vista previa de Vercel
  apuntan a la base de producción (hasta saberlo, el rediseño se muestra en local y por capturas); umbrales de
  `accesibilidad.spec.ts`; `deudas_proveedores` desde la web; asignar un usuario existente a un segundo negocio.
- Fuera del plan: cambios de flujo del POS, modo oscuro, rotación de credenciales y dominio (diferidos al cierre).
