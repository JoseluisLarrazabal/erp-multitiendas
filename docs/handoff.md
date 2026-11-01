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
  - **Próximo:** fase 1, plan en `docs/plan-fase-1.md`.
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
- **Fase 1 en curso (2026-11-01):** plan en `docs/plan-fase-1.md`. **El cliente carga sus precios en el panel** (CTO,
  2026-11-01): la importación no los espera y se agrega RF-CAT-11, carga masiva.
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
