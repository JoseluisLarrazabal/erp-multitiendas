# Handoff — ERP Multitiendas

Documento vivo. Fuente de verdad para planificar y ejecutar el proyecto.
Última actualización: 2026-11-10 (plan activo: `docs/plan-paralelo-rediseno.md`; fase 0 cerrada, PR A de registro de
errores en curso).

## Próxima sesión (arrancar acá)

- **Plan activo: `docs/plan-paralelo-rediseno.md` (aprobado por el CTO el 2026-11-10).** Va de la preentrega al
  paralelo y suma un rediseño visual con tablero de métricas en el inicio del panel. Fases y estado:
  - **Fase 0, documentos: cerrada el 2026-11-10.** El plan, estas decisiones y `docs/preguntas-cliente.md`.
  - **Fase 1, PR A, registro de errores (M-15, RNF-16): hito activo.** Rama `feat/registro-errores`. Tabla propia
    `errores_app` en Supabase con RPC `registrar_error`; sin proveedor externo. Es el único PR de código que cabe en
    noviembre por los minutos de Actions.
  - **Fase 2, verificación sin código: pendiente.** Hardware real (lo hace el CTO con una lista que prepara Claude),
    QA con roles en producción en solo lectura (el CTO crea las cuentas y escribe las contraseñas) y el paralelo.
  - **Fase 3, rediseño visual y tablero: esperando la elección del CTO.** Las dos propuestas están publicadas y
    deliberadas; enlaces, diferencias, defectos y recomendación (base A con tres piezas del tablero de B) en
    `docs/rediseno-propuestas.md`. Las dos llegaron al mismo concepto, así que la elección es de ejecución y no de
    dirección. Nada de código del rediseño antes de esa elección. Después: implementación por tramos en ramas sin PR;
    los PR B, C y D se abren desde el 2026-12-01.
  - Regla de trabajo del plan: `ci.yml` corre solo en `pull_request`, así que una rama empujada sin PR cuesta 0
    minutos. Se verifica todo en local y cada PR se abre una sola vez, ya terminado.
- **Decisiones del CTO del 2026-11-10** (dichas en el chat, anotadas acá por la regla 14):
  - El NIT y los "Datos para la nota" de los tres negocios los carga el cliente desde "Datos del negocio".
  - El contrato se firmó "hace 3 semanas" (hacia el 2026-10-20). Sigue faltando la fecha exacta (D-04): el plazo no
    está medido.
  - Las funcionalidades fuera de contrato se hicieron sin costo. El CTO dijo que ya no importa si la garantía de
    los extras está estipulada. Objeción dicha una vez: el punto 6 del acta sigue con el blanco
    `[quedan / no quedan]` y conviene escribir la palabra antes de firmar; la recomendación es "no quedan". Sin
    respuesta todavía.
  - La rotación de credenciales y la compra del dominio siguen diferidas al cierre.
  - Registro de errores propio, sin Sentry: no suma dependencia a la PWA, no manda datos del cliente a un tercero y no
    agrega una credencial que entregar. Costo aceptado: sin alertas por correo ni trazas legibles; la tabla se
    consulta por SQL o en el panel de Supabase.
  - El rediseño visual va antes de la capacitación y del paralelo (un cambio visual posterior obliga a capacitar de
    nuevo y a rehacer el manual). En el POS cambia solo la piel; los cambios de flujo esperan al paralelo.
- **Pendiente del CTO y del cliente:**
  - llevar al cliente `docs/preguntas-cliente.md`; las 8 primeras cambian el sistema si la respuesta difiere del
    supuesto y deben resolverse antes del paralelo;
  - resolver D-01 (la palabra del punto 6 del acta), D-02 y la fecha exacta del contrato (D-04);
  - rotar las credenciales y comprar el dominio (diferidos por el CTO hasta el cierre);
  - los equipos que abrieron el POS antes del PR 3 necesitan pulsar "Actualizar ahora" una vez; los que lo instalen
    desde ahora se actualizan solos;
  - guardar fuera de línea la clave privada `age` y hacer la copia periódica de los backups (`docs/backup.md`).
  Y del lado de quien retome:
  - comprobar la primera corrida programada `base` del backup (17:23 UTC; al cerrar esta sesión GitHub todavía no la
    había arrancado), la primera corrida con fotos semanales del domingo 2026-11-15 (que `github.event.schedule`
    entregue `23 5 * * 0`) y revisar la cadencia el 2026-12-01;
  - vigilar los minutos de Actions: medidos el 2026-11-10 por reloj, noviembre lleva unos 1.630 de 2.000 (CI 1.537
    en 156 corridas, backup 86); el backup necesita unos 190 hasta fin de mes. Lo facturado puede ser más;
  - cuando vuelva la cuota de Codex (2026-12-03), correrlo sobre los PR 1 a 3 (#95, #97, #99); si encuentra algo, el
    arreglo va en un PR nuevo.
- **Plan cerrado: `docs/plan-preentrega.md` (aprobado por el CTO el 2026-11-09, culminado el 2026-11-10).** Cerró la
  auditoría previa a la entrega en 4 PRs: 1 bloqueantes B-1 a B-6 (#95), 2 Entrega B (M-1, M-2, M-5 a M-8; #97), 3
  operación diaria (M-9 a M-14, M-16, M-17, pruebas y no concluyentes; #99), 4 documentos (#101). Resultado: los 6
  bloqueantes y los medios del plan están arreglados y desplegados; el paquete de entrega está al día. Quedó fuera,
  como se aprobó: M-15 (registro de errores), las preguntas al cliente y las decisiones D-01, D-02 y D-04.
  - **PR 4, documentos: cerrado el 2026-11-10 (PR #101, rama `docs/paquete-entrega`).** Solo documentos e imágenes;
    ningún archivo de producto. En GitHub solo corre gitleaks (el CI completo ignora `docs/**`).
    - Qué entró: acta con el punto 6 redactado (6 funcionalidades adicionales; la garantía queda en blanco hasta
      D-01) y la lista previa a la firma ampliada; paralelo, capacitación y despliegue con lo que cambiaron los PR 1 a
      3; SRS (RF-INV-06, RF-VEN-05, contraseñas, RNF-09); los cuatro manuales (`docs/manual/`); `decisiones-manual.md`
      con las reglas nuevas y las corregidas; `auditoria-entrega-a.md` con una sección de estado al 2026-11-10 (qué
      brecha cerró con qué evidencia y cuáles siguen abiertas); `backup.md` con la copia periódica fuera de GitHub;
      y las tres contradicciones de este handoff (contrato, fase 6, fecha de Codex).
    - Capturas: las 25 de `docs/manual/img` se regeneraron en local con la base del seed (`pnpm manual:capturas`, 27
      pruebas en verde); nunca contra producción. No se agregaron capturas nuevas (Datos del negocio, restablecer
      contraseña, anular compra): decisión del chairman para no tocar código en este PR.
    - PDF: `scripts/manual/exportar.sh` genera los cuatro (vendedor 19 páginas, lavandería 11, encargado y dueño 31,
      contador 6) en `docs/manual/dist/`, que no se versiona. Hay que volver a generarlos antes de entregarlos si el
      manual cambia.
    - Cómo se hizo: desvío del plan, dicho al CTO. El plan decía que los documentos los escribía el chairman; la
      redacción masiva la hicieron cuatro subagentes Sonnet sobre un mapa de brechas (Opus), y el chairman escribió el
      acta, `backup.md` y este handoff, revisó cada diff y comprobó contra el código los textos de pantalla citados.
    - Correcciones de la revisión: "Cobro sin confirmar" solo aplica a la venta que completa una reserva, a la venta a
      crédito y a la cuota (no a lavandería); "Actualizar ahora" se pulsa sin venta en curso, no "con la caja
      cerrada"; se quitó del manual del vendedor la frase que exigía entrar con la cuenta que hizo la venta para
      descartar una rechazada (el manual dice lo que la pantalla dice: descarta quien tiene el permiso de devolución
      fuera de plazo); la sección del dueño describe los dos límites de seguridad como límites que debe conocer, no
      como riesgos "que el cliente acepta" (el cliente no los ha aceptado: los aceptó el CTO).
    - Límites conocidos que quedaron escritos como tales: la fecha de la nota sale "9/11/26, 5:29 p. m."; la búsqueda
      de órdenes de lavandería por cliente distingue tildes; una venta a crédito o de reserva hecha por error no tiene
      reverso; M-15.
    - No verificado: el texto y el comportamiento exactos al descartar una venta rechazada desde otra cuenta
      (`revisarDescarte` devuelve "La sesión caducó o es de otra cuenta..." en algún caso que no se llegó a aislar);
      de la regla "pasados 30 días del cierre solo se puede descartar" se confirmó el rechazo del servidor
      (`cerrada_en <= now() - interval '30 days'`), no lo que muestra la pantalla en ese caso; que el servidor siga aplicando el tope de 5 MB a una foto que no se pudo achicar; los
      PDF se abrieron por muestreo (2 páginas), no se leyeron enteros; las líneas de más de 120 caracteres que
      agregaron los manuales no se reajustaron. Codex: no verificado (sin cuota hasta el 2026-12-03).
  - **PR 3, operación diaria: cerrado el 2026-11-10 (PR #99, squash `2340106`).**
    - Cierre: CI del PR en verde (17 min 42 s, una sola subida; la prueba de bloqueos con `dblink` pasó en GitHub);
      merge a las 14:50 UTC; deploy de Vercel en verde sobre `2340106`. Comprobado en producción con la web nueva
      (sesión del dueño, solo lectura): reportes muestra el texto del criterio; `/panel/productos?q=cafe` devuelve 3
      productos; clientes, inventario, cajas, compras y datos del negocio cargan; `/panel`, `/pos` y
      `/panel/reportes` sin sesión llevan a `/login`; 0 errores de consola; 0 errores de runtime en la última hora.
    - **La primera actualización tras este PR sigue siendo a mano.** El POS abrió con el código anterior, que no
      sabe aplicarse solo: mostró "Actualización disponible" y quedó en la versión nueva al pulsar "Actualizar
      ahora", sin errores. Cada equipo con el POS instalado necesita ese botón una vez; desde el deploy siguiente se
      actualiza solo. Va a la capacitación y al manual (PR 4).
    - Lo que el QA de producción no pudo ver: no hay ventas, cajas cerradas, clientes ni órdenes en producción. El
      detalle de una caja con ventas tardías, el cierre con una venta rechazada, la referencia del kardex y la
      compresión de fotos están probados solo en local. Se ven en el paralelo.
    - Limpieza: worktrees y ramas temporales del PR 3 borrados.
    - Qué entró: M-9 (texto del criterio en los reportes, con textos propios para la lavandería), M-10 (una caja
      cerrada muestra los tres números del cierre y, aparte, lo que llegó sin conexión después; `reporte_caja` usa el
      esperado guardado), M-11 (una venta o un movimiento rechazado no bloquea el cierre; se avisa, separando los de
      cajas anteriores), M-12 (búsquedas sin tildes en productos, clientes e inventario), M-13 (el kardex muestra el
      documento: "Venta C1-000012", "Compra del 10/11/2026"), M-14 (un producto desactivado con stock se puede sacar,
      trasladar y contar), M-16 (barra de modos del POS a 390 px), M-17 (aviso de cliente repetido), POS sin
      productos, compresión de fotos al subir (1.200 px, WebP), refresco del catálogo al volver a la pestaña,
      actualización automática del POS, dos arrastres del PR 2 (`ultima_salida` no cuenta `anulacion_compra`;
      `pagar_proveedor` solo acepta compras a crédito no anuladas), pruebas de la sección 4 de la auditoría, limpieza
      de pruebas al día y backup con fotos semanal. Detalle: `docs/plan-preentrega.md`, "Plan detallado del PR 3".
    - Decisiones del chairman (comunicadas al CTO, sin objeción): la actualización del POS se aplica sola al abrir si
      nadie tocó la pantalla y no hay cola, cobros, cuotas ni carrito; se recortan la prueba de `ERP_ULTIMO_DUENO` en
      integración y la accesibilidad de las pantallas de la Entrega B (después de la entrega); la referencia del
      kardex no nombra al proveedor; un traslado no lleva referencia (el tipo ya lo dice).
    - Migraciones (4, aditivas): `20261110130000_cierre_caja_tardias`, `130100_busqueda_sin_tildes` (instala
      `unaccent`), `130200_kardex_referencia` (`drop` y `create` de `kardex_producto`, con una columna más al
      final), `130300_arrastres_pr2`.
    - Revisión: `/code-review`, `/ponytail-review`, `/security-review` (sin hallazgos explotables) y Opus sobre
      dinero, permisos, cierre de caja y actualización automática ("no bloquea"). Una ronda de arreglos: carrera al
      comprimir la foto, texto de tardías, rechazadas de cajas anteriores, texto del bloqueo del cierre, clave vieja
      que dejaba "Actualizar ahora" bloqueado para siempre, carrito en la actualización automática, textos de
      lavandería. **Codex: no verificado (sin cuota hasta el 2026-12-03).**
    - Verificación local sobre el árbol final (`7ab966a` más documentos): lint, formato y `tsc` en 0; Vitest 515 en
      56 archivos; pgTAP 2.578 en 58 archivos; tipos sin diferencias; build; integración 19 de 19; Playwright 269 de
      269. Ensayo de la limpieza sobre la base que dejó Playwright: `docs/plan-limpieza-pruebas.md`.
    - QA de dos builds seguidos (local, perfil de navegador persistente): con un build nuevo y sin tocar la
      pantalla, el POS se recarga una sola vez y queda en la versión nueva, sin 404 ni errores de consola; con un
      cobro guardado en el navegador no se aplica y muestra "Actualización disponible". El 404 de chunk de la
      auditoría no se reprodujo. El precio de crédito "que no llegaba al POS tras recargar" tampoco se reprodujo
      (guardado 77 en el panel, el POS recargado muestra 77).
    - Despliegue (2026-11-10, 14:29 a 14:30 UTC), migraciones antes del merge. **Desvío del plan, para no gastar
      minutos de Actions:** no se disparó un backup manual; se usó el programado `erp-backup-2026-11-10T1340Z-completo`
      (corrida 42825897018, en verde, 292 fotos verificadas) tras comprobar que producción no tuvo ningún movimiento,
      venta, caja ni registro de auditoría desde las 13:35 UTC. `db push --dry-run` listó solo las 4 → `db push`.
      Comprobado: `migration list` igual en local y remoto (50); las 9 funciones tocadas, ejecutables por
      `authenticated` y no por `anon`; `unaccent` en el esquema `extensions`; `sin_tildes('María José ÑANDÚ')` da
      `Maria Jose NANDU`; con la web vieja, inventario, productos, clientes, reportes, cajas y compras cargan sin
      errores de consola.
    - **Backup programado nuevo, comprobado:** la primera corrida `completo` arrancó a las 13:35 UTC (8 h 12 min de
      atraso), tardó 5 min 28 s, artifact de 37 MB que vence a los 7 días. La corrida `base` de las 17:23 UTC queda
      por comprobar. Desde el merge de este PR el esquema pasa a fotos semanales (ver la decisión abajo).
    - Límites conocidos (también en el cuerpo del PR): las órdenes de lavandería siguen distinguiendo tildes al buscar
      por cliente (`ordenes` tiene permisos por columna; se busca por número de boleta); una fila rechazada impide
      actualizar la app en ese equipo hasta resolverla; pasados 30 días del cierre, una venta rechazada ya no se puede
      reintentar, solo descartar; el efectivo de una venta rechazada aparece como diferencia del cierre; con dos
      pestañas del POS, una puede quedar con el código viejo tras actualizar; la actualización automática puede
      perder un toque dado en el segundo en que recarga (solo el carrito); una foto de 25 MB puede cerrar la pestaña
      en un celular de gama baja; el kardex muestra número de venta y fechas de compra a quien tiene
      `ajustar_inventario` sin `ver_reportes`; en `reporte_caja`, una caja cerrada con ventas tardías muestra el
      esperado del cierre y las columnas de detalle con lo tardío (el texto del criterio lo dice); `ERP_ULTIMO_DUENO`
      como 409 sin prueba de integración; el prepago total de un crédito cobra el interés completo (M-3, pregunta al
      cliente).
    - Para el manual y la capacitación (PR 4): el POS se actualiza solo al abrirlo; si no, "Actualizar ahora" con la
      caja sin ventas en curso; qué hacer con una venta rechazada al cerrar caja; "cuotas en efectivo" negativo tras
      un reverso; fotos una vez por semana en el backup; las fotos se achican solas; buscar órdenes por boleta.
    - No verificado: la compresión en Safari de iPhone y la orientación de fotos verticales (solo Chromium); la
      carrera de la foto (elegir una y enseguida otra) sin prueba automática; referencias del kardex de devolución,
      compra, reserva y reversión sin prueba propia; traslado con inactivos sin prueba propia; el refresco del
      catálogo al volver a la pestaña sin prueba propia; que `github.event.schedule` entregue `23 5 * * 0` el primer
      domingo (2026-11-15); que la prueba de bloqueos con `dblink` sea estable en el CI; Codex.
  - **Decisión del CTO (2026-11-10): backup con fotos una vez por semana; no se paga por minutos ni por nada.**
    Contexto, medido por API: unos 1.730 de 2.000 minutos de Actions gastados; quedaban unos 270 para 20 días. El
    backup completo tarda de 5 a 13 minutos (el paso de fotos varía de 83 a 521 s) y el de base 4: con la completa
    diaria se gastaban de 180 a 340 minutos hasta fin de mes, más unos 20 del PR 3, y sin minutos el backup de
    producción deja de correr. Qué se hace, dentro del PR 3: base dos veces al día como hoy; fotos solo el domingo a
    las 05:23 UTC, guardadas 14 días (con 7 y una corrida atrasada podía quedar un hueco sin copia de fotos). Costo
    estimado: unos 190 minutos hasta fin de mes. Costo aceptado: en una pérdida total de Supabase se pierden las
    fotos subidas desde el último domingo; los datos no cambian. Objeción del chairman, dicha una vez: el CTO dio por
    hecho que el proyecto de Supabase no se va a borrar; eso no se puede garantizar (cuenta comprometida, borrado
    por error) y es justo el caso para el que existe el backup. **Revisar el 2026-12-01**, cuando se renueva el
    cupo: sin el gasto de CI de noviembre la completa diaria cabe; volver es cambiar los cron y la retención en
    `backup.yml`. Documentado en `docs/backup.md`. Cómo revertir: restaurar los cron `23 5 * * *` y `23 17 * * *` y
    la retención de 7 días.
  - **PR 2, Entrega B: cerrado el 2026-11-10 (PR #97, squash `426a91d`).**
    - Cierre: CI del PR en verde (16 min 25 s, una sola subida); merge a las 13:06 UTC; deploy de Vercel `READY`
      sobre `426a91d`. Comprobado en producción con la web nueva (sesión del dueño, solo lectura): `/panel/compras`,
      `/panel/compras/nueva`, `/panel/ventas`, `/panel/usuarios`, `/panel/creditos`, `/panel/proveedores`,
      `/panel/inventario` y `/pos` cargan; `/panel`, `/pos` y `/panel/compras` sin sesión llevan a `/login`; 0 errores
      de consola del producto; 0 errores de runtime en la última hora. Entre el `db push` (12:47 UTC) y el merge, la
      web vieja convivió 19 minutos con la base nueva: `/panel/compras` cargó sin errores.
    - **Lo que el QA de producción no pudo ver:** Multitienda Lider no tiene ventas, compras, proveedores, créditos,
      reservas ni otra persona que el dueño. Los reversos, los documentos del crédito, el lote en las compras del
      frial y las acciones sobre encargados están probados solo en local (pgTAP y Playwright), no con datos de
      producción. Se ven en el paralelo.
    - Limpieza: worktrees y ramas temporales del PR 2 borrados; quedan `wt-push` y tres ramas `worktree-agent-*` de
      sesiones anteriores, sin tocar.
    - Qué entró: M-1 (`cancelar_reserva` exige además `anular`), M-2 (reversos por contraasiento:
      `anular_pago_cuota`, `anular_pago_proveedor`, `anular_compra`), M-5 (`/panel/ventas` distingue ventas a crédito
      y de reserva, sin Anular ni Devolver, con explicación), M-6 (reimprimir el plan de cuotas y marcar documentos
      después de vender), M-7 (mensaje propio de operación repetida en reserva, cuota y cancelación), M-8 (lote y
      vencimiento por línea en las compras del frial) y la decisión del CTO de que solo el dueño gestiona a los
      encargados. Detalle y decisiones: `docs/plan-preentrega.md`, "Plan detallado del PR 2".
    - Decisiones del chairman al arbitrar el plan (comunicadas al CTO, sin objeción): `anular_compra` revierte el
      pago automático del contado y exige que la deuda resultante no quede negativa; el reverso de una cuota cobrada
      en una caja ya cerrada sale de otra caja abierta; los documentos del crédito se pueden desmarcar, con auditoría;
      una compra con series no se anula; no se partió el PR.
    - Migraciones (5, aditivas): `20261110120000_cancelar_reserva_anular`, `120100_solo_dueno_encargados`,
      `120200_reverso_cuota_documentos`, `120300_compra_lotes_frial`, `120400_reversos_compras`.
    - Revisión: `/code-review`, `/ponytail-review`, `/security-review` (sin hallazgos altos ni medios) y revisión de
      Opus sobre permisos y dinero ("no bloquea"). Arreglos de la ronda: un pago manual a proveedor quedaba sin poder
      anularse si después había una compra al contado; el reintento de una compra del frial pasada la medianoche se
      rechazaba por la fecha de vencimiento; el formulario de documentos se remontaba al refrescar.
      **Codex: no verificado (sin cuota hasta el 2026-12-03).**
    - Verificación local sobre el árbol final (`eb73d92` más documentos): lint, formato y `tsc` en 0; Vitest 499 en
      54 archivos; pgTAP 2.481 en 54 archivos; tipos sin diferencias; build; integración 19 de 19; Playwright 256 de
      256.
    - Despliegue (2026-11-10, 12:41 a 12:47 UTC), migraciones antes del merge: backup manual
      `erp-backup-2026-11-10T1245Z-base` (1,7 MB, vence a los 30 días, corrida 42817870121 en verde); antes existía
      el completo `erp-backup-2026-11-10T0439Z-completo` → `db push --dry-run` listó solo las 5 → `db push` →
      `functions deploy admin-usuarios`. Comprobado en producción: `migration list` igual en local y remoto (46); las
      11 funciones tocadas son `security definer` con `search_path` vacío, ejecutables por `authenticated` y no por
      `anon`; `compra_anulaciones` con RLS, 1 policy, sin `insert` para `authenticated` ni `select` para `anon`.
      Producción antes de migrar: 0 compras, 0 pagos de cuota, 0 pagos a proveedor, 0 reservas, 0 encargados.
    - **QA autenticado en producción (2026-11-10, solo lectura, sesión del dueño en el navegador de Playwright):**
      `/panel/negocio` carga y **el NIT y los datos de la nota están vacíos** (pendiente del CTO: llenarlos en los
      tres negocios o la nota sale sin dirección); el conteo de Multitienda Lider carga con "Sistema: N"; en
      producción solo existe la cuenta del dueño, así que el botón de restablecer contraseña no se pudo ver;
      "Cambiar contraseña" está en panel y POS; 0 errores de consola. **Hallazgo:** el POS abrió con la versión vieja
      y el aviso "Actualización disponible"; la nueva apareció solo tras "Actualizar ahora". Los equipos con el POS
      abierto no reciben un arreglo hasta pulsar ese botón: va al manual y a la capacitación (PR 4) y se revisa en
      el PR 3.
    - Límites conocidos (también en el cuerpo del PR): una venta a crédito o de reserva hecha por error no tiene
      reverso; al anular una compra, el costo promedio se recalcula con una aproximación si hubo ventas o traslados
      después; `anular_compra` en el frial valida el stock total, no el saldo del lote; una compra con series no se
      anula; "cuotas en efectivo" puede salir negativo en la caja de donde sale un reverso (va al manual);
      `pagar_proveedor` acepta por RPC directa el `compra_id` de una compra al contado y deja a los dos sin poder
      anularse (la pantalla no lo ofrece); `ERP_OPERACION_REPETIDA` al anular una compra o un pago cierra el diálogo
      y refresca sin mensaje propio; `DialogoMotivo` y `ConfirmarAccion` no se unificaron; entre el `db push` y el
      merge la web vieja convive con la base nueva (compras del frial rechazadas y acciones sobre encargados
      rechazadas por la RPC: 0 compras y 0 encargados en producción).
    - No verificado: concurrencia real de dos reversos a la vez (hay bloqueos, no hay prueba con dos sesiones); la
      impresión real del plan de cuotas en papel; el foco tras anular; el reintento del frial tras medianoche contra
      el código viejo; la primera corrida programada del backup nuevo (a las 13:10 UTC la de las 05:23 UTC no había
      arrancado; GitHub ya atrasaba 6 a 10 h; hay dos backups manuales del día, completo de las 04:39 y base de las
      12:45 UTC); Codex.
  - **PR 1, bloqueantes: cerrado el 2026-11-10 (PR #95, squash `46b7ecd`).**
    - Qué entró: B-1 a B-6, más los arreglos de tres rondas de revisión (dos pestañas, cuotas guardadas antes de
      enviar, espera de 60 s en cuotas, pendiente ajeno que no se reenvía, encargado que no restablece a otro
      encargado) y el recorte del CI (sin corrida en `push` a `main`, sin CI en cambios solo de documentos, gitleaks
      en `secretos.yml`).
    - Verificación local sobre el árbol final: lint, formato y `tsc` en 0; Vitest 483; pgTAP 2.224 en 50 archivos;
      tipos sin diferencias; build; integración 17 de 17; Playwright 245 de 245. CI del PR en verde (15 min 27 s).
    - Revisión: `/code-review`, `/ponytail-review`, `/security-review` (0 vulnerabilidades) y dos pasadas de Opus.
      **Codex: no verificado (sin cuota hasta el 2026-12-03).**
    - QA local con Playwright de las 5 reproducciones de la auditoría: pasan (código "25", "Sistema: 10 (3
      reservadas)" sin ajuste y ajuste de −1 al contar 9, NIT y dirección en la nota, recarga a mitad del cobro a
      crédito con 1 solo crédito, contraseñas). Capturas revisadas por el chairman; no se guardan en el repo.
    - Despliegue (2026-11-10, 04:26 a 04:40 UTC): backup manual `erp-backup-2026-11-10T0439Z-completo` (37 MB, vence
      a los 7 días, corrida 42755891404 en verde, con restauración de prueba) → `db push` de las 3 migraciones
      (`20261109130000`, `130100`, `130200`) → `functions deploy admin-usuarios`. Comprobado en producción:
      `migration list` igual en local y remoto (41); 3 funciones nuevas, vista `stock_reservado` y check de auditoría
      presentes; `auditar_clave` no ejecutable por `authenticated`; deploy de Vercel `READY` sobre `46b7ecd`; `/panel`
      y `/pos` sin sesión llevan a `/login`; 0 errores de consola; 0 errores de runtime en la última hora.
    - **Desvío del plan:** el orden real fue web, migraciones, función. Vercel publica al mergear, así que la web
      nueva estuvo unos 14 minutos sin sus migraciones (conteo y lista de personal habrían fallado; fue de madrugada,
      sin uso). Corrección para los PR 2 y 3: como las migraciones son aditivas, se aplican antes del merge.
    - Backups viejos (aprobado por el CTO): los 4 de 37 MB más viejos (dos del 2026-11-05, 11-06 y 11-07) se copiaron
      a `~/Documents/ERP-backups-copias/` en la máquina del CTO (fuera del repo, cifrados con `age`, con
      `SHA256SUMS`; tamaño idéntico al de GitHub y `unzip -t` sin errores) y se borraron de GitHub. Artifacts vivos:
      128 MB de 500.
    - Límites conocidos que quedan (también en el PR #95): restablecer no cierra sesiones abiertas (desactivar,
      restablecer, reactivar); verificar la clave actual protege la pantalla, no la API; stock negativo si se cuenta
      menos de lo reservado; `conteo_items.cantidad_sistema` incluye lo reservado desde ahora; la espera de 60 s
      depende del reloj del equipo; `aviso-actualizacion.tsx` no mira cobros pendientes; en cuotas, un rechazo por
      permiso tras un intento en duda borra la entrada pendiente (no reproducido); `cobro-pendiente.ts` y
      `cobro-cuota.ts` duplican el patrón de almacenamiento y la constante de 60 s.
    - No verificado: la corrida `base` del backup nuevo y la primera corrida programada `completo` (se comprueban
      el 2026-11-10 tras las 05:23 y las 17:23 UTC); QA autenticado en producción (necesita que el CTO escriba una
      contraseña); que un equipo con la PWA instalada tome la versión nueva sin intervención (el QA local vio un
      service worker sirviendo la build vieja hasta actualizar; está en el PR 3).
  - Decisiones del CTO (2026-11-09): camino de 4 PRs y M-1 con la opción recomendada (`cancelar_reserva` exige
    `anular`), a cargo del chairman; autorizó la consulta de colisiones de B-1 en producción; rotar credenciales y
    comprar el dominio quedan para cuando el producto esté listo para entregar (objeción ya dicha).
  - Consulta de B-1 en producción (solo lectura, 2026-11-09): 597 productos, 330 con código de barras, 0 colisiones.
    Defecto latente; se arregla igual.
  - Hallazgo nuevo: los artifacts del backup suman 240 MB y crecen 37 MB por día. Si la cuenta de GitHub es Free
    (500 MB), el backup falla hacia el 2026-11-16. B-4 se rediseñó para caber: corrida completa con 7 días de
    retención y corrida solo-base con 30.
  - **Cupo de GitHub, respuesta del CTO (2026-11-09):** la cuenta es Free (500 MB de artifacts y 2.000 minutos de
    Actions al mes en repos privados). Aprobó borrar los backups viejos, con la preferencia de copiarlos antes. Cómo
    se ejecuta: después del merge del PR 1 y de un backup nuevo verificado, se descargan a una carpeta local fuera
    del repo (siguen cifrados con `age`) y se borran de GitHub los 4 más viejos de 37 MB (dos del 2026-11-05, 11-06 y
    11-07); se conservan el del 11-08 y el del 11-09 hasta que venzan. Sin ese borrado, viejos más nuevos rozan los
    500 MB hacia el 2026-11-17. Del borrado en adelante no hay nada manual: GitHub borra solo al vencer la retención.
    El procedimiento de copia periódica fuera de GitHub quedó escrito en `docs/backup.md` (PR 4).
  - **Minutos de Actions (medido el 2026-11-09 sumando la duración de los jobs por la API, no leído de Billing):**
    unos 1.667 de 2.000 gastados en 9 días de noviembre; el CI se llevó 1.602 (153 corridas de unos 17 minutos, 71 de
    ellas en `push` a `main`) y el backup 61. Quedan unos 333 para 21 días. Si se agotan, Actions se detiene hasta el
    1 de diciembre y **el backup de producción deja de correr**. Recorte decidido por el chairman, dentro del PR 1:
    quitar la corrida en `push` a `main` (repite el árbol que ya probó el PR), saltar el CI en cambios solo de
    documentos y mover gitleaks a un workflow propio que corre en todo PR. Con eso el resto del plan más los backups
    cuesta unos 290 minutos: margen de unos 40. **Pendiente CTO:** poner un método de pago con tope bajo en GitHub para
    que el backup no dependa de ese margen; sin eso, si el contador se acerca al tope, los PR 3 y 4 esperan a
    diciembre. Actualización del mismo día: el CTO prefirió no depender de la tarjeta; la verificación completa se
    corre en local antes de subir y cada PR se sube una sola vez. Si aun así el contador se acerca al tope, se
    publica con la verificación local (excepción a la regla 4, avisada al CTO, sin objeción hasta ahora) y los
    minutos que queden son del backup.
  - **Decisión del CTO (2026-11-10): solo el dueño gestiona a los encargados. Va en el PR 2.** Contexto: quien tiene
    el permiso `usuarios` (el encargado de la lavandería) podía crear encargados, cambiarles el rol y quitarlos;
    `asignar_usuario` solo protegía al dueño. El PR 1 impide que un encargado restablezca directamente la contraseña
    de otro encargado, pero hasta el PR 2 la regla se rodea en tres pasos (bajarle el rol, restablecer, devolverle el
    rol), los tres auditados. Alcance en el PR 2: asignar el rol `encargado`, cambiar el rol de un encargado, quitarlo,
    desactivarlo o reactivarlo y restablecer su contraseña exigen ser dueño del negocio (`asignar_usuario`,
    `quitar_usuario`, `puede_asignar_rol`, `puede_administrar_cuenta`, `admin-usuarios`, pantalla de personal, pgTAP,
    integración, E2E y matriz del SRS). Costo aceptado: sin el dueño, nadie corrige a un encargado.
  - **Fotos y cupos (2026-11-09).** Las fotos viven en Supabase Storage (1 GB gratis, unos 36 MB hoy); lo que aprieta
    es su copia en GitHub. Medido en el código: la subida no comprime (`catalogo/foto.ts`, hasta 5 MB por foto). El
    CTO espera que el catálogo crezca. Decidido: compresión al subir, en el PR 3 (`docs/plan-preentrega.md`). Límite
    que queda: con copia completa diaria y 7 días de retención caben unos 62 MB de fotos por copia (cerca de 1.000
    fotos de 60 KB). Salidas, en orden: copia con fotos semanal en vez de diaria (cambio de dos líneas en
    `backup.yml`; se pierde hasta una semana de fotos nuevas en una pérdida total) y, si no alcanza, Cloudflare R2 con
    copia incremental (10 GB gratis, no verificado; exige cuenta y credencial nuevas). Comprimir el archivo del backup
    no sirve: JPG y WebP ya vienen comprimidos.
  - El despliegue a producción tras cada merge con migraciones (backup manual, `db push --dry-run`, `db push`,
    función `admin-usuarios`) quedó cubierto por la aprobación del plan.
  - Fuera del plan: M-15 (registro de errores, exige elegir proveedor), M-3 y P-07, P-06, P-12 (cliente), D-01, D-02,
    D-04 (CTO).
- **Auditoría funcional previa a la entrega (CTO, 2026-11-09): `docs/auditoria-preentrega.md`.** Veredicto: no está
  listo para firmar el acta; sí para cargar datos una vez cerrados 6 bloqueantes de código. Sin críticos.
  - Evidencia: pasos 1 a 8 del CI en local sobre `a910b49` (Vitest 464, pgTAP 2.186, integración 12, Playwright 237,
    todo en verde); producción al día (deploy, 38 migraciones, 0 errores de runtime en 7 días); 6 subagentes de
    lectura y un QA en navegador siguiendo los manuales.
  - Bloqueantes: B-1 el POS agrega el producto equivocado si un código interno es igual al código de barras de otro;
    B-2 el conteo ignora lo reservado y crea stock fantasma; B-3 la nota y la boleta salen sin dirección ni teléfono
    y no hay dónde cargarlos; B-4 el backup corre con hasta 10 h de atraso (27 h entre dos corridas, RNF-09); B-5 no
    hay cambio ni restablecimiento de contraseña; B-6 una recarga a mitad del cobro deja una venta a crédito
    registrada y el POS sin rastro.
  - 16 medios, 40 bajos y las brechas de prueba están en el documento. El paquete de entrega (acta, paralelo,
    capacitación, manuales) necesita un PR propio.
  - **Pendiente CTO:**
    - aprobar el camino de 4 PRs (sección 8) y decidir M-1 (¿el vendedor devuelve anticipos en efectivo?) y M-3
      (interés en el prepago, con el cliente);
    - correr o autorizar la consulta de colisiones de B-1 en producción (sección 2): la lectura a producción quedó
      bloqueada por el clasificador de permisos en esa sesión;
    - dos objeciones al plan vigente: rotar las credenciales antes de cargar datos reales, y comprar el dominio antes
      de instalar la app en los equipos (el almacenamiento del POS es por origen).
  - No verificado: datos reales de producción, hardware real, Codex (sin cuota). Los hallazgos medios sin marca
    salen de lectura de subagentes.
  - Las 3 contradicciones que tenía este handoff (firma del contrato, "en curso: fase 6" y la fecha de la cuota de
    Codex) se corrigieron en el PR 4 del plan de preentrega.

- **Manual de usuario y capacitación con la fase 7: hecho el 2026-11-09** (`docs/plan-manual-usuario.md`, aprobado por el
  CTO). Manuales por rol en `docs/manual/`: vendedor, lavandería, encargado y dueño, contador. Llevan 25 capturas
  sacadas con Playwright en local sobre el seed (`pnpm manual:capturas`, config aparte que el CI no corre; solo tras
  `supabase db reset`). Los PDF A4 salen con `scripts/manual/exportar.sh` en `docs/manual/dist/`, que no se versiona. El
  encargado y el dueño reciben también el PDF del vendedor.
  - `capacitacion.md` ya cubre reservas, crédito, cuotas, compras e insumos.
  - Decisiones que el código fija y el manual recoge:
    - la venta a crédito solo la hacen el dueño y el encargado (`gestionar_credito`); el vendedor cobra cuotas;
    - el contador puede confirmar QR y marcar ventas revisadas en Reconciliación (`ver_reportes`).
  - La captura `pos-elegir-equipo` simula 2 equipos, porque el seed tiene uno.
  - Supuestos escritos como supuestos en el manual: P-03, P-07, P-09, P-12, P-15 y el consumo de insumos solo por dueño o
    encargado.
  - No verificado:
    - la cobertura contra `decisiones-manual.md` se revisó leyendo ítem por ítem, sin un cruce automático;
    - el manual no se probó con personal real.
- **Manual de usuario y documentos de entrega (CTO, 2026-11-09):** se escriben a partir de
  `docs/decisiones-manual.md`, el registro de reglas, restricciones, riesgos aceptados y supuestos que el usuario y el
  cliente tienen que conocer (22 módulos, más una tabla de contradicciones resueltas). Toda decisión visible para el
  usuario que se tome de acá en adelante se anota ahí en el mismo PR. Ninguna regla vigente puede faltar en el manual del
  rol al que afecta; cada supuesto se confirma con el cliente o se entrega escrito como supuesto.
- **Fase 7, Entrega B: cerrada el 2026-11-09.** Los 4 PRs están mergeados y con la migración aplicada en producción:
  compras (#83), insumos (#86), reservas (#87) y crédito (#88). `/panel/creditos` se verificó con Playwright. Plan en
  `docs/plan-fase-7.md`. D-01 sigue sin resolver. Codex no revisó ninguno de los 4: queda pendiente para cuando vuelva
  la cuota (2026-12-03); si encuentra algo, el arreglo va en un PR nuevo.
- **Auditoría de la Entrega A: cerrada el 2026-11-09 con #91 (`test/brechas-trazabilidad`).** E2E de filtro marca/categoría,
  dólar paralelo, "sin recoger" con datos y venta < 2 s (local ~290 ms); axe sin violaciones serias en 7 pantallas; humo
  del panel en Android (Pixel 7) e iOS (iPhone 14, WebKit) emulados; `failOnFlakyTests` en CI; `pnpm audit` los lunes y
  en PRs que tocan dependencias (override de zod 4.6.7). Arreglos de producto: contraste del F2 de Cobrar, foco de la
  grilla de precios (causa del intermitente), marcas desde la vista `marcas_productos` (migración `20261109120000`
  aplicada en producción y filtro verificado con Playwright) y scroll del menú lateral en celular. Decisión: Firefox no
  se prueba, RNF-15 no lo pide. Pendiente: dispositivos reales (RF-TR-07), impresora térmica, lector de pantalla.
  Codex: no verificado.
- **Siguiente:** los 6 bloqueantes de `docs/auditoria-preentrega.md` (reemplaza "nada de código bloqueante", del
  2026-11-09 por la mañana). Además, lo que depende del cliente (lista de abajo) y de Codex (2026-12-03).
- **Migraciones a producción (CTO, 2026-11-08):** `.claude/settings.json` permite a Claude correr
  `pnpm exec supabase --workdir <dir> db push --linked` y su `--dry-run`. Siempre se corre desde un worktree limpio en
  `origin/main`, con el dry-run primero y verificando `supabase/.temp/project-ref`. Para revertir, se borra la regla.
- **Auditoría de la Entrega A (2026-11-08):** `docs/auditoria-entrega-a.md`. Cerrada en código y en producción (#82, #84, #85, #91).
- **Fase 7, crédito (PR 4) — decisiones para el CTO:**
  - Cualquier cuenta del negocio puede leer los créditos y saldos de clientes por RLS, igual que ventas y clientes. El permiso de las RPC ordena los listados, no los hace secretos. Si se quiere la deuda reservada, hay que cambiar las políticas.
  - El saldo inicial se carga sin interés y se puede anular solo si no tiene pagos.
  - P-07 (interés sobre saldo, sistema francés) sigue siendo un supuesto: cambiarlo solo toca `plan_cuotas`.
  - No hay recibo imprimible del cobro de cuota (`shortcut`).
- **Fase 7, reservas (PR 3):** pestaña Reservas del POS, solo con conexión, con anticipo en efectivo o QR. Decisiones:
  - La reserva valida el precio mínimo y exige stock disponible en el equipo.
  - Una venta de reserva nunca se encola: se reintenta en memoria con el mismo id, y si no se confirma se ofrece "Descartar y verificar".
  - Costo de la venta = foto de la reserva. Al completar, la liberación va sin costo; al cancelar reingresa con la foto.
  - Una venta de reserva no se anula ni se devuelve.
  - Para el CTO: el QR del anticipo se confirma en el mostrador y no se puede marcar como rechazado después.
- **Fase 7, crédito (PR 4, #88):** venta a crédito en el POS (solo con conexión, cliente
  obligatorio, lista `credito`, inicial mínima por negocio, 1 a N cuotas, 3 casillas de documentos), plan de cuotas imprimible, modo
  Cuotas para cobrar por caja, y `/panel/creditos` (saldo por cliente, vencidas con días de atraso, detalle, saldos iniciales y
  parámetros). Decisiones y ajustes en `docs/plan-fase-7.md` (decisión 7). Para el CTO:
  - El interés vive en las cuotas: no suma a `ventas.total` ni a los reportes de ventas.
  - Una venta con crédito no se anula ni se devuelve (`ERP_VENTA_CON_CREDITO`).
  - Los saldos iniciales se cargan sin interés. Falta confirmar P-07 (interés sobre saldo) con el cliente: cambia solo `plan_cuotas`.
- **Fase 7, insumos (PR 2):** consumo desde Salida o ajuste (solo lavandería), reversión desde el kardex y reporte Insumos (requiere `ver_reportes` y `ver_costos`). Residuo aceptado: un `operacion_id` elegido igual al id de un movimiento bloquea su reversión (solo dentro del negocio).
- **Producción lista para cargar datos.** El backup diario con fotos está en verde, el script de limpieza está
  ensayado (PRs #71 a #79) y el CI está en verde en `main`.
- **Bloqueado por el cliente o el CTO, en orden:**
  1. Precios del cliente. Sin ellos no se puede vender (`ERP_PRODUCTO_SIN_PRECIO`) ni capacitar.
  2. Servicios de lavandería, catálogo del frial y tope de descuento (D-03).
  3. Conteo físico (P-17, P-02 a P-05).
  4. Usuarios del personal (correos y roles), al final.
  5. Prueba en el equipo real con lector.
  6. Capacitación. Antes del paralelo va la limpieza: seco y real con `--linked`, `SUPABASE_DB_PASSWORD` lo escribe el
     CTO, y se resetea el contador local en cada equipo (`docs/despliegue.md`).
  7. Paralelo de 3 días y acta.
  8. Fecha de firma (D-04), dominio (RF-TR-10), rotación de credenciales a la entrega y adenda D-01.
- **Codex:** cuando vuelva la cuota (2026-12-03, según el error de Codex del 2026-11-08), correr las revisiones pendientes de las fases 3 a 6 y `verify-fix`
  sobre los `fix:`.

## Estado actual

- **Contrato firmado** (decisión del CTO del 2026-11-01): `/home/shadowfreak/Downloads/Contrato_ERP_Hinojosa_Claros.docx`
  (basado en el contrato de Elegance Dominio Barbería). Falta anotar la fecha exacta de firma (D-04).
- **Anticipo cobrado** (50%). Saldo (50%) se cobra a la entrega, contra firma del acta de entrega.
- **Desarrollo:** fases 0 a 7 cerradas (frial, reportes y PWA: `docs/plan-fase-5.md`; salida: `docs/plan-fase-6.md`;
  backup en `docs/backup.md`). Después vino la auditoría previa a la entrega y su plan de 4 PRs
  (`docs/plan-preentrega.md`). Repo: `github.com/JoseluisLarrazabal/erp-multitiendas` (privado).
- **Formulario de relevamiento Lider: LISTO (2026-10-26, PR #1).** Apps Script `formularios/apps-script/relevamiento.gs`
  creó (cuenta Google del CTO):
  - Form (link cliente): https://docs.google.com/forms/d/e/1FAIpQLScKis-v3T917G29sN-J5wxRG5Y2in2HU8FjfbkmGBFEkNEUew/viewform
  - Editar form: https://docs.google.com/forms/d/1qrG1GulgtutvGeBt0dgFDI02BC5TsGryR6PyevU1L9U/edit
  - Planilla de carga: https://docs.google.com/spreadsheets/d/1YE1VWxSqo6-ZZlrT5Vn7-FgNjoCRcWf6cijJ2prCxQE/edit
  - Planilla de respuestas: https://docs.google.com/spreadsheets/d/1fgxt7zJ-Ly3w3am6LyrxBPPFrURKElRqSB_S3_BI9gU/edit
  - Alternativa offline: `formularios/plantillas/Multitienda-Lider-Datos-iniciales.xlsx` (mismas columnas; regenerar con
    `generar_plantilla_lider.py` si cambian las del `.gs`).
  - Verificado con Playwright: 13 páginas (intro + 12 secciones), 104 preguntas, link a la planilla en la intro, correo
    requerido, confirmación final obligatoria. **No verificado:** planilla de carga en vivo (privada; revisar a mano) ni
    respuesta de prueba punta a punta. Codex: no verificado.
  - **Pendiente CTO:** compartir planilla de carga con el correo del cliente (Editor) y mandar link del form por WhatsApp.
    Registrar aquí la fecha de envío.
  - Plan: `docs/plan-formulario-lider.md`.
- **Formularios lavandería y frial: CREADOS (2026-10-26, PR #2).** Mismo archivo, renombrado a
  `formularios/apps-script/relevamiento.gs`. Tiene 3 funciones: `crearTodoLavanderia` (82 preguntas, 9 secciones),
  `crearTodoFrial` (82 preguntas, 8 secciones) y `crearTodoLider_YA_EJECUTADO` (no volver a correrla).
  Las secciones 1 a 3 están parametrizadas por negocio. La sección "3 negocios juntos" solo va en Lider.
  - La traza de llamadas de Lider es idéntica antes y después del refactor (523 llamadas, `cmp`), así que el form
    publicado sigue coincidiendo con el código.
  - **No verificado:** la ejecución real en Google de lavandería y frial (solo probado con stubs), y la configuración
    regional de la cuenta (separador decimal en la planilla del frial). Codex: no verificado.
  - **Lavandería: creado (2026-10-26).** Verificado con Playwright: 10 páginas (intro + 9 secciones), 82 preguntas,
    link a la planilla de carga en la intro, correo requerido, confirmación final obligatoria.
    - Form (link cliente): https://docs.google.com/forms/d/e/1FAIpQLSfv9ohkgFW4KonwPzS5JPr7X8D9wMUU2_sf4Mn6_YiUGAKFYA/viewform
    - Editar form: https://docs.google.com/forms/d/1Pm86SGnQyvBAV-6emgasz3z6Ul1XSCiYLAekKkgSHKE/edit
    - Planilla de carga: https://docs.google.com/spreadsheets/d/178C1hezWtEZhyBNTpj_p0EtjRg63Ju437oamvydBoh0/edit
    - Planilla de respuestas: https://docs.google.com/spreadsheets/d/1jXJv1asWqeTRg0gpfyrBFsge186K0DkmR8CtefYr5EM/edit
  - **Frial: creado (2026-10-26).** Verificado con Playwright: 9 páginas (intro + 8 secciones), 82 preguntas,
    link a la planilla de carga en la intro, correo requerido, confirmación final obligatoria.
    - Form (link cliente): https://docs.google.com/forms/d/e/1FAIpQLSfHHtAmKOE0afEsGZCqHFOFqiD-FAKxMyk51wez7FkZ36lKaw/viewform
    - Editar form: https://docs.google.com/forms/d/1TJ72Tev4gBYKCvNUc89HY3aIr_8NB2FRilwPUXVhn4c/edit
    - Planilla de carga: https://docs.google.com/spreadsheets/d/12P5adY-tJmJQjg4P-2gnFfYY-tA1ePETXO_376ys2w0/edit
    - Planilla de respuestas: https://docs.google.com/spreadsheets/d/1FhamDhMmjFQ8NbVCLxMZ8CEH1N4Ym4sln-gYsjN9O9Y/edit
  - **No verificado (ambos):** planillas de carga en vivo (privadas), separador decimal en la del frial, respuesta de
    prueba punta a punta.
  - **Pendiente CTO (ambos):** compartir cada planilla de carga con el correo del cliente (Editor), mandar los links
    por WhatsApp y registrar aquí la fecha de envío.
  - Plan: `docs/plan-formularios-lavanderia-frial.md`.
- **Formularios ENVIADOS al cliente: 2026-10-26** (los 3 links por WhatsApp). El plazo de 30 días calendario corre
  desde la firma y la recepción de la información (cláusulas quinta y undécima).
  - **Planillas de carga: acceso "Cualquier persona con el enlace"** (decisión del CTO, 2026-10-27). El link solo se
    mandó al cliente. El CTO acepta el riesgo: el link también está en la intro del form, que se puede reenviar, y la
    planilla va a tener costos y datos personales. Recomendado pasarla a **Restringido** apenas termine la carga.
    Revisado 2026-10-30: las 3 se pueden leer y descargar sin login. En Lider, sin login se ve "Solo ver"; en lavandería
    y frial no se comprobó el permiso del enlace.
  - **Planilla Lider, revisión 2026-10-30:** 597 productos reales en `Productos`.
    - El cliente agregó las columnas `imagenes` (B) y `Ubicacion` (R). Hay 292 fotos en las filas 5 a 296; las 17
      revisadas al azar coinciden con su producto.
    - Columnas H a L y N a Q: estaban ocultas, ya visibles. No tienen datos reales: **ningún producto tiene precio** ni
      código interno.
    - Filas 569 a 594 (26): estaban pegadas sin formato ni validaciones. Reparadas el 2026-10-30, a pedido del CTO, con
      la cuenta `jencarlosmoral2`. Valores sin cambios (verificado por exportación). Siguen sin `Ubicacion`.
    - Respaldo previo: https://docs.google.com/spreadsheets/d/1tLSkAeGuOCQG0e41VDcPedof-iEpLrmOrRv1guLOGag/edit
    - Queja del cliente: filas muy altas. Las filas 1 a 601 estaban fijas en 50 px. Corregido el 2026-10-30 (opción A
      del CTO): 21 px en 2 a 4 y 297 a 601, 32 px en las filas con foto (5 a 296). Encabezado sin cambios. Datos y
      validaciones verificados por exportación. Las fotos van dentro de la celda.
    - Durante ese trabajo, A2 quedó con un espacio; causa no identificada. Se restauró `REF-001` a mano.
    - Para limpiar antes de importar: 4 filas con "aro 20/29" en código de barras, 17 códigos repetidos, 13 productos
      repetidos, 1 código en notación científica, categoría "Hornos" duplicada.
    - El síntoma que reportó el cliente sigue sin confirmar. Lavandería y frial solo tienen las filas de ejemplo.
  - **Revisión 2026-11-01:** informe: https://claude.ai/artifact/DJeZuyDC3x9TZpnPtqyK39
    - Planillas de carga exportadas sin login. Lider: 597 productos, 2.633 unidades, 0 precios. Clientes, Usuarios y
      Números de serie sin datos reales. Lavandería y frial: 0 filas reales.
    - Cambio desde el 30-10: los 597 productos ya tienen código interno ("1" a "597"). No consta quién lo cargó.
    - Fila 582: `8.998206720297E12` da 13 dígitos, pero falla el dígito verificador EAN-13. Volver a escanear.
    - **Form Lider contestado el 2026-10-27** (1 respuesta, confirmada), leído el 2026-11-01 con `jencarlosmoral2`.
      Lavandería contestó el 2026-10-27 (1 respuesta, confirmada). **Frial: 0 respuestas** y 0 filas en su planilla.
    - Lavandería: 4 estados (Recibido, En lavado, Listo para entregar, Entregado), cobro total al recibir, caja separada
      de Lider, solo Bs, 25 Bs por kilo. Sin impresora. Stock de insumos pedido, fuera del contrato.
    - **Frial aún no abre, según el cliente (2026-11-01).** Se construye según contrato: ventas por peso, inventario,
      kardex y reportes. Lotes y despieces se sumaron después (fase 5, RF-FRI-04 a 07). Recomendado acordar por escrito que se
      entrega sin catálogo y no traba el acta, porque el saldo de Bs 5.000 depende de ella.
    - Imprescindible para el cliente: precios según tipo de cambio diario. Recomendado: precio en USD y Bs calculado.
    - Resuelto en Lider: tienda y depósito, costo promedio, listas contado/crédito/mayorista, clientes por negocio,
      sin traspasos. No quiere panel de los 3 negocios, y el contrato tampoco lo pide: propuesto quitar el consolidado.
    - **Alcance, pendiente CTO:** crédito con cuotas, cuentas por cobrar, reservas y proveedores no están en la cláusula
      tercera. Recomendado cotizarlos aparte (cláusula décima) y avisar antes de diseñar.
    - **Plazo:** corre desde la firma y la recepción de precios e inventario (cláusulas quinta y undécima). Faltan los
      precios. Recomendado avisarlo por escrito.
    - 7 contradicciones entre form y planilla por confirmar; la principal es serie "en todos los productos" con 0 series.
- **Documentación del proyecto (2026-11-01):** plan en `docs/plan-documentacion.md`.
  - Requisitos: `docs/srs.md`. Fuente: `docs/relevamiento.md`.
  - Diseño: `docs/arquitectura.md`, `docs/plan-modelo-datos.md`, `docs/stack.md`.
  - Desarrollo: `docs/estandares-codigo.md`, `docs/plan-pruebas.md`, `docs/roadmap.md`, `docs/migracion-datos.md`.
  - **Alcance v1 (CTO, 2026-11-01):** incluye todo: contrato más crédito, reservas, proveedores e insumos. Se avisó que
    no entra razonablemente en 30 días ni en Bs 10.000. Mitigación: Entrega A contractual y Entrega B extras.
  - **Pendiente CTO:** D-01 a D-04 del SRS (adenda de extras, frial sin catálogo, aviso del plazo, fecha exacta de firma del contrato).
  - **Pendiente cliente:** cargar precios en el panel, y preguntas P-01 a P-17 del SRS.
- **Fase 0 cerrada (2026-11-01):** plan en `docs/plan-fase-0.md`, 5 PRs. Hito cumplido: login real, RLS probado y CI
  verde. Hecha en una sesión; la estimación era 3 días. Todo local, sin proyectos en Supabase ni Vercel. El prototipo
  `sistema-de-gestion-multinacional/` NO se pule: es una maqueta estática y queda solo como mapa de módulos y
  referencia visual.
  - Fase 1 siguió en la misma sesión; ver abajo.
  - **No verificado:** Safari, Firefox, Vercel, equipos del cliente, JWT asimétrico en `getClaims`, reintento de
    `error.tsx`, y vacío de dispositivos. Foco del menú móvil con reintento por frames, sin causa raíz.
  - **Riesgo:** dos dueños que se desactivan a la vez pueden dejar el negocio sin dueño; se recupera con `service_role`.
    CI usa cerca de 25 logins de los 30 por 5 minutos que permite Auth local.
  - PR #24 hecho: `web/`, Supabase local en puertos 54420-54429 y CI de 8 pasos.
  - PR #26 hecho: 6 tablas, matriz de permisos, RLS de solo lectura y RPC de usuarios y dispositivos. Usuarios de prueba
    en `supabase/seed.sql`.
  - PR #25 hecho: spike de service worker, `@serwist/turbopack` sirve. Resultado en `docs/stack.md`.
  - PR #27 hecho: login, proxy, shell del panel y selector de negocio. Login, logout y cambio de negocio corren en el
    navegador, sin server actions (`docs/plan-fase-0.md`).
  - Edge Function `admin-usuarios`, pantallas de usuarios y dispositivos, integración en CI.
  - `[auth.email] enable_signup` debe quedar en `true`: en `false` apaga el login por correo. El registro público lo
    cierra `[auth] enable_signup = false`. Autorizado por el CTO el 2026-11-01. Repetir en producción.
  - Codex: no verificado en esta fase.
- **Fase 2 en curso (2026-11-01):** plan en `docs/plan-fase-2.md`. Simplificación registrada: RF-VEN-03 sin
  autorización de un encargado en el mismo equipo; un vendedor sin `descontar` no aplica descuentos y el encargado vende
  desde su sesión. Autorizar con credenciales ajenas exige un PIN que el SRS no define.
  - PR 1 `feat/caja-clientes-datos`: `clientes`, `caja_sesiones`, `caja_movimientos` y sus RPC (RF-CLI-01/02,
    RF-CAJ-01 a 04). Nuevo error `ERP_EFECTIVO_INSUFICIENTE`. pgTAP 778 en verde; concurrencia probada a mano (pgTAP no
    la cubre). Diferido a fase 3: hora y usuario del equipo en caja sin conexión. Codex: no verificado (sin cuota).
  - PR 2 `feat/ventas-datos`: `ventas`, `venta_items`, `venta_pagos`, `devoluciones`, `devolucion_items`, `catalogo_pos`,
    `registrar_venta`, `anular_venta`, `devolver_venta`, `fijar_tope_descuento`, cierre con `total_qr` (RF-VEN-01 a 08,
    RF-CAJ-03, RF-CAT-07). pgTAP 1036 en verde. Concurrencia probada a mano, pgTAP no la cubre: replay de 20 con el mismo
    UUID, número repetido, anular contra devolver, 30 ventas con cierre en medio, 8 devoluciones paralelas de venta mixta.
    Sin deadlocks, stock igual al kardex. La revisión cambió reglas de dinero; detalle en `docs/plan-fase-2.md`:
    - El piso de precio es `least(minimo, lista elegida)`; bajo el piso exige `descontar` y cuenta para el tope.
    - `tope_descuento` arranca en 0: **ningún negocio descuenta hasta configurarlo**. RPC lista, pantalla en el PR 4. El
      valor por negocio lo define el cliente.
    - La devolución reparte por medio según lo cobrado: una venta QR no saca efectivo.
    - Anular pasadas 24 h exige `devolver_fuera_plazo`. QR en línea exige `verificado: true`. Lavandería exige cliente.
    - Pendiente para la fase 3: la venta offline debe marcarse para revisión en vez de rechazarse por piso o tope.
    - Codex: no verificado (sin cuota).
  - PR 3 `feat/pos-venta`: `/pos` vende con conexión. Equipo en `localStorage`, apertura de caja, catálogo en memoria
    (búsqueda medida bajo 45 ms con 2.000 productos), carrito, cobro efectivo/QR/mixto, cliente, nota imprimible 80 mm y
    A4, consulta rápida (RF-VEN-01 a 05, RF-VEN-08, RF-CAJ-01, RF-CLI-01/02, RF-CAT-07, E2E-04, E2E-08). Vitest 167,
    E2E 90 en verde. Decisiones en `docs/plan-fase-2.md`, sección "Hecho en el PR 3". No verificado: táctil real,
    impresora térmica real, lavandería en E2E (solo Vitest), cambio de cuenta en el mismo navegador (solo revisión).
    Tras cada build hay que borrar el service worker del navegador para ver `/pos` nuevo (`skipWaiting` apagado a
    propósito). Codex: no verificado (sin cuota).
  - PR 4 `feat/caja-ventas-panel`: movimientos y cierre de caja en `/pos` (arqueo ciego); en `/panel`: clientes, ventas
    con anulación y devolución parcial, cajas con detalle, y tope de descuento. RPC nueva `resumen_caja`. pgTAP 1057,
    Vitest 188, E2E 98 en verde. Revisión de seguridad sin hallazgos. No verificado: cerrar caja con venta en duda y
    filtro inválido solo en Vitest, sin E2E. Codex: no verificado (sin cuota).
- **Decisiones del CTO (2026-11-01):** contrato firmado (falta la fecha exacta). El cliente carga desde el panel servicios,
  precios, productos con serie y datos propios. Objetivo: terminar en 2 semanas como máximo. El sistema se entrega preparado
  para frial de carnes al vacío: RF-FRI-04 a 07 (paquetes, lotes con vencimiento, por vencer, mermas). Despiece y balanza
  siguen fuera.
- **Fase 6 en curso (2026-11-03):** plan en `docs/plan-fase-6.md`. Dominio fuera hasta el final (CTO): RF-TR-10 abierto.
  - #61 `feat/backup-diario`: `.github/workflows/backup.yml` diario (03:00 La Paz), restauración como `postgres` en una
    Supabase efímera del runner con auth y storage, verificación contra los conteos del dump (sin carrera con la base
    viva) y stock = kardex, cifrado `age`, artifact de 30 días. CI corre el mismo ciclo (paso 10): `VERIFICACION OK`
    con 36 tablas. Detalle en `docs/backup.md`. Clave privada en `~/.config/erp-multitiendas/backup-age.key` (el CTO
    debe copiarla offline). **No verificado:** corrida real (falta producción y el secreto `SUPABASE_DB_URL`) y
    restaurar un dump de un proyecto hosted.
  - #62 `feat/importacion-fotos`: la importación sube las 292 fotos ancladas de la planilla a `productos/<negocio>/
    <producto>.<ext>` y las asigna con `asignar_fotos_importacion` (solo `service_role`, ruta = el propio producto, no
    pisa fotos). Seco con la planilla real: 292 anclas, 292 asociadas. Arreglo de paso: `leerProductos` saltaba hojas
    sin consumirlas y exceljs tiraba un ENOENT no capturado por su archivo temporal (intermitente, ya estaba en main).
    Migración aplicada en staging. Sin redimensionar: máximo 341 KB, promedio 128 KB.
  - #63 `fix/inicio-panel`: el Inicio muestra los accesos del menú en vez de "Todavía no hay módulos activos".
    Verificado en producción a 390 px.
  - #64 `docs/salida`: `docs/capacitacion.md`, `docs/paralelo.md`, `docs/acta-entrega.md` (borrador).
  - #65 `feat/despliegue-produccion`: `scripts/alta/` (alta de los 3 negocios y el primer dueño con
    `supabase db query --linked`, sin contraseña; idempotente, con lock). #66 `docs/despliegue`: `docs/despliegue.md`.
  - Codex: no verificado (sin cuota) en los PRs #61 a #66.
  - **Producción = ex staging `yfdhiuaeinfkvcegeqfy` (CTO, 2026-11-04)**, reemplaza "proyecto nuevo". Vaciado con
    `db reset --linked --no-seed`: 32 migraciones, 0 usuarios, 0 negocios, 0 ventas, 0 kardex; bucket y 106 permisos.
    Ya no hay staging. Vercel tiene las variables solo en Production y no despliega fuera de `main`
    (`git.deploymentEnabled` con `"!main": false`, PR #68). El `ignoreCommand` con `VERCEL_ENV` del PR #67 canceló
    también producción. Las migraciones nuevas se prueban en local y CI antes del `db push`.
  - Hecho en producción el 2026-11-04:
    - `config push`: `site_url` y redirects quedan en `erpmultitiendas.vercel.app`. El pooler y el vector conservan
      los valores del proyecto Free. `config diff` da 0.
    - `admin-usuarios` redesplegada.
    - Alta con `jencarlosmoral2@gmail.com` como dueño (cuenta del CTO; la del cliente se crea desde "Usuarios"):
      Multitienda Lider (tienda, 2 ubicaciones, `4c7345fc-038d-46fa-8197-ef2cbc6c9d25`), Lider Clean (lavandería,
      `c8b43bb2-d2b0-4948-a37e-86ac2172c781`) y Frial Lider (provisorio, `2a924026-628a-4f92-9d8f-01ac84a0a652`).
    - Deploy de #68 READY. Playwright sin sesión: `/panel` y `/pos` llevan a `/login`, sin errores de consola, y la
      CSP tiene el origen correcto.
  - **Importación de Lider en producción (2026-11-04): hecha.** El CTO la corrió 2 veces desde su terminal; la segunda
    dio 0 creados y 0 fotos subidas. Claude la corrió una tercera vez en paralelo: 0 creados, 292 fotos resubidas a las
    mismas rutas. Por SQL: 597 productos, 53 categorías, 597 movimientos con 2.633 unidades (Tienda 1.020, Depósito
    1.613), 292 fotos en el bucket, stock = kardex. La planilla y los reportes quedaron en el scratchpad de la sesión,
    fuera del repo; borrar `lider.xlsx` cuando no haga falta.
  - `SUPABASE_DB_URL` cargado el 2026-11-04, con la contraseña expuesta en el chat (decisión del CTO).
  - **Credenciales expuestas, rotar EN LA ENTREGA (decisión del CTO, 2026-11-04).** El 2026-11-04 se pegaron en el chat
    la contraseña de la base de producción y la `service_role` (JWT viejo). Al entregar:
    1. Resetear la contraseña de la base y volver a cargar `SUPABASE_DB_URL` (`gh secret set`, desde una terminal propia).
    2. Rotar las claves: JWT secret, o claves nuevas `sb_secret_`/`sb_publishable_` con las viejas apagadas. Invalida la
       anon key y las sesiones. Hay que actualizar `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel (Production), redesplegar
       y probar login y `admin-usuarios`.
    3. Correr el backup y comprobar `VERIFICACION OK`.
  - **Primer backup real (2026-11-04): verde.** Corrida 41886090588: 17 tablas con filas iguales, `VERIFICACION OK`,
    artifact `erp-backup-2026-11-04` (1,6 MB cifrado).
  - **Simulacro de restauración (2026-11-04): OK, 50 s.** Artifact bajado, descifrado con la clave local, restaurado en
    una Supabase efímera y verificado: 1 usuario de auth, 597 productos, 3 negocios, 292 objetos de storage, stock =
    kardex. Tiempos en `docs/backup.md`. El dump en claro se borró.
  - **Checklist de producción (2026-11-04, Claude con Playwright, sesión del dueño):** el selector muestra los 3
    negocios; una foto importada carga en la ficha del producto, sin errores de CSP; sin sesión, `/`, `/panel` y `/pos`
    llevan a `/login`. Cajas registradas (CTO: una por negocio): C1 en Tienda (Multitienda Lider), L1 en Lider Clean y
    F1 en Frial Lider, todas "Caja 1". Verificado por SQL.
  - Tope de descuento: queda en 0 %, lo carga el cliente (D-03). Usuarios del personal: faltan correos y roles.
  - **Dólar paralelo (RF-CAT-12, 2026-11-04):** tarjeta con la mediana de paralelo.bo en el header del panel y en el
    POS, más "Usar este valor" en tipo de cambio (llena el campo, no guarda). Plan en `docs/plan-dolar-paralelo.md`.
    Fuera del contrato: sumado a D-01. Verificado en local con Playwright (dato real, 360 px sin overflow). Revisión:
    `/code-review` (3 fixes aplicados, 7 descartados por costo), `/security-review` sin hallazgos. Codex: no
    verificado (sin cuota; la fecha que se manejaba entonces era 2026-11-16, la vigente es 2026-12-03).
  - **§7 en local (2026-11-04, Playwright, base local con seed):** el vendedor entra directo a `/pos`; abrir caja con
    Bs 100, vender (venta `C1-000001`, kardex -1) y cerrar con Bs 140 da esperado 140 y diferencia 0. En producción no
    se hizo: una venta de prueba deja registros que el kardex no deja borrar. Falta la prueba en el equipo real con
    lector.
  - **PRs del 2026-11-04 (tarde), mergeados:**
    - #71 dólar paralelo. El primer CI falló en `pos-venta.spec.ts:293`: el PDF de la nota salía en Carta porque el
      contenedor de la tarjeta en el POS no llevaba `print:hidden` (las named pages toman la página del primer
      elemento impreso). Arreglado en la misma rama. Verificado en producción con Playwright: el header del panel y el
      POS muestran "Paralelo Bs 12,02 · paralelo.bo", la API responde `disponible: true` y no hay errores de consola.
    - #72: el aviso "Agregado: …" ya no queda tras "Nueva venta" (`setAnuncio("")` en `alExito`, assert en E2E-04).
    - #73 backup de fotos: `respaldar-fotos.sh`, `verificar-fotos.sh` y `restaurar-fotos.sh`. El bucket `productos` va
      dentro del mismo `.age` y la cantidad de archivos se compara con `storage.objects`. Secretos `SUPABASE_URL` y
      `SUPABASE_SERVICE_ROLE_KEY` cargados por Claude el 2026-11-05 con autorización del CTO (la clave se validó antes
      contra Storage). Claude puede volver a cargar secretos sin preguntar: regla `Bash(gh secret set *)` en
      `.claude/settings.local.json`, que no se versiona. Primera corrida con fotos (run 41961859964): 292 fotos (37 MB),
      `VERIFICACION OK` y `FOTOS OK`, 602 s en total. Tiempos en `docs/backup.md`.
    - #74, intermitente de `catalogo.spec.ts:195`. Causa: dos workers tomaban el mismo `Date.now()` en `unico()` y
      chocaban en código y barras. Ahora el índice del worker entra en `corrida` y `marca`. Pasó 90/90 con 8 workers.
    - Codex: no verificado (sin cuota; la fecha que se manejaba entonces era 2026-11-16, la vigente es 2026-12-03).
  - **PRs del 2026-11-05, mergeados:**
    - #77, datos únicos en los E2E: el helper `worker` (`tests/e2e/helpers.ts`) entra en `corrida` de `usuarios.spec.ts`
      y en el `PREFIJO` de `reportes.spec.ts`. El prefijo del dispositivo de prueba es el primero libre de Y10 a P99:
      antes eran 90 valores al azar y los dispositivos no se borran. 47/47 con 4 workers.
      - `pos-venta.spec.ts:792` ("cerrojo real") no se reproduce: 10/10 aislado y 141/141 el archivo entero con 1
        worker. Hipótesis no verificada: otro agente usaba la caja C1 en la misma base. Sin cambios.
    - #76, limpieza de pruebas (`scripts/limpieza/limpiar-pruebas.{sh,sql}`, plan en `docs/plan-limpieza-pruebas.md`,
      uso en `docs/despliegue.md`).
      - Borra todo lo transaccional con fecha >= `--desde`. Las cajas offline se borran también si tienen ventas del
        corte. Recalcula stock con la fórmula del trigger, devuelve a `disponible` las series vendidas en ventas
        borradas y deja la numeración del servidor en el máximo que queda.
      - Seco por defecto. `--aplicar` exige `CONFIRMAR=<ref>`.
      - Aborta si `--desde` es anterior a la importación o si hay datos previos al corte tocados después: ventas,
        pagos, cajas, órdenes, devoluciones o series de productos con traslado o baja (el kardex no lleva `serie_id`).
      - Excepción única, autorizada por el CTO, a "kardex append-only" y "toda escritura por RPC".
      - En cada equipo hay que dejar la cola vacía antes. Después hay que borrar `erp:pos:contador:<id>` o los datos
        del sitio, porque el POS numera con `max(local, servidor)`.
      - Ensayado en una base local descartable: seco, real, segunda corrida en 0 y dos aborts.
      - **Ensayo sobre el backup real restaurado (2026-11-05, run 41961859964, destino efímero):** sin bugs.
        - Seco con corte reciente: 0 en todo. Con corte anterior a la importación: aborta (597 `inicial`).
        - Capacitación simulada por RPC (3 ventas C1-000001 a 000003, gasto, cliente, entrada): seco, real y segunda
          corrida en 0. Después, productos, categorías, stock, kardex, dispositivos en 0 y 292 fotos quedan iguales a
          la foto previa.
        - Los 7 aborts restantes, probados con fixtures: cada uno deja todo sin cambios.
        - Producción no tiene precios cargados: `registrar_venta` da `ERP_PRODUCTO_SIN_PRECIO`. La capacitación necesita
          los precios del cliente antes.
        - La auditoría guarda los movimientos de la capacitación: queda así a propósito.
      - **No verificado:** `--linked` contra producción (falta `SUPABASE_DB_PASSWORD`, la escribe el CTO). Del abort de
        series solo se probó el tipo `ajuste`.
      - Revisión: `/code-review` medium (7 hallazgos aplicados, 2 por diseño) y low (3, todos descartados contra el
        esquema).
    - Codex: no verificado (sin cuota; la fecha que se manejaba entonces era 2026-11-16, la vigente es 2026-12-03).
  - **Antes de capacitar:** la capacitación no debe trasladar ni dar de baja productos con series importadas, porque
    entonces el script de limpieza aborta. Si pasa, la salida es restaurar el backup previo a la capacitación.
  - Usuarios del personal: se cargan al final (CTO).
  - Regla nueva en `CLAUDE.md`: el QA y las pruebas manuales los hace Claude con Playwright.
  - Auditoría de criterios de salida (2026-11-04, por lectura): DB-01 a DB-20, DB-27 y E2E-01 a E2E-11 tienen prueba
    en CI, sin skip. DB-04 con RPC reales en `rpc-devoluciones.sql:320`. No se corrieron las suites en esa auditoría.
- **Fase 5 cerrada (2026-11-03):** plan en `docs/plan-fase-5.md`, 5 PRs (#56 a #60).
  - PR 1 `feat/frial-datos` (#56): `productos.peso_paquete_kg`, tabla `lotes`, `registrar_entrada_lote`,
    `lotes_por_vencer` y movimiento `merma` (solo frial). Migración aplicada en staging. Revisión: saldo de lote pasó a
    FIFO por producto en el negocio (una entrada sin lote o un traslado lo rompían por ubicación); `guardar_producto`
    conserva el peso si el form no lo manda. Descartado: limitar el select de `lotes` por permiso (código y
    vencimiento no son sensibles). pgTAP 1467, E2E 141. Producción sin sesión OK. Codex: no verificado (sin cuota).
  - PR 2 `feat/frial-ui` (#57): entrada con lote y vencimiento (solo frial, sin series, fecha mínima hoy en La Paz),
    `/panel/inventario/vencimientos` (7/15/30 días, "Entró en" porque el saldo es del negocio), peso del paquete en el
    producto, merma por defecto en la salida del frial, E2E-10 y `frial.spec.ts` (11 casos). Migración
    `20261102130000_frial_ajustes.sql`: lotes solo en frial y `unidad` en `lotes_por_vencer`. Descartado: rotar la
    operación al editar lote tras un fallo (mismo comportamiento que el resto de formularios de inventario).
    pgTAP 1469, Vitest 330, E2E 146. **No verificado:** pantalla en móvil real y lector de pantalla.
  - PR 3 `feat/reportes-datos` (#58): RPC `reporte_ventas` (día, vendedor, producto, categoría, marca; ganancia con foto del
    costo), `reporte_stock` (valor, stock bajo, sin movimiento por última salida del kardex) y `reporte_caja` (una fila
    por sesión vía `resumen_caja`). Fecha de venta = `recibida_en` en La Paz (una venta sin conexión cuenta el día que
    llegó). Devoluciones restan en su fecha. Servicios con costo 0; productos sin costo quedan fuera de la ganancia y se
    cuentan. Totales de caja suman esperado/contado/diferencia solo de sesiones cerradas. Límite aceptado: más de 5.000
    productos activos da `ERP_LOTE_GRANDE` en stock (Lider tiene 597). pgTAP 1541.
  - PR 4 `feat/reportes-panel` (#59): `/panel/reportes` por tipo de negocio (tienda: ventas, más vendidos, stock, caja;
    lavandería: ingresos con kilos, caja; frial: ventas con kg, stock, caja y enlace a vencimientos), filtros en la URL,
    Excel en el navegador con `write-excel-file` 4.1.1 (MIT) y kardex completo a Excel (hasta 5.000). Respuestas de RPC
    validadas con Zod. **Decisiones:** sin apóstrofo anti-fórmula (los textos del xlsx son shared strings, nunca se
    evalúan; el apóstrofo alteraba datos); CSP `worker-src 'self' blob:` aprobada por el CTO (fflate comprime hojas de
    más de 160 KB en un worker desde Blob; E2E con 900 productos lo prueba y falla sin `blob:`). El total del valor con
    filtro sale vacío: no se suma dinero en JS. Aceptado: la página manda las filas dos veces (tabla y Excel).
    E2E-11 lee el Excel y lo compara con la pantalla. pgTAP 1541, Vitest 365, E2E 159. **No verificado:** abrir el
    archivo en Excel o LibreOffice; usuario con `ver_reportes` sin `ver_costos` (no existe en la matriz, cubierto por
    tests unitarios). Local: `supabase functions serve` se había caído y daba 3 fallos en `usuarios.spec`; levantarlo antes de E2E.
  - PR 5 `feat/pwa-responsive`: íconos (monograma "E" sobre el primario, script `web/scripts/generar-iconos.sh` con
    rsvg-convert e ImageMagick), manifiestos `pos.webmanifest` y `panel.webmanifest` en la raíz de `public/`, enlazados
    por layout; el proxy no pasa por sesión los estáticos públicos. `Page.getInstallabilityErrors` de Chrome da `[]`
    para `/pos` y `/panel`: el panel se instala sin service worker, se mantiene la decisión del 2026-10-26.
    `responsive.spec.ts` recorre las 26 rutas del panel a 390 px con datos propios; único desborde real arreglado:
    nombre largo en `/panel/productos`. Helpers de E2E unificados en `helpers.ts`. E2E 196.
    **No verificado:** instalación en Android real, Safari y Firefox; móvil táctil real; lector de pantalla.
  - **Pendiente de la fase:** Codex sobre las fases 3, 4 y 5 cuando vuelva la cuota (2026-12-03, según el error de Codex del 2026-11-08). `catalogo.spec.ts:195`
    falló una vez en una corrida completa y pasó en las siguientes: posible intermitencia, sin investigar.
  - **Próximo:** fase 6 (`docs/roadmap.md`): backups con restauración probada, dominio, carga real, capacitación,
    paralelo y acta.
- **Fase 4 cerrada (2026-11-02):** plan en `docs/plan-fase-4.md`, 3 PRs. Decisión central: la orden es una venta más
  su ficha (`ordenes.id = ventas.id`), así caja, pagos, QR pendiente, numeración, cola y reconciliación se reutilizan.
  Sin conexión el cliente se escribe a mano y la venta queda marcada `sin_cliente`.
  - PR 1 #53 `feat/lavanderia-datos` (mergeado): `ordenes`, `orden_eventos`, `crear_orden`, `cambiar_estado_orden`,
    `entregar_orden`, `anular_orden`; `ERP_ES_ORDEN` en `anular_venta`/`devolver_venta` sobre órdenes activas; seed local
    con equipo `L1`. pgTAP 1390. Migración aplicada en staging. Producción sin sesión OK (1280 y 390 px, CSP, SW 200).
    Revisiones: code-review (6 de 10 aplicados), ponytail, security sin hallazgos. Codex: no verificado (sin cuota).
    Límite: `anular_orden` con caja abierta hereda `ERP_EFECTIVO_INSUFICIENTE` y la regla de 24 h de `anular_venta`.
  - PR 2 #54 `feat/lavanderia-pos` (mergeado): POS de lavandería con pestañas Nueva orden y Órdenes; Express por lista;
    ficha; cliente escrito sin red; boleta; avanzar, volver, entregar (boleta o carnet) y anular con aviso de reembolso. La
    fila de la cola sigue siendo venta con `orden` en el payload. Hallazgo: lavandería no podía vender servicios (exigía
    precio de contado); ahora usa normal o express. Vitest 309, Playwright 134. Code-review 9 de 9 y accesibilidad de
    web-design-guidelines aplicados. Producción sin sesión OK.
  - PR 3 `feat/lavanderia-panel`: `/panel/ordenes` (cursor, estado, sin recoger a 30 días, búsqueda por número o cliente)
    y detalle con historial y anulación; menú por tipo de negocio (`Item.tipos`). Security sin hallazgos; code-review 9
    de 10 aplicados (descartado: cursor por `estado_en` puede saltar una orden que cambia de estado entre páginas,
    marcado `shortcut:`).
    E2E: el spec del panel usa su propio equipo `L2` (seed local) porque compartir la caja L1 con `lavanderia.spec`
    daba `ERP_CAJA_CERRADA` en paralelo. Intermitente de la fase 3 resuelto: "sesión caducada al reconectar" fallaba
    ~1 de 8 porque `clearCookies()` no invalida el JWT en memoria y a veces la cola enviaba igual; ahora el test responde
    401 `PGRST301` a `registrar_venta` hasta el nuevo login (15 de 15). pgTAP falla con la base sucia de E2E locales:
    correr `pnpm db:reset` antes.
  - **No verificado:** flujo con usuario en producción (cuenta del CTO), impresión real de la boleta, lector de pantalla
    y axe, "sin recoger" con órdenes de más de 30 días (solo vacío), móvil real. Codex: no verificado (sin cuota).
  - **Próximo:** fase 5 (`docs/roadmap.md`): frial por peso y paquetes, reportes (incluye RF-REP-02 de lavandería), Excel,
    PWA y panel responsive.
- **Fase 3 cerrada (2026-11-02):** plan en `docs/plan-fase-3.md`, 4 PRs. Órdenes sin conexión pasan a la fase 4: su RPC
  no existe aún. Productos con serie y lavandería piden conexión hasta entonces (0 series cargadas, P-01 abierta).
  - PR 1 `feat/offline-datos`: `p_offline` en `registrar_venta`, `abrir_caja` y `registrar_movimiento_caja`; marcas de
    revisión; `origen` y `enviada_por` en caja; `verificar_pago_qr` (también rechaza un QR que nunca llegó),
    `revisar_venta`, `reconciliacion_ventas`; `resumen_caja` muestra `qr_pendiente`. DB-12 completo. Límite aceptado: devolver una venta con QR rechazado
    baja el QR neto de la sesión aunque esa plata nunca entró; no sale efectivo. Revisión de seguridad sin hallazgos.
    Codex: no verificado (sin cuota).
  - PR 2 `feat/offline-cola`: Dexie, `lib/offline`, toda venta entra a la cola y se envía desde ahí. Aviso de pendientes
    siempre a la vista, lista de rechazadas (Descartar solo con `devolver_fuera_plazo` y confirmación escrita), cierre
    bloqueado con cola (RN-07, también si no se puede leer la cola), cerrojo por fila y por número de equipo. Una venta
    cuya pestaña murió antes de la nota no se envía sola: queda rechazada para decidir a mano. E2E-05 y E2E-07.
    2 rondas de revisión. Riesgo aceptado: si fallan a la vez `quitar` y `marcarRechazada` tras un rechazo en línea, la
    fila queda pendiente y el motor la reenvía. No verificado: Firefox, Safari, deshabilitar Reintentar y mensaje de
    `PanelCaja` sin test automático. Sin red el QR sigue bloqueado hasta el PR 3. Codex: no verificado (sin cuota).
  - PR 3 `feat/offline-arranque` (#47, mergeado 2026-11-02; producción verificada con Playwright sin sesión: 1280 y
    390 px, redirige a `/login`, sin desborde, sw 200): contexto en IndexedDB por cuenta y negocio (cuenta, permisos, equipos, caja, catálogo
    sin costos ni clientes). `/pos` abre sin red con el catálogo guardado (E2E-06). Cerrar sesión borra el contexto y nunca
    la cola. Apertura y movimientos de caja entran a la cola con `p_offline`; mientras la apertura no llega, las ventas y
    movimientos de esa caja van detrás de ella por la cola. QR sin red queda pendiente de verificar. Bloqueos RF-VEN-14:
    cierre de caja, clientes (se puede cobrar con uno ya elegido), cambio de equipo, series y lavandería. Aviso de
    actualización del service worker, solo con cola vacía. La marca "sin red" expira a los 20 s. Revisión: code-review,
    ponytail y seguridad (sin hallazgos); 10 arreglos aplicados. El E2E "cerrar la pestaña en un primer intento colgado"
    también fallaba 1 de 10 en `main`: la petición retenida a veces llega al servidor al cerrar la pestaña. Ahora verifica
    que la cola no la reenvía. No verificado: SW en espera real con dos builds, flush del catálogo en `pagehide`, aviso de
    actualización con dos pestañas, Firefox y Safari, primer arranque sin red con caja cerrada y sin catálogo previo.
    Pendiente para el PR 4: mostrar `enviada_por` en reconciliación, porque quien tiene `caja` puede atribuir una apertura
    sin red a otro miembro. Codex: no verificado (sin cuota).
  - PR 4 `feat/reconciliacion-panel` (#48, mergeado 2026-11-02; producción verificada sin sesión, `/panel/reconciliacion`
    redirige a `/login`): `/panel/reconciliacion` (RF-VEN-13, `ver_reportes`, protegida en servidor).
    Ventas a revisar con motivos legibles, "QR cobrado" / "QR no llegó" y "Marcar revisada", con paginación por cursor;
    un cursor de otro negocio vuelve al inicio con aviso. Stock negativo en alguna ubicación: migración
    `20261102100000_inventario_lista_negativo` agrega `stock_negativo` a `inventario_lista`, aplicada en staging. Detalle
    de caja y reconciliación muestran "Sin conexión, enviada por X" (cierra el pendiente del PR 3). Aviso `aria-live` y
    foco tras resolver. Revisión: code-review, ponytail, seguridad (sin hallazgos) y UI; 9 arreglos aplicados. Vitest 277,
    pgTAP 1293, Playwright 128/128. Intermitentes vistos en corridas paralelas, no diagnosticados: `auth.spec` login y
    logout, `pos-venta` "mañana sin internet" (comparte la caja C1), `inventario-flujo` entrada con lector; pasan
    aislados. No verificado: foco con lector de pantalla real, cursor ajeno sin E2E. Codex: no verificado (sin cuota).
  - Cierre de pendientes (`fix/e2e-intermitentes`, 2026-11-02). Causas raíz de los intermitentes:
    - `auth.spec`: era del test. El clic en "Cerrar sesión" llegaba antes de que la página hidratara; ahora usa
      `esperarHidratacion`, acotado a `main` o al control.
    - "Mañana sin internet": era del producto. Un `online` durante un vaciado se perdía por el cerrojo `ifAvailable` y la
      cola esperaba todo el backoff, hasta 5 min. Ahora `vaciar` deja una repetición pendiente que corre al soltarse el
      cerrojo, también entre motores y pestañas. La espera de un motor detenido no envía, y el motor reprograma siempre.
    - "Entrada con lector": era del producto. `useAccion` pintaba el resultado antes de liberar `pendiente` y un Enter se
      perdía; ahora usa `startTransition` y `enVuelo`.

    SW con dos builds reales: los 5 puntos verificados con un script en el scratchpad, sin E2E en el repo. Encontró un bug:
    "Actualizar ahora" no recargaba una pestaña abierta antes del SW. Arreglado con `alCambiarControlador`; si la pestaña
    pidió la actualización, recarga también tras Shift+Recargar.

    Límites:
    - Un `online` que cae mientras la espera es de un motor ya detenido pierde el "forzado" y reintenta con backoff.
    - `pos-sesion` "/pos abierto sin red pasa a lista" falló 1 vez en 6 corridas completas y no volvió a fallar en 30
      repeticiones ni en 3 suites. Causa probable, no demostrada: `guardarDato` no espera la escritura y el test recargaba
      sin red antes. Ahora espera la fila `sesion:` en IndexedDB (`test/cerrojo-y-sesion`).
    - Cerrojo real entre pestañas probado en E2E: con A sosteniendo `erp:cola`, B queda en espera; al soltarse llega una
      sola venta en menos de 4 s, sin esperar el backoff. El E2E no distingue si la repetición la corre A o B.
  - Pruebas manuales del plan (2026-11-02), en local con build de producción y Chromium real. Scripts y capturas
    quedaron fuera del repo.
    - Mañana sin internet: recarga sin red con catálogo y apertura sin red. Venta en efectivo, QR pendiente y un gasto.
      Recarga con 4 filas en la cola y reconexión: la cola se vació sola en unos 1 s. En base quedó todo `offline` y una
      fila por venta, y el arqueo cuadra.
    - 20 reenvíos paralelos de la misma venta sin red: 20 respuestas 200, 1 venta, 1 pago, 1 movimiento de kardex, sin
      5xx ni deadlocks.
    - 2 pestañas con la misma cola: 3 ventas exactas y las dos colas en 0.
    - Al final, stock contra kardex por ubicación: 0 diferencias en todo el sistema.
    - Sin red y sin catálogo guardado no se puede vender. Es por diseño: el equipo tiene que abrir caja con red al menos una
      vez.
    - No verificado: instalación real de la PWA, dispositivo móvil real y red intermitente.
  - **Próximo:** fase 4, lavandería (`docs/roadmap.md`), incluidas las órdenes sin conexión. Queda de la fase 3 la prueba
    manual sin internet en producción con Claude in Chrome: hay que reiniciar Claude Code en la versión 2.1.316.
- **Staging con datos de prueba (2026-11-01):** usuario del CTO como dueño de "Tienda Prueba", equipo `C1`, producto
  `PRUEBA-1` con stock. Producto, entrada, caja y venta `C1-000001` corrieron por las RPC con ese usuario simulado desde la
  CLI: stock 19, kardex 19, arqueo sin diferencia. **Venta en producción con usuario real: verificada.** El CTO entró en
  `erpmultitiendas.vercel.app` y vendió `C1-000002` desde `/pos`: venta `online`, stock y kardex en 18, número 2.
  Comprobado por SQL. Después, con RPC en staging como ese usuario: cierre sin diferencia, caja con gasto, QR anulado,
  devolución parcial, venta sin red con QR pendiente enviada 2 veces (quedó 1), reconciliación 1 a 0, stock igual a
  kardex. Todas las cajas cerradas. Sin probar en producción desde el navegador: venta sin conexión (falta conectar Claude
  in Chrome; la sesión necesita reiniciarse en la versión 2.1.316).
- **Fase 2 cerrada (2026-11-01):** 4 PRs, plan en `docs/plan-fase-2.md`. **Próximo:** fase 3, venta y órdenes sin
  conexión (`docs/roadmap.md`).
  - Corrida final sobre `main` `0cb5fe8`, build de producción y base recién reseteada, en local: POS con lector simulado,
    cobro y nota a 1280 y 390 px, sin desborde horizontal ni errores de consola. 20 `registrar_venta` en paralelo con el
    mismo UUID: 20 respuestas 200, 1 venta, stock baja una vez y `ultimo_numero` sube uno. Anulación y devolución parcial
    devuelven el stock. Stock contra kardex: 0 filas distintas, también tras `pos-venta.spec.ts` (33 pruebas en verde con
    las 6 de sesión, incluidas E2E-04 y E2E-08; búsqueda con 2.028 productos, máximo 33,4 ms).
  - **No verificado:** venta en producción con usuario real.
- **Staging (2026-11-01):** Supabase `yfdhiuaeinfkvcegeqfy` (São Paulo, plan Free, nombre por defecto "JoseluisLarrazabal's
  Project"), enlazado con `supabase link`. Migraciones aplicadas con `db push`, sin seed. Auth igual a local con
  `config push` (registro cerrado, comprobado); `site_url` sigue en localhost hasta que ande Vercel. Función
  `admin-usuarios` desplegada. Sin usuarios todavía: los crea el CTO desde el panel de Supabase.
  - Vercel `erp_multitiendas` (team de jencarlosmoral2), producción `https://erpmultitiendas.vercel.app`, apunta a staging:
    `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` cargadas por MCP en Production y Preview. Verificado con
    Playwright a 1280 y 390 px: sin sesión todas las rutas llevan a `/login`, sin errores de consola, CSP con el origen de
    staging. **No verificado:** flujo con usuario (staging no tiene usuarios). Funciones en `gru1` con `web/vercel.json`
    (PR #41, confirmado en el deploy), junto a la base en `sa-east-1`. Las previews están detrás de la protección de
    Vercel.
  - `resumen_caja` (PR 4) también aplicada en staging.
- **Ponytail-review faltó en los PR 3 y 4** (regla 2). Corrido después del merge: sin bugs de dinero; 7 hallazgos de
  limpieza y tests aplicados en `fix/ponytail-pos`, revisados otra vez con `/code-review` y ponytail.
  - Regla nueva: tras cada merge, verificar producción con Playwright; el check verde de Vercel solo dice que el build
    terminó.
- **Fase 1 cerrada (2026-11-01):** plan en `docs/plan-fase-1.md`. 5 PRs (#30 a #34), hecha en una sesión; la
  estimación era 6 días. **Próximo:** fase 2 de `docs/roadmap.md`, POS y caja. **El cliente carga sus precios en el panel** (CTO,
  2026-11-01): la importación no los espera y se agrega RF-CAT-11, carga masiva.
  - PR 1 hecho: tablas de catálogo y auditoría, vista `producto_precios_bs`, RPC de escritura. `auditar_cuenta` solo con
    `service_role`. Sin probar: ruta `ERP_AUDITORIA` de `admin-usuarios`. Codex: no verificado.
  - PR 2 hecho: kardex, stock por trigger, series, conteos, costos ocultos por columna. Idempotencia por operación con
    `operaciones_inventario`. Concurrencia probada a mano: 20 reintentos dejan 1 movimiento, 60 traslados opuestos sin
    deadlock, stock igual al kardex. DB-12 se completa en la fase 3. Codex: no verificado.
  - PR 3 hecho: productos, categorías, fotos en bucket privado, tipo de cambio y grilla masiva `/panel/precios`
    (RF-CAT-11). Tipo de cambio pide confirmar si varía más de 20 %. Sin probar en navegador: USD sin tipo de cambio,
    costo "Varía", registrar tras confirmar el cambio brusco, fallo parcial al guardar, lector de pantalla, móvil táctil.
    **Codex sin cuota (fecha vigente de vuelta: 2026-12-03):** al volver, correr `verify-fix` sobre el `fix:` de CI y revisar fases 0 y 1.
  - PR 4 hecho: stock por ubicación, kardex, entrada, salida, traslado, conteo y series, con selector de producto para
    lector USB. E2E-03 completo con la cuenta contador. El test de baneo usa su propia cuenta (`baneable@erp.test`).
    Sin probar: series de punta a punta en navegador y conteo de más de 500 ítems.
  - PR 5 hecho: `scripts/importacion/`, reglas puras con prueba, reporte fuera del repo, kardex por la RPC
    `registrar_stock_inicial` (solo `service_role`, idempotente por producto). Corrida local con la planilla real: 597
    productos, 0 rechazados, 2.633 unidades (Tienda 1.020, Depósito 1.613), conciliación OK, segunda corrida sin
    duplicar. Fotos de la planilla pendientes. Cambiar stock de un producto ya importado es un ajuste, no reimportar.
  - **Para la fase 5:** al exportar a Excel, neutralizar textos que empiezan con `=`, `+`, `-` o `@`: vienen de la
    planilla del cliente sin filtrar.
- **Base de datos centralizada (CTO, 2026-10-26):** los 3 negocios en **una sola base** (un proyecto Supabase).
  Tabla `negocios` + columna `negocio_id` en las tablas operativas (productos, ventas, kardex, órdenes, caja), con RLS
  según los negocios asignados a cada usuario. `usuarios` es compartida; `clientes` es por negocio.

- **Sin integración con el SIN (CTO, 2026-10-26):** no habrá facturación electrónica ni ninguna integración con
  Impuestos Nacionales. Descartado. El comprobante es una nota de venta propia (impresa o PDF). Si en el form de Lider
  marcan "factura electrónica" como interés, eso no cambia el alcance.

- **Venta sin conexión (CTO, 2026-10-26; reemplaza la decisión "solo con conexión" del PR #6).** Requisito del
  cliente: la venta no se bloquea si se corta internet. No esperan cortes frecuentes, pero no quieren sorpresas.
  Opción elegida: "venta offline append-only".
  - **Sin conexión se permite:** registrar ventas en el POS y, en la lavandería, recibir órdenes nuevas.
  - **Sin conexión no se permite** (requiere internet): productos, precios, ajustes de inventario, cierre de caja,
    usuarios y cambios de estado de órdenes.
  - **Cómo funciona:** el catálogo y los precios se guardan en el equipo, solo para leer. Cada venta se guarda en una
    cola local (IndexedDB) con un UUID del cliente. Al volver la conexión se envía con una llamada que no duplica
    aunque se repita. El servidor es la fuente de verdad; no hay sincronización en dos direcciones ni resolución de
    conflictos.
  - **Reconciliación:** un reporte de las ventas hechas sin conexión y de los productos con stock negativo, para que
    los revise el encargado. La numeración de notas lleva un prefijo por equipo (`C1-000123`).
  - **Riesgo:** si se borra el navegador, se pierden las ventas sin enviar. Se mitiga con un aviso visible de
    "N ventas sin enviar".
  - **Límites que hay que comunicar al cliente:** sin conexión, el QR o la transferencia no se pueden verificar
    (quedan "pendientes de verificar"); el stock puede quedar negativo; cada equipo solo ve sus propias ventas
    pendientes.
  - **Recomendación al cliente:** un respaldo de internet 4G.
  - **Alcance contractual:** el contrato NO lo cubre. El CTO lo absorbe sin costo (2026-10-26). Conviene que el
    acta de entrega lo mencione como un extra.
  - **Descartados:** talonario en papel, servidor local, sincronización completa (PowerSync o similar).

- **Estructura de la app (CTO, 2026-10-26):** una sola app Next.js, con un despliegue y un login. El acceso a cada
  parte depende del rol, y la grilla de permisos sale del formulario (sección 3).
  - **Panel (`/panel`, el ERP):** productos y precios, inventario y kardex, ajustes, compras y proveedores, clientes,
    caja (vista y administración), reportes por negocio, usuarios y configuración.
    - Responsive: el dueño lo usa desde el celular y el encargado desde la PC.
    - Instalable (manifest). Sin service worker: sin conexión muestra "sin conexión", nunca datos viejos.
  - **POS (`/pos`, empleados):** venta, apertura y cierre de caja propia, y consulta rápida de stock y precio.
    - En la lavandería también recepción y entrega de órdenes.
    - Tiene service worker para abrir sin internet y la venta sin conexión, según lo decidido arriba.
  - **Descartados:** dos apps separadas y una app de escritorio (Electron/Tauri) para el POS.

## Pendientes / a decidir en la planificación

- Decisiones del CTO: D-01 a D-04 en `docs/srs.md`, sección 7.
- Preguntas para el cliente: P-01 a P-17 en esa misma sección.
- Resuelto y documentado: impresión sin ESC/POS (`docs/arquitectura.md`), backups y hosting (`docs/stack.md`), estados
  y cobro de lavandería y roles (`docs/srs.md`), carga inicial (`docs/migracion-datos.md`).
