# Auditoría de la Entrega A (2026-11-08)

Pedida por el CTO el 2026-11-08 ("paralelamente audita la entrega A"). Hecha solo con lectura: 3 subagentes revisaron
trazabilidad, base de datos y web. Nada se ejecutó contra producción. Codex: no verificado (sin cuota hasta el
2026-11-16).

## Resumen

- **0 hallazgos críticos.** 2 altos en la base, 0 altos en la web.
- **31 de 31 pruebas** de los criterios de salida (DB-01 a DB-20, DB-27, E2E-01 a E2E-11) existen, verifican lo que dice
  el catálogo y corren en CI. No hay `.skip`, `.only` ni `.fixme`.
- Checks del 2026-11-08 en `main`: `pnpm lint` 0, `tsc --noEmit` 0, Vitest 382 de 382, `format:check` limpio.
- pgTAP local: 5 fallos en `auditoria.sql` y `rpc-offline-ventas.sql`, con la base sucia de los E2E. Se descarta una
  regresión con `pnpm db:reset && pnpm db:test`; queda confirmado en el PR de compras, que resetea.
- RLS en las 28 tablas. Ningún `grant` de escritura a `authenticated` ni a `anon`. Todas las funciones tienen
  `search_path = ''` y sin `execute` para `public`. El kardex y las demás tablas append-only tienen triggers de
  `UPDATE`, `DELETE` y `TRUNCATE`. El negocio sale siempre de la fila, nunca del parámetro.
- No hay `service_role` ni secretos en `web/`. No hay datos reales del cliente versionados; la plantilla xlsx no se
  revisó celda a celda. Tampoco se revisó el historial de git.

## Hallazgos y decisión

**CTO, 2026-11-08: "Todos los problemas que salgan deben solucionarse".** Cada hallazgo tiene arreglo, salvo los que no
son defecto; esos llevan el motivo.

| # | Severidad | Hallazgo | Arreglo |
|---|---|---|---|
| DB-A1 | Alto | `registrar_venta` con `p_offline` acepta precio bajo, descuento sin permiso y sobre el tope. Un vendedor que arme la llamada a mano lo puede usar en línea (`20261101210100_rpc_offline.sql:176-188`, vigente en `20261102110000_lavanderia.sql`) | No se puede rechazar sin perder ventas reales sin conexión (RN-04). Se hace visible: alerta "N ventas por revisar" en el Inicio del panel para quien revisa, con vendedor y motivo |
| DB-A2 | Alto | `cerrar_caja` solo pide `caja`. Si otro usuario cierra la caja de un equipo, las ventas offline ya cobradas en esa sesión dan `ERP_CAJA_CERRADA` para siempre: hay efectivo recibido sin venta ni descuento de stock | Una venta o movimiento offline con hora entre `abierta_en` y `cerrada_en`, de un cierre de menos de 30 días, se acepta con la marca `caja_cerrada`. Quien tiene `ver_reportes` la puede anular (devuelve stock, sin efecto en caja, sin plazo de 24 h) |
| DB-M3 | Medio | El vendedor tiene `anular` (P-11). Puede vender, cobrar, anular y quedarse con el efectivo, y el cierre da diferencia 0 | Se quita `anular` al vendedor y al empleado, en la migración de la matriz. P-11 recomendaba limitarlo |
| DB-M4 | Medio | El arqueo ciego no está forzado en la base: `resumen_caja` devuelve `esperado` a quien tiene `caja` | Sin `ver_reportes`, `resumen_caja` devuelve en null `esperado` y todos sus términos. Residual aceptado: la RLS deja leer ventas, que el POS necesita |
| DB-M5 | Medio | Con `p_offline`, la caja se salta `ERP_EFECTIVO_INSUFICIENTE`, acepta como usuario a cualquier miembro y no tiene cota inferior para `abierta_en` | Un no miembro se rechaza. Un miembro sin `caja`, una hora de más de 30 días o un efectivo insuficiente se aceptan marcados (`usuario_sin_permiso`, `fecha_fuera_de_rango`, `efectivo_insuficiente`), sin recortar la hora. Revisión en `/panel/reconciliacion`, sección "Caja por revisar" (`revisar_caja`) |
| DB-M6 | Medio | `registrar_tipo_cambio` solo exige valor mayor que 0. Un 69,6 en vez de 6,96 multiplica por 10 los precios en USD | **Ya cubierto:** `FormTipoCambio` pide confirmación con `cambioBruscoDeTipoCambio` (más de 20 %). La base no lo limita; se queda así |
| WEB-M1 | Medio | Los fallos de red suman `intentos`; tras unos 3 minutos sin red, un solo error del servidor rechaza la venta (`lib/offline/cola.ts:84-90`) | Contador aparte para errores con respuesta del servidor |
| WEB-M2 | Medio | El contexto offline del POS no caduca: un usuario desactivado puede vender sin conexión hasta sincronizar | Caduca a las 72 h sin contacto con el servidor |
| WEB-M3 | Medio-bajo | En el logout, el borrado del contexto compite con un timeout de 1,5 s y `guardarDato` va sin `await` | Escrituras con `await` antes de borrar |
| WEB-M4 | Bajo | Otra cuenta del mismo negocio envía la cola del vendedor anterior | **No es defecto:** la cola debe salir igual, y el servidor la marca `otra_cuenta` para revisión |

Bajos:

| Hallazgo | Arreglo |
|---|---|
| `FOR UPDATE` antes del permiso en `anular_orden`, `cambiar_estado_orden` y `entregar_orden` | Permiso primero |
| Bloqueos ordenados por texto y por uuid (riesgo de deadlock) | Mismo orden (uuid) en todas las RPC |
| `devolver_venta` reparte sobre un QR rechazado | No se devuelve a un pago QR rechazado |
| `controla_serie` se puede activar con stock existente | Se rechaza si hay stock sin series |
| `anular_venta` sobre una orden entregada | Se rechaza |
| `stock` sin trigger de `TRUNCATE` | Se agrega |
| Dos dueños que se desactivan a la vez pueden dejar el negocio sin dueño activo | Trigger de baneo con lock del negocio: `ERP_ULTIMO_DUENO`; la Edge Function lo devuelve como 409 (texto verificado contra GoTrue local) |
| Dos `parsearMonto` distintos; el de catálogo acepta enteros ilimitados | Uno solo, con tope |
| `formatearBs` lanza con NaN | **No es defecto:** falla fuerte a propósito, para que un NaN de datos no pase inadvertido (revisión del 2026-11-08) |
| Con la sesión caducada, el motor llama a `getSession()` cada 5 s sin fin | Backoff |
| Clientes, ventas y caja legibles para todo rol del negocio | **No es defecto:** todos los roles venden, cobran o reportan con esos datos |
| `entregar_orden` no mira el pago | **No es defecto:** lavandería cobra el total al recibir |
| Un baneo vencido no reactiva el perfil | **No es defecto:** `admin-usuarios` solo usa baneos sin vencimiento, y falla cerrado |
| `ERP_CORREO_EXISTE` permite enumerar correos | **No es defecto:** solo lo ve quien tiene `usuarios` |
| Desactivar no revoca el JWT vivo (1 h) | A verificar que `mis_negocios()` y `tiene_permiso()` filtran `perfiles.activo`: así la base corta al instante |
| CSP con `unsafe-inline` | **No se cambia:** un nonce obliga a renderizar en cada pedido, y el POS es estático para el precache sin conexión. Documentado en `next.config.ts` |

## Trazabilidad de requisitos

- Sin hacer: RF-TR-10 (dominio, por decisión del CTO) y RNF-02 (venta confirmada en menos de 2 s, sin prueba de
  tiempo).
- Parciales:
  - RF-CAT-02, filtro por marca y categoría, sin E2E.
  - RF-CAT-08, garantía en la nota, sin confirmar.
  - RF-CAT-12, dólar paralelo, sin E2E.
  - RF-LAV-07, "sin recoger", probado solo vacío.
  - RF-TR-07, PWA en Android o Safari reales.
  - RF-VEN-05, impresora térmica real.
  - RNF-03, sin estimación de tamaño.
  - RNF-12, limpieza `--linked`.
  - RNF-14, sin axe ni lector de pantalla.
  - RNF-15, solo Chromium.
  - RNF-16, sin registro de errores de RPC.
- Matices de pruebas:
  - DB-04 simula con `INSERT`, pero lo cubren RPC reales en `rpc-devoluciones.sql`.
  - DB-14 no prueba el borde de 23:59.
  - Playwright usa `retries: 1` en CI y puede ocultar intermitencias (`catalogo.spec.ts:195`).
  - No hay workflow semanal de `pnpm audit`.

## Lo que sigue

| PR | Contenido | Estado |
|---|---|---|
| `fix/cola-intentos-red` | WEB-M1 | mergeado (#82) |
| `fix/auditoria-db` | DB-A2, DB-M3, DB-M4, DB-M5 y los bajos de SQL, en una migración | PR abierto |
| `fix/auditoria-web` | DB-A1 (alerta), WEB-M2, WEB-M3 y los bajos de web | mergeado (#84) |
| `test/brechas-trazabilidad` | E2E de filtros, dólar paralelo, "sin recoger" con datos, garantía en la nota, venta en menos de 2 s; axe; Firefox y WebKit; `pnpm audit` semanal; `retries` y el intermitente de `catalogo.spec.ts:195` | pendiente |

Los PRs van intercalados con la fase 7, porque comparten la base local en puertos fijos.

## Efecto operativo de DB-M3 (CTO, avisar al cliente)

El vendedor y el empleado ya no anulan ni devuelven ventas, ni siquiera dentro de las 24 h. `devolver_venta` exige
`anular`, así que RN-08 queda en manos del dueño y del encargado. Si el mostrador necesita devolver, hay que crear un
permiso `devolver` aparte.
