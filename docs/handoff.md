# Handoff — ERP Multitiendas

Documento vivo. Fuente de verdad para planificar y ejecutar el proyecto.
Última actualización: 2026-11-01.

## Estado actual

- **Contrato redactado**, pendiente de firma: `/home/shadowfreak/Downloads/Contrato_ERP_Hinojosa_Claros.docx`
  (basado en el contrato de Elegance Dominio Barbería). Solo falta la fecha de firma (a mano).
- **Anticipo cobrado** (50%). Saldo (50%) se cobra a la entrega, contra firma del acta de entrega.
- **Desarrollo:** sin empezar. Repo: `github.com/JoseluisLarrazabal/erp-multitiendas` (privado).
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
      kardex y reportes. `lotes` y `despieces` fuera de la primera versión. Recomendado acordar por escrito que se
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
  - **Pendiente CTO:** D-01 a D-04 del SRS (adenda de extras, frial sin catálogo, aviso del plazo, firma del contrato).
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
- **Fase 3 en curso (2026-11-01):** plan en `docs/plan-fase-3.md`, 4 PRs. Órdenes sin conexión pasan a la fase 4: su RPC
  no existe aún. Productos con serie y lavandería piden conexión hasta entonces (0 series cargadas, P-01 abierta).
  - PR 1 `feat/offline-datos`: `p_offline` en `registrar_venta`, `abrir_caja` y `registrar_movimiento_caja`; marcas de
    revisión; `origen` y `enviada_por` en caja; `verificar_pago_qr` (también rechaza un QR que nunca llegó),
    `revisar_venta`, `reconciliacion_ventas`; `resumen_caja` muestra `qr_pendiente`. DB-12 completo. Límite aceptado: devolver una venta con QR rechazado
    baja el QR neto de la sesión aunque esa plata nunca entró; no sale efectivo. Revisión de seguridad sin hallazgos.
    Codex: no verificado (sin cuota).
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
    **Codex sin cuota hasta el 2026-11-16:** al volver, correr `verify-fix` sobre el `fix:` de CI y revisar fases 0 y 1.
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
