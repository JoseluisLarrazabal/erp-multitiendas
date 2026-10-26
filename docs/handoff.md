# Handoff — ERP Multitiendas

Documento vivo. Fuente de verdad para planificar y ejecutar el proyecto.
Última actualización: 2026-10-26.

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
    Registrar aquí la fecha de envío. El plazo de 30 días corre desde que el cliente lo devuelve completo.
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
- **Formularios ENVIADOS al cliente: 2026-10-26** (los 3 links por WhatsApp). Esperando respuestas; el plazo de
  30 días corre desde que los devuelva completos. No verificado: si las 3 planillas de carga ya se compartieron como
  Editor.
- **Próximo:** (1) stack propuesto en `docs/stack.md` (Vercel Pro + Supabase Pro, ~$45/mes; falta que el CTO confirme y definir quién paga); (2) núcleo
  del modelo de datos en `docs/plan-modelo-datos.md` (borrador del núcleo listo; lo marcado [FORM] espera respuestas); (3) scaffold de la app real. El prototipo
  `sistema-de-gestion-multinacional/` NO se pule: es una maqueta estática y queda solo como mapa de módulos y
  referencia visual.
- **Base de datos centralizada (CTO, 2026-10-26):** los 3 negocios en **una sola base** (un proyecto Supabase).
  Propuesta a confirmar en el diseño del modelo: tabla `negocios` + columna `negocio_id` en las tablas operativas
  (productos, ventas, kardex, órdenes, caja), con RLS según los negocios asignados a cada usuario. `usuarios` es
  compartida; `clientes` compartida o por negocio según lo que conteste en la sección 4 del form de Lider.

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
    caja (vista y administración), reportes, consolidado de los 3 negocios, usuarios y configuración.
    - Responsive: el dueño lo usa desde el celular y el encargado desde la PC.
    - Instalable (manifest). Sin service worker: sin conexión muestra "sin conexión", nunca datos viejos.
  - **POS (`/pos`, empleados):** venta, apertura y cierre de caja propia, y consulta rápida de stock y precio.
    - En la lavandería también recepción y entrega de órdenes.
    - Tiene service worker para abrir sin internet y la venta sin conexión, según lo decidido arriba.
  - **Descartados:** dos apps separadas y una app de escritorio (Electron/Tauri) para el POS.

## Pendientes / a decidir en la planificación

- **Stack:** la base (Next.js, Supabase, PWA) se puede definir ahora. Queda abierta hasta tener las respuestas de
  los formularios: la impresión directa ESC/POS y el cajón de dinero, según el hardware (sección 3).
- **Supabase Free:** según lo que sabemos, no tiene backups automáticos y se pausa tras 7 días sin actividad. Hay que
  elegir entre Pro y un `pg_dump` programado. Revisar los términos actuales.

- **Hosting de la app:** Vercel Hobby es solo para uso no comercial; si lo detectan pueden suspender la cuenta
  (y caerían todos los proyectos de esa cuenta, incluido Elegance). Alternativa gratis con uso comercial:
  Cloudflare Workers/Pages (Next.js vía OpenNext). Decidir y verificar términos vigentes.
- **Frial:** unidad de medida por peso (decimales en kg) en ventas, stock y kardex desde el diseño.
- **Lavandería:** flujo de estados de la orden y cobro (¿anticipo al recibir / saldo al entregar?).
- **Roles de usuario** por negocio (¿un usuario ve los 3 negocios o solo el suyo?).
- **Carga inicial de datos:** formato en que el cliente entrega listados de productos, precios e inventario.
