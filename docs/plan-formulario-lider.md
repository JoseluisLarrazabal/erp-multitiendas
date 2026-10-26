# Plan — Formulario de relevamiento: Multitienda Lider (electrodomésticos)

## Contexto

Contrato ERP/POS multi-negocio (tienda Lider, lavandería y frial de carnes) firmado con anticipo cobrado
(`docs/handoff.md`). Según el contrato, el plazo de 30 días corre **desde la firma más la recepción de la
información del cliente**, así que el formulario es lo que dispara ese plazo. Necesitamos sacarle al dueño todo lo necesario para
diseñar el ERP de la tienda de electrodomésticos (línea blanca y negra). Lavandería y frial vienen después
con el mismo mecanismo.

El prototipo `sistema-de-gestion-multinacional/` es un mock v0 estático (Next 16 + Tailwind, un solo `page.tsx`,
datos hardcodeados, marca "multinacional"). Sirve de **mapa de módulos** para el cuestionario (ventas, compras,
clientes, entregas, productos, inventario/kardex, reportes, caja, config, consolidado), pero en esta
iteración **no se toca**. Pulirlo es la siguiente etapa.

**Decisiones del CTO (2026-10-26):**
- Formato: **Google Form + planilla**, ambos generados por un Apps Script que el CTO corre una sola vez.
- Los módulos fuera de contrato (crédito/cuotas, entregas/instalación, caja, compras/proveedores, ubicaciones,
  facturación) **se preguntan integrados**, sin marcarlos aparte. Para no comprometernos, la redacción es neutra:
  "¿lo necesita / cómo lo hace hoy?" y nunca "el sistema tendrá".
- Repo: **git init en `ERP Multitiendas/` + GitHub privado**.
- Registro: **usted**, lenguaje simple. Nada de jerga sin explicar (p. ej. "kardex = registro de entradas y salidas").

## Entregables

1. `formularios/apps-script/formulario-lider.gs`: un solo archivo para pegar en script.google.com.
   Es data-driven: un array `SECCIONES_COMUNES` + `SECCIONES_LIDER` y un builder genérico
   `crearFormulario(titulo, descripcion, secciones)`, así lavandería y frial solo suman su array.
   Entry point `crearTodoLider()` que:
   - crea el Form (`FormApp.create`) con `setProgressBar(true)`, `setAllowResponseEdits(true)` (puede volver y
     completar), `setCollectEmail(true)`, un mensaje de confirmación y `setDestination(SHEETS, <planilla de respuestas>)`
     (queda la fecha y hora de recepción, que es la evidencia contractual);
   - crea la **planilla de carga** (SpreadsheetApp) con validaciones y pone su link en la descripción del form;
   - hace `Logger.log` de 3 URLs: editar form, link público para el cliente y planilla de carga.
   - Tipos que usa el builder: `texto`, `parrafo`, `opcion` (con `otro`), `casillas` (con `otro`), `lista`,
     `grillaCasillas`, `fecha`, `seccion` (PageBreak con descripción). **Sin subida de archivos:** FormApp no
     puede crear ítems FILE_UPLOAD, así que el logo y los archivos se mandan por WhatsApp o se cargan en la planilla.
   - **Sin saltos condicionales.** Las secciones opcionales arrancan con "Si no aplica a su negocio, presione
     Siguiente". Es más robusto que la navegación por ramas.
2. `formularios/apps-script/test-mock.mjs`: autochequeo con Node. Carga el `.gs` en `vm` con stubs que registran
   llamadas de `FormApp`/`SpreadsheetApp`/`Logger` y verifica que `crearTodoLider()` no tire errores, que no haya
   títulos vacíos ni duplicados en una misma sección y el conteo de secciones/ítems. Corre con `node formularios/apps-script/test-mock.mjs`.
3. `formularios/README.md`: 6 pasos para correrlo (script.google.com, pegar, ejecutar, autorizar, copiar URLs,
   compartir la planilla con el correo del cliente con permiso de editor y mandar el link del form por WhatsApp).
4. `docs/plan-formulario-lider.md`: copia de este plan (regla 8) + puntero en `docs/handoff.md`.

## Contenido del formulario (fuente para el subagente; redacción final en el `.gs`)

**Intro:** para qué es; ~30–40 min; puede guardar y volver con el link que le llega por correo; si no sabe
algo, que lo deje en blanco o ponga "no sé" y lo vemos en reunión; link a la planilla de carga.

**Comunes (sirven para los 3 negocios):**
1. **Datos del negocio:** nombre comercial (Multitienda Lider), titular/razón social, NIT, dirección, ¿cuántos
   locales?, ¿depósito separado? (+ dirección), teléfono/WhatsApp, correo, horario, qué datos van en la nota de
   venta (casillas: nombre, NIT, dirección, teléfono, logo, texto de garantía, redes, QR de pago), moneda
   (Bs / USD / ambos) y quién fija el tipo de cambio y cada cuánto.
2. **Cómo trabajan hoy:** cómo registran ventas e inventario (cuaderno / Excel / otro sistema, ¿cuál? / nada),
   qué datos quieren pasar al sistema, problemas principales, qué es imprescindible desde el día 1, volumen
   (ventas/día por rangos, productos distintos por rangos).
3. **Personas y accesos:** cuántos usuarios; lista nombre–cargo–tarea; **grilla de permisos** (filas: vender, ver
   costo y ganancia, dar descuentos, anular/devolver, cargar/ajustar inventario, crear/editar productos y precios,
   ver reportes, abrir/cerrar caja, administrar usuarios × columnas: dueño, encargado, vendedor, todos);
   ¿el personal se cruza entre los 3 negocios?; dispositivos (PC, celular, tablet, el dueño desde casa);
   internet en el local (estable / se corta / no hay, porque define si hace falta modo sin conexión);
   impresora (térmica 58 / 80 mm / A4 / ninguna / no sé), lector de código de barras, cajón de dinero.
4. **Los 3 negocios juntos:** ¿panel consolidado?, ¿clientes compartidos?, ¿pasa dinero o mercadería de un
   negocio a otro?

**Específicas Lider:**
5. **Productos:** categorías (casillas + otro: refrigeradores, freezers, lavadoras, secadoras, cocinas, hornos/
   microondas, campanas, calefones/termotanques, climatización, TV, audio, celulares/tablets, computación,
   pequeños electrodomésticos, muebles, colchones, motos/bicicletas); marcas principales; código de barras de
   fábrica (todos / algunos / no); código interno propio; **¿registrar el número de serie por unidad?** (todos /
   algunos / no, una decisión clave del modelo de datos); garantía (propia / del fabricante, plazo típico, ¿la
   registran?); tipos de precio (contado, crédito, mayorista, mínimo/tope de descuento, USD); quién cambia los
   precios y cada cuánto; combos; cómo manejan las variantes (color/capacidad); recordatorio de la planilla.
6. **Inventario y kardex:** origen de la mercadería (distribuidor local / importación / consignación); ¿registran
   el costo de compra?; **método de costo** (promedio / último costo / no sé, lo definimos juntos); salidas que no
   son venta (dañado, faltante/robo, devolución a proveedor, uso interno, exhibición, cambio por garantía,
   traslado a otro negocio); quién autoriza los ajustes; frecuencia del conteo físico; alertas de stock bajo;
   **fecha posible del conteo inicial** (fecha); exhibición (¿se vende?, ¿a otro precio?); ¿necesita stock por
   ubicación (tienda/depósito)?; proveedores principales; ¿registrar compras a proveedores?, ¿cuentas por pagar?
7. **Ventas y caja:** cómo es hoy una venta paso a paso; formas de pago (efectivo Bs/USD, QR, transferencia,
   tarjeta, crédito propio, financiera externa, permuta); pago mixto; descuentos (quién y tope %); reservas con
   anticipo; comprobante (nota impresa / factura con su sistema actual / PDF por WhatsApp); ¿factura hoy?, ¿con qué?,
   ¿le interesa factura electrónica?; devoluciones y cambios (plazo, ¿devuelve el dinero o da un vale?);
   apertura/cierre/arqueo diario, ¿una caja o varias?, gastos y retiros de caja; comisiones de vendedores.
8. **Crédito y cuotas** (opcional): plazos, interés/recargo, cuota inicial, frecuencia, garante, datos y documentos
   que piden, ¿cobrador?, mora, cuántos créditos activos hay hoy, recordatorios por WhatsApp, plan de pagos impreso.
9. **Entregas e instalación** (opcional): ¿domicilio?, ¿costo?, ¿vehículo propio?, ¿instalan?, ¿quién?, agenda,
   servicio técnico/garantías.
10. **Clientes:** datos que piden (casillas), ¿cliente obligatorio o "cliente general"?, avisos/promos por
    WhatsApp, ¿hay lista para cargar?
11. **Reportes:** casillas (ventas día/mes, por vendedor, por producto/categoría/marca, ganancia, stock valorizado,
    más vendidos, sin movimiento, stock bajo, kardex por producto, caja diaria, cuentas por cobrar, cuotas
    vencidas, comparativo de los 3 negocios); formato (pantalla / PDF / Excel / resumen diario por WhatsApp);
    quién los ve; qué número mira usted primero cada día.
12. **A futuro y cierre:** casillas de interés (más sucursales, catálogo web/tienda online, app, factura
    electrónica, contabilidad, WhatsApp integrado); comentarios; persona de contacto y horario; casilla de
    confirmación obligatoria: "La información es correcta y completa a la fecha".

**Planilla de carga "Multitienda Lider — Datos iniciales"** (Google Sheet, se puede bajar como .xlsx):
- `Instrucciones`.
- `Productos`: código interno, código de barras, descripción, marca, modelo, categoría (lista desde
  `Categorías`), línea (blanca / negra / pequeños / otros), precio costo Bs, precio contado Bs, precio crédito Bs,
  precio mínimo Bs, stock actual, stock mínimo, ¿controla nro de serie? (Sí/No), garantía (meses), observaciones.
  Números con validación ≥ 0, encabezado congelado, 2 filas de EJEMPLO en gris.
- `Números de serie`: código interno, nro de serie, ubicación.
- `Clientes` (opcional): nombre, CI/NIT, teléfono, dirección, saldo de crédito pendiente.
- `Usuarios`: nombre, cargo, celular, correo, negocio(s), rol.
- `Categorías`: lista editable que alimenta el desplegable.

## Pasos de ejecución

1. **Chairman:** `git init` en `/home/shadowfreak/Documents/ERP Multitiendas` y `.gitignore` raíz (node_modules,
   .next, .env*). Commit inicial en `main` con el prototipo y los docs (base necesaria; queda como única excepción
   a "no commitear directo a main"). `gh repo create erp-multitiendas --private --source . --push`. Rama
   `feat/formulario-lider`. Guardar `docs/plan-formulario-lider.md` y el puntero en el handoff.
2. **Subagente Sonnet** (`general-purpose`, `model: "sonnet"`): escribe los entregables 1–3 según este plan, corre
   `node formularios/apps-script/test-mock.mjs` y reporta la salida.
3. **Chairman:** revisa el diff y el contenido (que estén todas las preguntas, el tono "usted" y que nada prometa
   funciones) y corre el test. Después `/code-review` + `/ponytail-review` sobre el `.gs`. Los hallazgos van a otro
   Sonnet nuevo (regla 1).
4. **CTO:** corre el script en script.google.com (~2 min) y me pasa las 3 URLs. Opcional: tema y color del form
   desde la UI de Forms.
5. **Chairman:** verifica el form publicado con Playwright (navega todas las secciones y toma un snapshot del árbol
   a11y) y revisa la planilla (pestañas y validaciones).
6. **Cerrar:** commit, push y PR (sin atribución IA, regla 3). No hay CI, así que se mergea tras la revisión, se
   borra la rama y se sincroniza `main`. Actualizar `docs/handoff.md`: formulario Lider listo, fecha de envío al
   cliente (el plazo arranca cuando lo devuelva completo) y siguiente paso (formularios de lavandería y frial con
   el mismo script).

## Trampas

- FormApp **no** crea ítems de subida de archivos (por eso planilla + WhatsApp).
- `setCollectEmail` en cuentas personales agrega el campo de correo, no obliga a iniciar sesión. Está bien así.
- Límite de títulos en Forms: preguntas cortas y el detalle en `setHelpText`.
- No hardcodear el correo del cliente en el script: la planilla la comparte el CTO a mano.

## Verificación

- `node formularios/apps-script/test-mock.mjs` en verde (sin errores; conteo de secciones/ítems ≥ al plan).
- El form real se crea sin errores en Apps Script; Playwright recorre las ~13 páginas y encuentra todas las preguntas.
- La planilla tiene las 6 pestañas y los desplegables/validaciones funcionan (ingresar un precio negativo muestra advertencia).
- Prueba de punta a punta: el CTO manda una respuesta de prueba, aparece en la planilla de respuestas con fecha y hora, y después se borra.
