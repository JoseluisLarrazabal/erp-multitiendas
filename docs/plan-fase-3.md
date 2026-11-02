# Plan — Fase 3: venta sin conexión

Objetivo: el POS abre y vende sin internet, guarda en una cola local y envía sin duplicar al volver la red. El encargado
revisa lo vendido sin conexión. Requisitos: RF-VEN-09 a RF-VEN-14, RN-03, RN-04, RN-07. Casos: DB-01 (reenvío offline),
DB-12, E2E-05, E2E-06, E2E-07. Hito: "Venta sin conexión". Implementa Sonnet; el chairman revisa, verifica y cierra.

Las órdenes de lavandería sin conexión entran en la fase 4: `crear_orden` no existe todavía. Esta fase deja la cola lista
para un tipo más.

## PRs, en orden

| # | Rama | Contenido | Se comprueba con |
|---|---|---|---|
| 1 | `feat/offline-datos` | `p_offline` en `registrar_venta`, `abrir_caja` y `registrar_movimiento_caja`; marcas de revisión; `verificar_pago_qr`, `revisar_venta`, `reconciliacion_ventas` | pgTAP: DB-01, DB-12, casos de RPC |
| 2 | `feat/offline-cola` | Dexie, `lib/offline`, envío desde la cola, aviso de pendientes, cierre bloqueado | Vitest de cola; E2E-05, E2E-07 |
| 3 | `feat/offline-arranque` | Snapshot en IndexedDB: POS abre sin red, apertura y movimientos sin conexión, QR pendiente, bloqueos, aviso de actualización | E2E-06 y flujo de mañana sin internet |
| 4 | `feat/reconciliacion-panel` | `/panel/reconciliacion`: ventas a revisar, QR pendiente, stock negativo | E2E de reconciliación |

## Decisiones

### Contrato con el servidor: `p_offline`

- `registrar_venta(p_venta jsonb, p_offline jsonb default null)`. `p_offline` nulo es venta en línea, con las reglas de
  hoy. Se reemplaza la función: nada de sobrecarga. Un cliente viejo que manda solo `p_venta` sigue funcionando.
- `p_offline` = `{ vendedor_id, tipo_cambio, numero_impreso }`. Claves exactas, como el resto de los payload.
- **`p_offline` no entra en `huella`.** Un primer intento en línea sin respuesta que sí se guardó se reenvía después como
  offline: si `origen` estuviera en `p_venta`, cambiaría la huella y daría `ERP_OPERACION_REPETIDA`. El reenvío devuelve
  la venta ya guardada con su `origen` original.
- `origen = 'offline'` solo con `p_offline`. `enviada_por = auth.uid()`; `vendedor_id` viene de `p_offline` y debe tener
  el negocio asignado (si no, `ERP_DATOS_INVALIDOS`). Si difiere del que envía queda a la vista por las 2 columnas.
- `tipo_cambio` de `p_offline` (el que vio el vendedor, `> 0`). En línea sigue siendo el del servidor.

### Qué cambia con `p_offline`: marcar, no rechazar (RN-03, RN-04)

La plata ya se cobró en el mostrador. Lo que depende de datos que el equipo no podía ver se acepta y se marca en
`ventas.motivos_revision text[] not null default '{}'`:

| Regla en línea | Con `p_offline` | Motivo |
|---|---|---|
| Producto inactivo | Acepta | `producto_inactivo` |
| `ERP_PRODUCTO_SIN_PRECIO` | Acepta | `sin_precio` |
| Descuento o precio bajo el piso sin `descontar`, evaluado sobre quien vendió | Acepta | `descuento_sin_permiso` |
| `ERP_DESCUENTO_TOPE` | Acepta | `sobre_tope` |
| `numero` distinto del impreso | Acepta | `renumerada` |
| Quien envía no es quien vendió | Acepta | `otra_cuenta` |
| QR con `verificado: true` obligatorio | Acepta `false`, guarda `pendiente` | Se ve por `verificacion` |

`otra_cuenta` cierra el atajo de poner al dueño como `vendedor_id` para esquivar la marca de descuento.

Siguen rechazando: forma del payload, aritmética, permiso `vender` de quien envía, equipo, caja cerrada, salto de
numeración, producto de otro negocio, serie. RN-03: `venta_items` guarda el precio de lista para comparar; sin lista
queda nulo.

**Riesgo aceptado:** quien tenga `vender` puede llamar la RPC con `p_offline` y saltar piso y tope. Queda marcado y lo ve
el encargado; no pasa en silencio. Es el costo de no bloquear la venta.

`revisada_por` y `revisada_en` cierran la marca. Una venta sin motivos y sin QR pendiente no entra a revisión.

### Caja sin conexión

- `abrir_caja` y `registrar_movimiento_caja` reciben `p_offline jsonb default null` = `{ creada_en, usuario_id }`.
  Cierra lo diferido en la fase 2. `usuario_id` debe tener el negocio. Hora: `least(creada_en, now())`, para que un reloj
  adelantado no deje una apertura en el futuro. Un movimiento nunca queda antes de la apertura.
- `caja_sesiones` y `caja_movimientos` guardan `origen` y `enviada_por`: lo que manda el cliente deja rastro.
- Movimiento con `p_offline`: no aplica `ERP_EFECTIVO_INSUFICIENTE`. El gasto ya ocurrió; la diferencia se ve en el
  arqueo.
- `cerrar_caja` no cambia. Sigue solo con conexión. RN-07 se cumple en el cliente: el bloqueo cuenta la cola persistente
  del equipo, no la ref en memoria.
- Apertura rechazada al sincronizar (`ERP_CAJA_ABIERTA`): queda rechazada y sus ventas dan `ERP_CAJA_CERRADA`. Quedan
  visibles para resolver a mano. Pasa solo si 2 navegadores usan el mismo equipo.

### Cola

- Dexie 4 en `web/src/lib/offline/`, base `erp-pos`, tablas `cola` y `datos`. `lib/offline` no conoce ventas ni caja:
  recibe el enviador por tipo. El módulo `ventas` arma el payload y `caja` el suyo.
- Fila de `cola`: `orden` (autoincremental), `id` (UUID de la operación), `tipo` (`venta`, `apertura`, `movimiento`),
  `negocioId`, `dispositivoId`, `usuarioId`, `payload`, `nota`, `estado` (`pendiente`, `rechazada`), `intentos`,
  `proximoIntento`, `error`, `numeroImpreso`. Se valida con Zod al leer (`docs/estandares-codigo.md`).
- **Toda venta entra primero a la cola.** Si IndexedDB falla no se cobra: aviso claro y el carrito queda.
- Vaciado en orden. Error de red: corta y reintenta con backoff (5 s a 5 min). Rechazo con código: `rechazada`, sigue con
  la próxima, no se borra sola.
- Disparadores: al encolar, evento `online`, temporizador mientras haya filas, al montar. No se confía en
  `navigator.onLine`: se intenta siempre y manda la respuesta. Tiempo máximo por intento: 8 s (`abortSignal`).
- Una sola pestaña vacía la cola: `navigator.locks.request("erp:cola", ...)`.
- `navigator.storage.persist()` al abrir el POS, para reducir el desalojo de datos.

### Venta en línea y venta en cola

- **Primer intento:** sin `p_offline`, como hoy, con el cartel "Enviando". Éxito: sale de la cola, nota. Rechazo con
  código, sin intento en duda: sale de la cola y vuelve al carrito con el error. Mismo comportamiento y mismas pruebas de
  la fase 2.
- **Red o 8 s sin respuesta:** la venta queda en la cola, se muestra la nota y el aviso. Desaparece el diálogo
  reintentar/descartar de `use-envio`: la venta ya se entregó al cliente. Reenvíos: con `p_offline`.
- **Sin red al confirmar:** entra directo a la cola. El QR se ofrece como "pendiente de verificar".
- `ERP_NUMERO_DUPLICADO` en la cola: renumera con el mismo UUID, conserva `numeroImpreso` y manda `numero_impreso`, que
  marca `renumerada`. Reusa la lógica y el tope de `use-envio`.
- Filas rechazadas: lista en el POS con motivo y datos, con Reintentar y Descartar. Descartar pide confirmación escrita:
  el dinero ya se cobró.

### Sesión y arranque sin red

- `datos` guarda el contexto: usuario, negocios, activo, permisos, negocio (`DatosNegocio`), equipos, sesión de caja del
  equipo y catálogo con su `version` y fecha. Se escribe en cada carga exitosa. Quita el `shortcut:` de
  `use-pos-sesion.ts`.
- `/pos` sin red y con contexto: `fase: lista` desde IndexedDB, sin mirar la cookie (`docs/stack.md`). La RLS decide al
  sincronizar. Barra visible "Sin conexión, catálogo de hace N".
- Sin red y sin contexto: pantalla actual de sin conexión.
- Cerrar sesión borra el contexto, nunca la cola.
- Cola de otra cuenta: `vendedor_id` conserva a quien vendió y `enviada_por` a quien envió. Así un cambio de turno no
  deja la cola trabada ni el cierre bloqueado. Solo se envían filas de negocios de la cuenta activa; el resto se cuenta
  aparte.
- Token que no refresca al reconectar: pausa la cola, pide login, conserva todo (`caducada`).
- Caja: `cajaAbierta` local si hay apertura en cola. Sin red usa la sesión del contexto; sin ella pide apertura.

### Bloqueos sin conexión (RF-VEN-14)

- En el POS: cierre de caja, crear cliente, buscar cliente, cambio de equipo.
- **Productos con serie: piden conexión.** Límite aceptado: hay 0 series cargadas y P-01 sigue abierta. Se revisa cuando
  el cliente la responda.
- Cliente sin conexión: cliente general. Lavandería exige cliente, así que su venta pide conexión hasta la fase 4. No se
  guardan clientes en IndexedDB: son datos personales que no hacen falta. La nota sí lleva el cliente ya elegido.
- El stock del POS sigue siendo informativo: baja en memoria y se persiste con el snapshot.

### Actualización del service worker

Según `docs/stack.md`: aviso "actualización disponible" y, con cola vacía, `SKIP_WAITING` y recarga a pedido del usuario.
Aviso visible si el SW no quedó activo.

### Reconciliación (RF-VEN-13)

- Lectura y marca con `ver_reportes`. Solo cambian marcas, no dinero; sin permiso nuevo.
- `reconciliacion_ventas(p_negocio_id, ...)` pagina ventas con motivos sin revisar o QR pendiente.
- `verificar_pago_qr(p_pago_id, p_cobrado)`: `pendiente` pasa a `verificado` o a `rechazado`, si el QR nunca llegó.
  Idempotente. Registra quién y cuándo. `total_qr_sesion` no cuenta `rechazado`; `resumen_caja` muestra `qr_pendiente`.
- `revisar_venta(p_venta_id)`: fija `revisada_por` y `revisada_en`. Idempotente.
- Stock negativo: reusa `productos_stock_bajo`. DB-12 se completa con una venta que deja stock negativo y sale ahí.

## Trampas

- Reemplazar `registrar_venta` exige `drop function` de la firma vieja y repetir sus `revoke`/`grant`.
- `venta_items.precio_lista_servidor` es `not null`: el caso `sin_precio` exige quitarlo. Revisar quién lo lee.
- `tipo_cambio` y `numero_impreso` no van en `huella`. El `numero` sí, y renumerar cambia la huella: el reenvío solo pasa
  por el camino de número duplicado, donde la base no guardó nada.
- `stack.md`: `/pos` sigue estático, sin server actions. Dexie entra por el glob de `.next/static`.
- `reloadOnOnline` sigue apagado.
- Migraciones: aplicar en staging antes de que el deploy use `p_offline`.
- Cada build exige borrar el SW en pruebas manuales.

## Fuera de esta fase

Background Sync, reimpresión de notas pendientes, clientes sin conexión, series sin conexión, órdenes de lavandería.

## Verificación

- pgTAP, Vitest, E2E y build en verde en cada PR; `/code-review` y `/ponytail-review` en todos; `/security-review` en
  PR 1, 3 y 4.
- A mano, con build de producción: mañana sin internet (abrir POS, abrir caja, vender efectivo y QR, recargar, reconectar),
  20 reenvíos paralelos de la misma venta offline, 2 pestañas vaciando la misma cola, stock igual al kardex al final.
- Tras cada merge: producción con Playwright, sin sesión. El flujo con usuario en producción sigue bloqueado por la cuenta
  del CTO; se reporta como no verificado.
