/**
 * Formularios de relevamiento + planillas de carga: Multitienda Lider, Lavandería y Frial.
 * Pegar en script.google.com y ejecutar UNA sola vez cada función (cada una crea archivos nuevos):
 * crearTodoLavanderia(), crearTodoFrial(). crearTodoLider_YA_EJECUTADO() ya se ejecutó: no volver a correrla.
 * Un negocio nuevo = una constante SECCIONES_X, sus hojas de carga y una función crearTodoX.
 *
 * Cada pregunta: { tipo, titulo, ayuda?, opciones?, otro?, obligatoria?, filas?, columnas? }
 * tipos: texto | parrafo | opcion | casillas | lista | grillaCasillas | fecha
 * FormApp no puede crear subida de archivos: el logo se pide por WhatsApp.
 * Deben ser las primeras funciones del archivo: el editor deja seleccionada la primera en Ejecutar.
 */

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------
function crearTodoLavanderia() {
  crearTodo({
    nombre: 'Lavandería',
    intro: introNegocio('lavandería', 'servicios, clientes y personas'),
    secciones: seccionesComunes({
      ejemploNombre: 'Ej.: Lavandería Lider.',
      comprobante: 'boleta',
      inventario: false,
      ejemploDatos: 'Ej.: lista de servicios y precios, clientes, saldos pendientes.',
      volumen: [
        { tipo: 'lista', titulo: 'Órdenes por día (aprox.)', opciones: ['Menos de 10', '10 a 30', '31 a 60', 'Más de 60', 'No sé'] },
        { tipo: 'lista', titulo: 'Kilos de ropa por día (aprox.)', opciones: ['Menos de 50', '50 a 150', '151 a 300', 'Más de 300', 'No sé'] },
      ],
      permisos: {
        filas: [
          'Recibir ropa y crear órdenes', 'Cambiar el estado de una orden', 'Cobrar y entregar', 'Anular una orden',
          'Dar descuentos', 'Cambiar precios', 'Ver reportes y ganancias', 'Abrir y cerrar caja', 'Administrar usuarios',
        ],
        columnas: ['Dueño', 'Encargado', 'Empleado', 'Todos'],
      },
    }).concat(SECCIONES_LAVANDERIA),
    planilla: { titulo: 'Lavandería — Datos iniciales', instrucciones: INSTRUCCIONES_LAVANDERIA, hojas: HOJAS_LAVANDERIA },
  });
}

function crearTodoFrial() {
  crearTodo({
    nombre: 'Frial',
    intro: introNegocio('frial de carnes al vacío', 'productos, clientes, proveedores y personas'),
    secciones: seccionesComunes({
      ejemploNombre: 'Ej.: Frial Lider.',
      comprobante: 'nota de venta',
      volumen: [
        { tipo: 'lista', titulo: 'Ventas por día (aproximado)', opciones: ['Menos de 10', '10 a 30', '31 a 100', 'Más de 100', 'No sé'] },
        { tipo: 'lista', titulo: 'Productos o cortes distintos', opciones: ['Menos de 30', '30 a 100', 'Más de 100', 'No sé'] },
      ],
      permisos: {
        filas: [
          'Vender', 'Ver costo y ganancia', 'Dar descuentos', 'Anular o devolver una venta', 'Registrar compras y despiece',
          'Ajustar inventario y mermas', 'Cambiar precios', 'Ver reportes', 'Abrir y cerrar caja', 'Administrar usuarios',
        ],
        columnas: ['Dueño', 'Encargado', 'Vendedor', 'Todos'],
      },
    }).concat(SECCIONES_FRIAL),
    planilla: { titulo: 'Frial — Datos iniciales', instrucciones: INSTRUCCIONES_FRIAL, hojas: HOJAS_FRIAL, categorias: CATEGORIAS_FRIAL },
  });
}

function crearTodoLider_YA_EJECUTADO() {
  crearTodo({
    nombre: 'Multitienda Lider',
    intro: function (urlPlanilla) {
      return 'Este formulario nos ayuda a armar el sistema de gestión de su tienda Multitienda Lider.\n\n' +
        'Tarda unos 30 a 40 minutos. Si no sabe una respuesta, déjela en blanco o escriba "no sé": la vemos juntos en la reunión. ' +
        'Si necesita más tiempo, avísenos por WhatsApp. Después de enviarlo puede corregir sus respuestas con el enlace "Editar tu respuesta" que aparece al final.\n\n' +
        'Además de este formulario, puede llenar la planilla de carga con su lista de productos, clientes y personas:\n' +
        urlPlanilla + '\n\n' +
        'El logo de su negocio mándelo por WhatsApp.';
    },
    secciones: seccionesComunes({
      ejemploNombre: 'Ej.: Multitienda Lider.',
      comprobante: 'nota de venta',
      volumen: [
        { tipo: 'lista', titulo: 'Ventas por día (aproximado)', opciones: ['Menos de 10', '10 a 30', '31 a 100', 'Más de 100', 'No sé'] },
        { tipo: 'lista', titulo: 'Productos distintos que maneja', opciones: ['Menos de 100', '100 a 500', '501 a 2000', 'Más de 2000', 'No sé'] },
      ],
      permisos: {
        filas: [
          'Vender', 'Ver costo y ganancia', 'Dar descuentos', 'Anular o devolver una venta',
          'Cargar o ajustar inventario', 'Crear o editar productos y precios', 'Ver reportes',
          'Abrir y cerrar caja', 'Administrar usuarios',
        ],
        columnas: ['Dueño', 'Encargado', 'Vendedor', 'Todos'],
      },
    }).concat(SECCION_TRES_NEGOCIOS, SECCIONES_LIDER),
    planilla: { titulo: 'Multitienda Lider — Datos iniciales', instrucciones: INSTRUCCIONES_CARGA, hojas: HOJAS_CARGA, categorias: CATEGORIAS },
  });
}

// Intro de lavandería y frial (la de Lider va aparte: es más larga).
function introNegocio(descripcion, contenidoPlanilla) {
  return function (urlPlanilla) {
    return 'Este formulario nos ayuda a armar el sistema de gestión de su ' + descripcion + '.\n\n' +
      'Tarda unos 20 a 30 minutos. Si no sabe una respuesta, déjela en blanco o escriba "no sé": la vemos juntos en la reunión. ' +
      'Después de enviarlo puede corregir sus respuestas con el enlace "Editar tu respuesta" que aparece al final.\n\n' +
      'Si este negocio lo atiende un encargado, puede llenarlo él.\n' +
      'Si un dato es igual que en Multitienda Lider (titular, NIT, correo), escriba "igual que Lider".\n' +
      'Las preguntas sobre los 3 negocios juntos están en el formulario de Multitienda Lider.\n\n' +
      'Además de este formulario, puede llenar la planilla de carga con su lista de ' + contenidoPlanilla + ':\n' +
      urlPlanilla + '\n\n' +
      'El logo de su negocio mándelo por WhatsApp.';
  };
}

// Flujo común: planilla → form → confirmación → planilla de respuestas → logs.
function crearTodo(cfg) {
  const p = cfg.planilla;
  const planilla = crearPlanilla(p.titulo, p.instrucciones, p.hojas, p.categorias);

  const form = crearFormulario(
    cfg.nombre + ' — Relevamiento para su sistema de gestión',
    cfg.intro(planilla.getUrl()),
    cfg.secciones
  );
  form.setConfirmationMessage(
    'Gracias, recibimos su información. Si necesita corregir algo, use el enlace "Editar tu respuesta" de esta página o avísenos por WhatsApp.'
  );

  const respuestas = SpreadsheetApp.create(cfg.nombre + ' — Respuestas formulario');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, respuestas.getId());

  Logger.log('Editar el formulario: ' + form.getEditUrl());
  Logger.log('Link para el cliente: ' + form.getPublishedUrl());
  Logger.log('Planilla de carga: ' + planilla.getUrl());
  Logger.log('Planilla de respuestas: ' + respuestas.getUrl());
}

const SI_NO = ['Sí', 'No'];
const SI_NO_NS = ['Sí', 'No', 'No sé'];

const FACTURACION = [
  { tipo: 'opcion', titulo: '¿Emite factura hoy?', opciones: SI_NO },
  { tipo: 'texto', titulo: 'Si factura, ¿con qué sistema?' },
  { tipo: 'opcion', titulo: '¿Le interesa la factura electrónica?', opciones: SI_NO_NS },
];

const CATEGORIAS = [
  'Refrigeradores', 'Freezers', 'Lavadoras', 'Secadoras', 'Cocinas',
  'Hornos y microondas', 'Campanas', 'Calefones y termotanques', 'Climatización',
  'Televisores', 'Audio', 'Celulares y tablets', 'Computación',
  'Pequeños electrodomésticos', 'Muebles', 'Colchones', 'Motos y bicicletas',
];

// ---------------------------------------------------------------------------
// Secciones comunes 1 a 3 (sirven para los 3 negocios)
// n: { ejemploNombre, comprobante, volumen: [2 preguntas lista], permisos: { filas, columnas },
//      inventario?: false omite la pregunta de inventario, ejemploDatos?: ayuda de "qué datos pasar" }
// ---------------------------------------------------------------------------
function seccionesComunes(n) {
  return [
    {
      titulo: '1. Datos del negocio',
      descripcion: 'Datos básicos de su negocio. Si no sabe algo, déjelo en blanco o escriba "no sé".',
      preguntas: [
        { tipo: 'texto', titulo: 'Nombre comercial', ayuda: 'Tal como quiere que aparezca en sus comprobantes. ' + n.ejemploNombre },
        { tipo: 'texto', titulo: 'Titular o razón social', ayuda: 'Nombre de la persona o empresa dueña del negocio.' },
        { tipo: 'texto', titulo: 'NIT' },
        { tipo: 'parrafo', titulo: 'Dirección del local' },
        { tipo: 'opcion', titulo: '¿Cuántos locales tiene?', opciones: ['Uno', 'Dos', 'Tres o más'] },
        { tipo: 'opcion', titulo: '¿Tiene un depósito separado del local?', opciones: SI_NO },
        { tipo: 'parrafo', titulo: 'Dirección del depósito', ayuda: 'Solo si respondió Sí en la pregunta anterior.' },
        { tipo: 'texto', titulo: 'Teléfono o WhatsApp del negocio' },
        { tipo: 'texto', titulo: 'Correo electrónico del negocio' },
        { tipo: 'parrafo', titulo: 'Horario de atención', ayuda: 'Ej.: lunes a sábado de 9:00 a 19:00.' },
        {
          tipo: 'casillas', titulo: '¿Qué datos van en la ' + n.comprobante + '?', otro: true,
          ayuda: 'Marque todo lo que quiere que se imprima o se envíe al cliente. El logo nos lo manda por WhatsApp.',
          opciones: ['Nombre del negocio', 'NIT', 'Dirección', 'Teléfono', 'Logo', 'Texto de garantía', 'Redes sociales', 'QR de pago'],
        },
        { tipo: 'opcion', titulo: '¿En qué moneda trabaja?', opciones: ['Bolivianos (Bs)', 'Dólares (USD)', 'Ambas'] },
        {
          tipo: 'parrafo', titulo: 'Tipo de cambio: ¿quién lo fija y cada cuánto?',
          ayuda: 'Solo si trabaja con dólares. Ej.: lo fija el dueño, una vez por semana.',
        },
      ],
    },
    {
      titulo: '2. Cómo trabaja hoy',
      descripcion: 'Queremos entender cómo lleva hoy su negocio, sin juzgar. Cualquier forma de trabajo es válida.',
      preguntas: [
        {
          tipo: 'casillas', titulo: '¿Cómo registra hoy sus ventas?', otro: true,
          opciones: ['Cuaderno', 'Excel', 'Sistema de otra empresa', 'No las registro'],
        },
        {
          tipo: 'casillas', titulo: '¿Cómo lleva hoy su inventario?', otro: true, soloProductos: true,
          opciones: ['Cuaderno', 'Excel', 'Sistema de otra empresa', 'No lo llevo'],
        },
        { tipo: 'texto', titulo: 'Si usa un sistema, ¿cuál?', ayuda: 'Escriba el nombre del programa o de la empresa que se lo dio.' },
        {
          tipo: 'parrafo', titulo: '¿Qué datos quiere pasar al sistema nuevo?',
          ayuda: (n.ejemploDatos || 'Ej.: lista de productos, clientes, saldos de crédito.') + ' Puede cargarlos en la planilla de carga.',
        },
        { tipo: 'parrafo', titulo: 'Principales problemas de hoy', ayuda: 'Lo que más tiempo le quita o más errores le causa.' },
        { tipo: 'parrafo', titulo: '¿Qué es imprescindible desde el primer día?', ayuda: 'Lo que no puede faltar para que usted pueda trabajar.' },
        n.volumen[0],
        n.volumen[1],
      ].filter(function (q) { return n.inventario !== false || !q.soloProductos; }),
    },
    {
      titulo: '3. Personas y accesos',
      descripcion: 'Quiénes trabajan con el sistema y con qué equipos.',
      preguntas: [
        { tipo: 'lista', titulo: '¿Cuántas personas usarían el sistema?', opciones: ['1', '2 a 3', '4 a 6', '7 a 10', 'Más de 10'] },
        {
          tipo: 'parrafo', titulo: 'Lista de personas: nombre, cargo y tarea',
          ayuda: 'Una persona por línea. Ej.: Juan Pérez - vendedor - atiende el mostrador. También puede llenar la pestaña Usuarios de la planilla de carga.',
        },
        {
          tipo: 'grillaCasillas', titulo: 'Permisos: ¿quién puede hacer cada cosa?',
          ayuda: 'Marque en cada fila quién debería poder hacerlo. Puede marcar más de una columna.',
        filas: n.permisos.filas,
        columnas: n.permisos.columnas,
        },
        { tipo: 'opcion', titulo: '¿El personal trabaja en más de un negocio?', opciones: ['Sí', 'No', 'Algunos'] },
        {
          tipo: 'casillas', titulo: '¿Desde qué equipos se trabajaría?', otro: true,
          opciones: ['Computadora', 'Celular', 'Tablet', 'El dueño desde su casa'],
        },
        {
          tipo: 'opcion', titulo: 'Internet en el local',
          ayuda: 'Nos ayuda a saber si necesita poder trabajar cuando se corta el internet.',
          opciones: ['Estable', 'Se corta seguido', 'No hay'],
        },
        {
          tipo: 'casillas', titulo: 'Impresora', otro: true,
          ayuda: 'La térmica es la de rollo, como la de los supermercados.',
          opciones: ['Térmica de 58 mm', 'Térmica de 80 mm', 'Hoja A4', 'No tengo', 'No sé'],
        },
        { tipo: 'opcion', titulo: 'Lector de código de barras', opciones: ['Sí tengo', 'No tengo, pero lo necesito', 'No lo necesito'] },
        { tipo: 'opcion', titulo: 'Cajón de dinero', opciones: ['Sí tengo', 'No tengo, pero lo necesito', 'No lo necesito'] },
      ],
    },
  ];
}

// Pregunta global: solo va en el formulario de Lider.
const SECCION_TRES_NEGOCIOS = [
  {
    titulo: '4. Los 3 negocios juntos',
    descripcion: 'Preguntas sobre cómo se relacionan Lider, la lavandería y el frial de carnes.',
    preguntas: [
      { tipo: 'opcion', titulo: '¿Quiere ver los 3 negocios en un solo panel?', ayuda: 'Un resumen con las ventas de todos juntos.', opciones: SI_NO_NS },
      { tipo: 'opcion', titulo: '¿Los 3 negocios comparten clientes?', opciones: ['Sí', 'No', 'Algunos'] },
      {
        tipo: 'casillas', titulo: '¿Pasa dinero o mercadería de un negocio a otro?',
        ayuda: 'Si pasa, cuéntenos en Comentarios (última sección) cómo lo anota hoy.',
        opciones: ['Dinero', 'Mercadería', 'No pasa nada'],
      },
    ],
  }
];

// ---------------------------------------------------------------------------
// Secciones específicas de Lider (electrodomésticos)
// ---------------------------------------------------------------------------
const SECCIONES_LIDER = [
  {
    titulo: '5. Productos',
    descripcion: 'Cómo son sus productos y precios. Recuerde que la lista completa de productos puede cargarla en la planilla de carga (pestaña Productos).',
    preguntas: [
      { tipo: 'casillas', titulo: 'Categorías que vende', otro: true, opciones: CATEGORIAS },
      { tipo: 'parrafo', titulo: 'Marcas principales' },
      { tipo: 'opcion', titulo: 'Código de barras de fábrica', ayuda: 'Es el código impreso en la caja del producto.', opciones: ['Todos lo tienen', 'Solo algunos', 'Ninguno'] },
      { tipo: 'opcion', titulo: '¿Usa códigos propios?', ayuda: 'Un código interno que usted mismo le pone a cada producto.', opciones: ['Sí, en todos', 'Sí, en algunos', 'No'] },
      {
        tipo: 'opcion', titulo: '¿Anota el número de serie de cada unidad?',
        ayuda: 'El número de serie identifica una unidad exacta (por ejemplo, una lavadora) y sirve para saber a quién se vendió y para la garantía.',
        opciones: ['Sí, en todos los productos', 'Solo en algunos (ej.: línea blanca)', 'No'],
      },
      { tipo: 'opcion', titulo: 'Garantía que ofrece', opciones: ['Propia de la tienda', 'Del fabricante', 'Ambas', 'No ofrezco'] },
      { tipo: 'texto', titulo: 'Plazo típico de garantía', ayuda: 'Ej.: 12 meses.' },
      { tipo: 'opcion', titulo: '¿Anota qué cliente tiene garantía de qué producto?', opciones: ['Sí, la anoto', 'No la anoto'] },
      {
        tipo: 'casillas', titulo: 'Tipos de precio que maneja', otro: true,
        opciones: ['Contado', 'Crédito', 'Mayorista', 'Precio mínimo (tope de descuento)', 'Precio en dólares'],
      },
      { tipo: 'parrafo', titulo: '¿Quién cambia los precios y cada cuánto?' },
      { tipo: 'opcion', titulo: '¿Vende combos o paquetes?', ayuda: 'Ej.: refrigerador + cocina con descuento.', opciones: SI_NO },
      {
        tipo: 'parrafo', titulo: 'Colores o capacidades del mismo producto',
        ayuda: 'Ej.: un televisor en 43 y 55 pulgadas, o una lavadora en blanco y gris. ¿Los anota como un solo producto o como uno por cada variante?',
      },
    ],
  },
  {
    titulo: '6. Inventario y kardex',
    descripcion: 'El kardex es el registro de entradas y salidas de cada producto: cuánto entró, cuánto salió y cuánto queda.',
    preguntas: [
      { tipo: 'casillas', titulo: '¿De dónde viene su mercadería?', otro: true, opciones: ['Distribuidor local', 'Importación propia', 'Consignación'] },
      { tipo: 'opcion', titulo: '¿Anota el costo de compra de cada producto?', opciones: ['Sí, siempre', 'A veces', 'No'] },
      {
        tipo: 'opcion', titulo: 'Cómo calcula el costo de un producto',
        ayuda: 'Cuando compra el mismo producto a distinto precio: el costo promedio suma todas las compras y saca un promedio; el último costo usa lo que pagó la última vez. Si no sabe, lo definimos juntos.',
        opciones: ['Costo promedio', 'Último costo', 'No sé, lo definimos juntos'],
      },
      {
        tipo: 'casillas', titulo: 'Salidas de mercadería que no son venta', otro: true,
        opciones: ['Dañado', 'Faltante o robo', 'Devolución al proveedor', 'Uso interno', 'Exhibición', 'Cambio por garantía', 'Traslado a otro negocio'],
      },
      { tipo: 'texto', titulo: '¿Quién autoriza los ajustes de inventario?' },
      {
        tipo: 'opcion', titulo: 'Frecuencia del conteo físico',
        ayuda: 'Cada cuánto cuenta la mercadería real para compararla con lo anotado.',
        opciones: ['Cada semana', 'Cada mes', 'Cada 3 meses', 'Una vez al año', 'No hago conteo'],
      },
      { tipo: 'opcion', titulo: '¿Quiere avisos de stock bajo?', ayuda: 'Un aviso cuando quedan pocas unidades de un producto.', opciones: SI_NO_NS },
      { tipo: 'fecha', titulo: 'Fecha posible para el conteo inicial', ayuda: 'Es el día en que se contaría toda la mercadería para empezar con el stock correcto.' },
      {
        tipo: 'opcion', titulo: 'Productos de exhibición: ¿se venden?',
        opciones: ['Sí, al mismo precio', 'Sí, con descuento', 'No se venden'],
      },
      {
        tipo: 'opcion', titulo: '¿Necesita ver el stock por lugar?', ayuda: 'Por ejemplo, cuánto hay en la tienda y cuánto en el depósito.',
        opciones: ['Sí', 'No', 'No sé'],
      },
      { tipo: 'parrafo', titulo: 'Proveedores principales', ayuda: 'Nombre y qué le compra a cada uno.' },
      { tipo: 'opcion', titulo: '¿Anota las compras a proveedores?', opciones: ['Sí, las anoto', 'No, pero me serviría', 'No lo necesito'] },
      { tipo: 'opcion', titulo: '¿Anota lo que debe a proveedores?', ayuda: 'Se llama cuentas por pagar.', opciones: ['Sí, lo anoto', 'No, pero me serviría', 'No lo necesito'] },
    ],
  },
  {
    titulo: '7. Ventas y caja',
    descripcion: 'Cómo vende y cómo maneja el dinero.',
    preguntas: [
      { tipo: 'parrafo', titulo: 'Una venta de hoy, paso a paso', ayuda: 'Desde que el cliente llega hasta que se va con el producto.' },
      {
        tipo: 'casillas', titulo: 'Formas de pago que acepta', otro: true,
        opciones: ['Efectivo en Bs', 'Efectivo en USD', 'QR', 'Transferencia', 'Tarjeta', 'Crédito propio', 'Financiera externa', 'Permuta (equipo usado como parte de pago)'],
      },
      { tipo: 'opcion', titulo: '¿Acepta pagos combinados?', ayuda: 'Ej.: una parte en efectivo y otra por QR.', opciones: SI_NO },
      { tipo: 'texto', titulo: 'Descuentos: ¿quién los autoriza y hasta qué %?' },
      { tipo: 'opcion', titulo: '¿Hace reservas con anticipo?', ayuda: 'El cliente deja una parte del dinero para separar un producto.', opciones: SI_NO },
      {
        tipo: 'casillas', titulo: 'Comprobante que entrega', otro: true,
        opciones: ['Nota de venta impresa', 'Factura', 'PDF por WhatsApp', 'Ninguno'],
      },
      ...FACTURACION,
      { tipo: 'parrafo', titulo: 'Devoluciones y cambios', ayuda: '¿Hasta cuántos días acepta una devolución o cambio, y en qué condiciones?' },
      { tipo: 'opcion', titulo: 'En una devolución, ¿qué entrega?', opciones: ['Devuelve el dinero', 'Da un vale', 'Depende del caso'] },
      {
        tipo: 'opcion', titulo: 'Cierre de caja diario',
        ayuda: 'El arqueo es contar el dinero al cerrar y compararlo con lo vendido.',
        opciones: ['Hago arqueo todos los días', 'A veces', 'No hago'],
      },
      { tipo: 'opcion', titulo: '¿Cuántas cajas tiene?', opciones: ['Una', 'Más de una'] },
      { tipo: 'parrafo', titulo: 'Gastos y retiros de caja', ayuda: '¿Se paga algo desde la caja o se retira dinero? ¿Cómo lo anota hoy?' },
      { tipo: 'parrafo', titulo: 'Comisiones de vendedores', ayuda: '¿Paga comisiones? ¿Cómo se calculan?' },
    ],
  },
  {
    titulo: '8. Crédito y cuotas (opcional)',
    descripcion: 'Si no aplica a su negocio, presione Siguiente. Cuéntenos cómo vende a crédito hoy.',
    preguntas: [
      { tipo: 'texto', titulo: 'Plazos que ofrece', ayuda: 'Ej.: 6, 12 y 18 meses.' },
      { tipo: 'texto', titulo: 'Interés o recargo', ayuda: 'Ej.: 2% mensual.' },
      { tipo: 'texto', titulo: 'Cuota inicial', ayuda: 'Ej.: 30% del precio.' },
      { tipo: 'opcion', titulo: 'Frecuencia de las cuotas', otro: true, opciones: ['Semanal', 'Quincenal', 'Mensual'] },
      { tipo: 'opcion', titulo: '¿Pide garante?', ayuda: 'Una persona que responde si el cliente no paga.', opciones: ['Siempre', 'A veces', 'No'] },
      {
        tipo: 'casillas', titulo: 'Datos y documentos que pide', otro: true,
        opciones: ['Carnet de identidad', 'Comprobante de domicilio', 'Boleta de pago o ingresos', 'Referencias', 'Contrato firmado', 'Pagaré o letra de cambio'],
      },
      { tipo: 'opcion', titulo: '¿Tiene cobrador?', opciones: SI_NO },
      { tipo: 'parrafo', titulo: 'Cuando un cliente se atrasa', ayuda: '¿Cobra recargo? ¿Cómo lo contacta?' },
      { tipo: 'lista', titulo: 'Créditos activos hoy (aproximado)', opciones: ['Ninguno', '1 a 20', '21 a 100', 'Más de 100'] },
      { tipo: 'opcion', titulo: '¿Envía recordatorios de pago por WhatsApp?', opciones: ['Sí, ya lo hago', 'No, pero me serviría', 'No lo necesito'] },
      { tipo: 'opcion', titulo: '¿Entrega al cliente un plan de pagos impreso?', opciones: ['Sí', 'No', 'No, pero me serviría'] },
    ],
  },
  {
    titulo: '9. Entregas e instalación (opcional)',
    descripcion: 'Si no aplica a su negocio, presione Siguiente. Cuéntenos cómo entrega e instala hoy.',
    preguntas: [
      { tipo: 'opcion', titulo: '¿Entrega a domicilio?', opciones: SI_NO },
      { tipo: 'texto', titulo: '¿Cobra por la entrega?', ayuda: 'Ej.: Bs 50 dentro de la ciudad, gratis sobre cierto monto.' },
      { tipo: 'opcion', titulo: '¿Tiene vehículo propio?', opciones: ['Sí', 'No', 'Contrato el servicio'] },
      { tipo: 'opcion', titulo: '¿Instala los equipos?', opciones: ['Sí, todos', 'Solo algunos', 'No'] },
      { tipo: 'texto', titulo: '¿Quién hace la instalación?' },
      { tipo: 'parrafo', titulo: 'Cómo organiza las entregas e instalaciones', ayuda: '¿Usa una agenda, un cuaderno, WhatsApp?' },
      { tipo: 'parrafo', titulo: 'Servicio técnico y garantías', ayuda: 'Si un equipo falla, ¿cómo lo atiende hoy?' },
    ],
  },
  {
    titulo: '10. Clientes',
    descripcion: 'Qué datos de sus clientes guarda.',
    preguntas: [
      {
        tipo: 'casillas', titulo: 'Datos del cliente que pide', otro: true,
        opciones: ['Nombre', 'CI o NIT', 'Teléfono o WhatsApp', 'Dirección', 'Correo', 'Fecha de cumpleaños', 'Referencias'],
      },
      {
        tipo: 'opcion', titulo: '¿Registra al cliente en cada venta?',
        ayuda: '"Cliente general" es una venta sin nombre, para quien no quiere dar sus datos.',
        opciones: ['Siempre', 'Solo en créditos o con factura', 'Uso "cliente general" cuando no hace falta'],
      },
      { tipo: 'opcion', titulo: '¿Envía avisos o promociones por WhatsApp?', opciones: ['Sí, ya lo hago', 'No, pero me interesa', 'No me interesa'] },
      {
        tipo: 'opcion', titulo: '¿Tiene una lista de clientes para cargar?',
        ayuda: 'Puede pasarla en la pestaña Clientes de la planilla de carga.',
        opciones: ['Sí, en Excel', 'Sí, en cuaderno', 'No'],
      },
    ],
  },
  {
    titulo: '11. Reportes',
    descripcion: 'Los reportes son los resúmenes que usted quiere mirar para tomar decisiones.',
    preguntas: [
      {
        tipo: 'casillas', titulo: '¿Qué reportes necesita?', otro: true,
        opciones: [
          'Ventas del día y del mes', 'Ventas por vendedor', 'Ventas por producto, categoría o marca', 'Ganancia',
          'Valor del stock', 'Productos más vendidos', 'Productos sin movimiento', 'Productos con stock bajo',
          'Kardex por producto', 'Caja diaria', 'Cuentas por cobrar', 'Cuotas vencidas',
          'Comparativo de los 3 negocios',
        ],
      },
      { tipo: 'casillas', titulo: '¿Cómo quiere recibirlos?', otro: true, opciones: ['En pantalla', 'PDF', 'Excel', 'Resumen diario por WhatsApp'] },
      { tipo: 'casillas', titulo: '¿Quién los ve?', otro: true, opciones: ['Dueño', 'Encargado', 'Contador', 'Vendedores'] },
      { tipo: 'parrafo', titulo: '¿Qué número mira primero cada día?', ayuda: 'Ej.: lo vendido ayer, la caja, las cuotas que vencen.' },
    ],
  },
  {
    titulo: '12. A futuro y cierre',
    descripcion: 'Última sección. Gracias por su tiempo.',
    preguntas: [
      {
        tipo: 'casillas', titulo: '¿Qué le interesaría a futuro?', otro: true,
        opciones: ['Más sucursales', 'Catálogo web o tienda online', 'Aplicación para celular', 'Factura electrónica', 'Contabilidad', 'WhatsApp integrado'],
      },
      { tipo: 'parrafo', titulo: 'Comentarios', ayuda: 'Cualquier cosa que no le preguntamos y quiera contarnos.' },
      { tipo: 'texto', titulo: 'Persona de contacto' },
      { tipo: 'texto', titulo: 'Mejor horario para contactarlo' },
      { tipo: 'casillas', titulo: 'Confirmación', obligatoria: true, opciones: ['Confirmo que la información es correcta y completa a la fecha'] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Builder genérico
// ---------------------------------------------------------------------------
function agregarPregunta(form, q) {
  let item;
  switch (q.tipo) {
    case 'texto': item = form.addTextItem(); break;
    case 'parrafo': item = form.addParagraphTextItem(); break;
    case 'opcion': item = form.addMultipleChoiceItem().setChoiceValues(q.opciones); break;
    case 'casillas': item = form.addCheckboxItem().setChoiceValues(q.opciones); break;
    case 'lista': item = form.addListItem().setChoiceValues(q.opciones); break;
    case 'grillaCasillas': item = form.addCheckboxGridItem().setRows(q.filas).setColumns(q.columnas); break;
    case 'fecha': item = form.addDateItem(); break;
    default: throw new Error('Tipo de pregunta desconocido: ' + q.tipo + ' (' + q.titulo + ')');
  }
  item.setTitle(q.titulo);
  if (q.ayuda) item.setHelpText(q.ayuda);
  if (q.otro) item.showOtherOption(true);
  if (q.obligatoria) item.setRequired(true);
}

function crearFormulario(titulo, descripcion, secciones) {
  const form = FormApp.create(titulo);
  form.setDescription(descripcion).setProgressBar(true).setAllowResponseEdits(true).setCollectEmail(true);
  secciones.forEach(function (s) {
    form.addPageBreakItem().setTitle(s.titulo).setHelpText(s.descripcion);
    s.preguntas.forEach(function (q) { agregarPregunta(form, q); });
  });
  return form;
}

// ---------------------------------------------------------------------------
// Bloques compartidos por lavandería y frial
// ---------------------------------------------------------------------------
function cajaDiaria(negocio) {
  return [
    { tipo: 'opcion', titulo: 'Caja diaria', opciones: ['Abro y cierro caja con arqueo', 'Solo cuento el dinero al final del día', 'No llevo control'] },
    { tipo: 'opcion', titulo: '¿La caja ' + negocio + ' es separada de la de Multitienda Lider?', opciones: ['Sí', 'No', 'No sé'] },
  ];
}

const CLIENTES_NEGOCIO = [
  { tipo: 'casillas', titulo: 'Datos que pide al cliente', otro: true, opciones: ['Nombre', 'Teléfono o WhatsApp', 'CI o NIT', 'Dirección', 'Correo'] },
  { tipo: 'opcion', titulo: '¿Atiende a clientes sin anotar sus datos?', opciones: SI_NO },
  { tipo: 'opcion', titulo: '¿Le serviría mandar avisos o promociones por WhatsApp?', opciones: SI_NO_NS },
  { tipo: 'opcion', titulo: '¿Tiene una lista de clientes para cargar?', opciones: ['Sí, en cuaderno', 'Sí, en Excel o en el celular', 'No'] },
];

function cierre(reportes, quienVe, numeroEjemplo) {
  return [
    { tipo: 'casillas', titulo: '¿Qué reportes necesita?', otro: true, opciones: reportes },
    { tipo: 'casillas', titulo: '¿Cómo quiere recibirlos?', otro: true, opciones: ['En pantalla', 'PDF', 'Excel', 'Resumen diario por WhatsApp'] },
    { tipo: 'casillas', titulo: '¿Quién los ve?', otro: true, opciones: ['Dueño', 'Encargado', 'Contador', quienVe] },
    { tipo: 'parrafo', titulo: '¿Qué número mira primero cada día?', ayuda: numeroEjemplo },
    { tipo: 'parrafo', titulo: 'Comentarios', ayuda: 'Cualquier cosa que no le preguntamos y quiera contarnos.' },
    { tipo: 'texto', titulo: 'Persona de contacto' },
    { tipo: 'texto', titulo: 'Mejor horario para contactarlo' },
    { tipo: 'casillas', titulo: 'Confirmación', obligatoria: true, opciones: ['Confirmo que la información es correcta y completa a la fecha'] },
  ];
}

// ---------------------------------------------------------------------------
// Secciones específicas de la lavandería
// ---------------------------------------------------------------------------
const SECCIONES_LAVANDERIA = [
  {
    titulo: '4. Servicios y precios',
    descripcion: 'La lista completa de servicios y precios puede cargarla en la planilla de carga (pestaña Servicios).',
    preguntas: [
      {
        tipo: 'casillas', titulo: 'Servicios que ofrece', otro: true,
        opciones: ['Lavado por kilo', 'Lavado por prenda', 'Lavado en seco', 'Solo planchado', 'Lavado y planchado', 'Edredones y frazadas', 'Cortinas', 'Alfombras', 'Zapatillas', 'Peluches', 'Desmanchado', 'Teñido', 'Arreglos y costura'],
      },
      {
        tipo: 'casillas', titulo: '¿Cómo cobra?', otro: true,
        opciones: ['Por kilo', 'Por prenda', 'Por pieza grande (edredón, cortina)', 'Por metro cuadrado', 'Precio fijo por servicio'],
      },
      { tipo: 'texto', titulo: 'Precio actual por kilo (Bs)', ayuda: 'Si no cobra por kilo, déjelo en blanco.' },
      { tipo: 'texto', titulo: 'Cobro mínimo por orden', ayuda: 'Ej.: mínimo 3 kg o 20 Bs. Si no cobra mínimo, déjelo en blanco.' },
      { tipo: 'texto', titulo: 'Tiempo normal de entrega', ayuda: 'Ej.: 24 horas, 2 días.' },
      { tipo: 'opcion', titulo: '¿Tiene servicio express?', ayuda: 'Entrega más rápida con recargo.', opciones: SI_NO },
      { tipo: 'texto', titulo: 'Express: ¿en cuánto tiempo y cuánto más cobra?' },
      {
        tipo: 'casillas', titulo: 'Tipos de cliente', otro: true,
        opciones: ['Personas particulares', 'Hoteles u hostales', 'Restaurantes', 'Clínicas u hospitales', 'Gimnasios o spas', 'Otras empresas'],
      },
      { tipo: 'opcion', titulo: '¿Tiene precios distintos para empresas o clientes frecuentes?', opciones: SI_NO },
      { tipo: 'parrafo', titulo: 'Convenios con empresas', ayuda: '¿Les cobra por mes? ¿Les da crédito? ¿Tienen precio especial?' },
    ],
  },
  {
    titulo: '5. Recepción de la ropa',
    descripcion: 'Cómo recibe la ropa de sus clientes.',
    preguntas: [
      { tipo: 'parrafo', titulo: 'Una orden de hoy, paso a paso', ayuda: 'Desde que el cliente deja la ropa hasta que la recoge.' },
      { tipo: 'opcion', titulo: '¿Pesa la ropa?', opciones: ['Sí, con balanza digital', 'Sí, con balanza de aguja', 'No, cobro por prenda'] },
      { tipo: 'texto', titulo: 'Marca y modelo de la balanza', ayuda: 'Está en la etiqueta y nos sirve para saber si se puede conectar a la computadora.' },
      { tipo: 'opcion', titulo: '¿Cuenta las prendas al recibir?', opciones: ['Sí, todas', 'Solo las grandes o caras', 'No'] },
      {
        tipo: 'casillas', titulo: '¿Qué anota de cada orden?', otro: true,
        opciones: ['Nombre del cliente', 'Teléfono', 'Cantidad de prendas', 'Peso', 'Detalle de cada prenda (tipo, color, marca)', 'Daños o manchas previas', 'Objetos olvidados en los bolsillos', 'Fecha de entrega prometida', 'Instrucciones especiales'],
      },
      { tipo: 'opcion', titulo: '¿Saca fotos de daños o manchas antes de lavar?', opciones: ['Sí', 'No, pero me serviría', 'No lo necesito'] },
      {
        tipo: 'casillas', titulo: 'Comprobante que entrega al recibir', otro: true,
        opciones: ['Boleta numerada de talonario', 'Boleta a mano sin número', 'Ticket impreso', 'Mensaje por WhatsApp', 'Ninguno'],
      },
      {
        tipo: 'casillas', titulo: '¿Cómo identifica la ropa de cada cliente?', otro: true,
        opciones: ['Etiqueta o marbete en cada prenda', 'Bolsa con número', 'Canasta o casillero numerado', 'No la identificamos'],
      },
      { tipo: 'opcion', titulo: '¿Recoge y entrega a domicilio?', opciones: ['Sí, gratis', 'Sí, con costo', 'No, pero me interesaría', 'No'] },
      { tipo: 'texto', titulo: 'Si recoge y entrega: ¿cuánto cobra y quién lo hace?' },
    ],
  },
  {
    titulo: '6. Proceso y estados',
    descripcion: 'El estado es el paso en el que está la ropa de cada orden.',
    preguntas: [
      {
        tipo: 'casillas', titulo: '¿Qué estados usa o le gustaría ver?', otro: true,
        opciones: ['Recibido', 'En lavado', 'En secado', 'En planchado', 'Listo para entregar', 'Entregado', 'Observado (hay un problema)', 'Enviado a otra lavandería'],
      },
      { tipo: 'texto', titulo: '¿Quién cambia el estado de una orden?' },
      { tipo: 'opcion', titulo: '¿Le serviría avisar al cliente por WhatsApp cuando su ropa está lista?', opciones: SI_NO_NS },
      { tipo: 'opcion', titulo: '¿Manda algún servicio a otra lavandería?', ayuda: 'Ej.: lavado en seco.', opciones: SI_NO },
      { tipo: 'texto', titulo: '¿Cuántas lavadoras y secadoras tiene?', ayuda: 'Ej.: 4 lavadoras de 15 kg y 2 secadoras.' },
      { tipo: 'opcion', titulo: '¿Le serviría saber qué empleado atendió cada orden?', opciones: SI_NO_NS },
      { tipo: 'casillas', titulo: 'Insumos que compra', otro: true, opciones: ['Detergente', 'Suavizante', 'Quitamanchas', 'Bolsas', 'Ganchos', 'Etiquetas'] },
      { tipo: 'opcion', titulo: '¿Le serviría controlar el stock de insumos?', opciones: ['Sí', 'No, pero me serviría más adelante', 'No lo necesito'] },
    ],
  },
  {
    titulo: '7. Pagos, entrega y caja',
    descripcion: 'Cómo cobra, cómo entrega la ropa y cómo maneja el dinero.',
    preguntas: [
      {
        tipo: 'opcion', titulo: '¿Cuándo cobra?',
        opciones: ['Todo al recibir', 'Todo al entregar', 'Una parte al recibir y el resto al entregar', 'Depende del cliente'],
      },
      { tipo: 'casillas', titulo: 'Formas de pago que acepta', otro: true, opciones: ['Efectivo', 'QR', 'Transferencia', 'Tarjeta', 'Crédito (paga después)'] },
      { tipo: 'opcion', titulo: '¿Entrega la ropa si el cliente perdió su boleta?', opciones: ['Sí, mostrando carnet', 'No', 'Depende'] },
      { tipo: 'opcion', titulo: '¿Puede recoger la ropa otra persona?', opciones: ['Sí, con la boleta', 'Sí, si el cliente avisa', 'No'] },
      { tipo: 'texto', titulo: '¿Cuántos días espera si el cliente no recoge su ropa?' },
      { tipo: 'parrafo', titulo: '¿Qué hace con la ropa que no recogen?', ayuda: 'Ej.: cobra por guardarla, la dona después de cierto tiempo.' },
      { tipo: 'parrafo', titulo: 'Si una prenda se pierde o se daña, ¿cómo responde?' },
    ].concat(FACTURACION, cajaDiaria('de la lavandería'), [
      { tipo: 'casillas', titulo: 'Gastos que paga desde la caja', otro: true, opciones: ['Insumos', 'Agua, luz o gas', 'Sueldos o adelantos', 'Transporte', 'Ninguno'] },
    ]),
  },
  {
    titulo: '8. Clientes',
    descripcion: 'Qué datos de sus clientes guarda.',
    preguntas: CLIENTES_NEGOCIO,
  },
  {
    titulo: '9. Reportes y cierre',
    descripcion: 'Los reportes son los resúmenes que usted quiere mirar para tomar decisiones. Última sección: gracias por su tiempo.',
    preguntas: cierre(
      ['Ingresos del día y del mes', 'Órdenes por estado', 'Kilos lavados por día y por mes', 'Ingresos por servicio', 'Órdenes pendientes de entrega', 'Ropa no recogida', 'Saldos por cobrar', 'Trabajo por empleado', 'Gasto en insumos', 'Caja diaria', 'Comparativo de los 3 negocios'],
      'Empleados',
      'Ej.: lo cobrado ayer, las órdenes pendientes.'
    ),
  },
];

// ---------------------------------------------------------------------------
// Secciones específicas del frial de carnes al vacío
// ---------------------------------------------------------------------------
const SECCIONES_FRIAL = [
  {
    titulo: '4. Productos y cortes',
    descripcion: 'La lista completa de productos puede cargarla en la planilla de carga (pestaña Productos).',
    preguntas: [
      {
        tipo: 'casillas', titulo: '¿Qué vende?', otro: true,
        opciones: ['Carne de res', 'Cerdo', 'Pollo', 'Cordero', 'Pescado', 'Embutidos (chorizo, salchicha)', 'Hamburguesas y procesados', 'Menudencias', 'Carbón y artículos de parrilla'],
      },
      { tipo: 'parrafo', titulo: 'Cortes principales', ayuda: 'Ej.: lomo, pecho, costilla, carne molida.' },
      {
        tipo: 'casillas', titulo: '¿Cómo vende?', otro: true,
        opciones: ['Paquete al vacío con peso variable (se cobra lo que pesa)', 'Paquete con peso fijo (Ej.: 1 kg)', 'Cortado y pesado en el momento', 'Por unidad'],
      },
      { tipo: 'opcion', titulo: '¿Quién envasa al vacío?', opciones: ['Nosotros, con máquina propia', 'Compramos ya envasado', 'Las dos cosas'] },
      { tipo: 'opcion', titulo: '¿Vende fresco o congelado?', opciones: ['Fresco (refrigerado)', 'Congelado', 'Los dos'] },
      { tipo: 'opcion', titulo: '¿Los paquetes llevan etiqueta con peso y precio?', opciones: ['Sí, la imprime la balanza', 'Sí, escrita a mano', 'No'] },
      {
        tipo: 'opcion', titulo: '¿La etiqueta tiene código de barras?',
        ayuda: 'Algunas balanzas imprimen un código con el peso o el precio; nos sirve para saber si se puede leer al cobrar.',
        opciones: SI_NO_NS,
      },
      { tipo: 'texto', titulo: 'Marca y modelo de la balanza', ayuda: 'Está en la etiqueta de la balanza.' },
      { tipo: 'opcion', titulo: '¿La balanza está conectada a una computadora?', opciones: SI_NO_NS },
      {
        tipo: 'casillas', titulo: 'Tipos de precio que maneja', otro: true,
        opciones: ['Precio por kg al público', 'Precio mayorista (restaurantes, revendedores)', 'Precio por paquete', 'Ofertas por cantidad'],
      },
      { tipo: 'parrafo', titulo: '¿Quién cambia los precios y cada cuánto?' },
    ],
  },
  {
    titulo: '5. Compras, despiece e inventario',
    descripcion: 'El kardex es el registro de entradas y salidas de cada producto, en kilos.',
    preguntas: [
      {
        tipo: 'casillas', titulo: '¿Cómo compra la carne?', otro: true,
        opciones: ['Res entera o media res', 'Cortes ya listos', 'Paquetes ya envasados', 'Pollo entero'],
      },
      {
        tipo: 'opcion', titulo: '¿Despiezan ustedes la carne?', ayuda: 'Despiezar es cortar una media res en lomo, costilla, molida, etc.',
        opciones: ['Sí', 'No', 'A veces'],
      },
      {
        tipo: 'opcion', titulo: '¿Anota cuánto sale de cada corte al despiezar?',
        ayuda: 'Ej.: de 100 kg de media res salen 8 kg de lomo y 15 de costilla. Se llama rendimiento.',
        opciones: ['Sí', 'No, pero me serviría', 'No lo necesito'],
      },
      {
        tipo: 'parrafo', titulo: 'Proveedores principales',
        ayuda: 'Nombre y qué le compra a cada uno (matadero, frigorífico, distribuidor). También puede llenar la pestaña Proveedores.',
      },
      { tipo: 'opcion', titulo: '¿Anota el costo de compra por kilo?', opciones: ['Sí, siempre', 'A veces', 'No'] },
      { tipo: 'opcion', titulo: '¿Anota lo que debe a proveedores?', ayuda: 'Se llama cuentas por pagar.', opciones: ['Sí, lo anoto', 'No, pero me serviría', 'No lo necesito'] },
      { tipo: 'opcion', titulo: '¿Controla fechas de vencimiento?', opciones: ['Sí, por paquete', 'Sí, por lote (lo envasado el mismo día)', 'No'] },
      { tipo: 'texto', titulo: '¿Cuántos días dura un paquete?', ayuda: 'Al vacío refrigerado y congelado, más o menos.' },
      { tipo: 'opcion', titulo: '¿Le serviría un aviso de productos por vencer?', opciones: SI_NO_NS },
      {
        tipo: 'casillas', titulo: 'Pérdidas o salidas que no son venta', otro: true,
        opciones: ['Hueso y grasa al despiezar', 'Pérdida de peso (la carne se seca)', 'Vencido', 'Dañado o mal envasado', 'Consumo propio', 'Traslado a otro negocio'],
      },
      { tipo: 'texto', titulo: '¿Quién autoriza los ajustes de inventario?' },
      {
        tipo: 'opcion', titulo: 'Frecuencia del conteo físico',
        ayuda: 'Cada cuánto cuenta la mercadería real para compararla con lo anotado.',
        opciones: ['Cada semana', 'Cada mes', 'Cada 3 meses', 'Una vez al año', 'No hago conteo'],
      },
      { tipo: 'texto', titulo: '¿Cuántas cámaras o congeladoras tiene?', ayuda: 'Ej.: 1 cámara y 3 congeladoras exhibidoras.' },
      { tipo: 'opcion', titulo: '¿Le serviría ver el stock por cámara o congeladora?', opciones: SI_NO_NS },
      {
        tipo: 'fecha', titulo: 'Fecha posible para el conteo inicial',
        ayuda: 'Es el día en que se pesaría todo el producto para empezar con el stock correcto.',
      },
      { tipo: 'opcion', titulo: '¿Debe llevar registros para controles sanitarios (por ejemplo, SENASAG)?', opciones: SI_NO_NS },
    ],
  },
  {
    titulo: '6. Ventas y caja',
    descripcion: 'Cómo vende y cómo maneja el dinero.',
    preguntas: [
      { tipo: 'parrafo', titulo: 'Una venta de hoy, paso a paso', ayuda: 'Desde que el cliente pide hasta que se va con su producto.' },
      { tipo: 'casillas', titulo: '¿A quién le vende?', otro: true, opciones: ['Público en el local', 'Restaurantes y pensiones', 'Revendedores', 'Pedidos por WhatsApp', 'Hoteles'] },
      { tipo: 'opcion', titulo: '¿Hace entregas a domicilio?', opciones: ['Sí, gratis', 'Sí, con costo', 'No, pero me interesaría', 'No'] },
      { tipo: 'casillas', titulo: 'Formas de pago que acepta', otro: true, opciones: ['Efectivo', 'QR', 'Transferencia', 'Tarjeta', 'Crédito (pagan después)'] },
      { tipo: 'parrafo', titulo: 'Si da crédito: ¿a quién, con qué plazo y hasta qué monto?' },
      { tipo: 'texto', titulo: 'Descuentos: ¿quién los autoriza y hasta qué %?' },
      { tipo: 'opcion', titulo: '¿Acepta devoluciones o cambios?', opciones: ['Sí', 'No', 'Solo si el producto salió mal'] },
      {
        tipo: 'casillas', titulo: 'Comprobante que entrega', otro: true,
        opciones: ['Nota de venta impresa', 'Factura', 'Ticket de la balanza', 'Foto o PDF por WhatsApp', 'Ninguno'],
      },
    ].concat(FACTURACION, cajaDiaria('del frial')),
  },
  {
    titulo: '7. Clientes',
    descripcion: 'Qué datos de sus clientes guarda.',
    preguntas: CLIENTES_NEGOCIO,
  },
  {
    titulo: '8. Reportes y cierre',
    descripcion: 'Los reportes son los resúmenes que usted quiere mirar para tomar decisiones. Última sección: gracias por su tiempo.',
    preguntas: cierre(
      ['Ventas del día y del mes (Bs y kilos)', 'Ventas por corte o producto', 'Ganancia por kilo', 'Stock por corte en kilos', 'Productos por vencer', 'Pérdidas y mermas', 'Rendimiento del despiece', 'Compras a proveedores', 'Saldos por cobrar', 'Kardex por producto', 'Caja diaria', 'Comparativo de los 3 negocios'],
      'Vendedores',
      'Ej.: lo vendido ayer, el stock de las cámaras, los productos por vencer.'
    ),
  },
];

// ---------------------------------------------------------------------------
// Planilla de carga (data-driven)
// hoja: { nombre, columnas, ejemplos?, columnasTexto? (cuántas columnas iniciales van como texto),
//         validaciones?: [{ columna, numero:true } | { columna, lista:[...] } | { columna, categorias:true }] }
// ---------------------------------------------------------------------------
function numeros(nombres) {
  return nombres.map(function (c) { return { columna: c, numero: true }; });
}

const HOJA_USUARIOS = {
  nombre: 'Usuarios',
  columnas: ['Nombre', 'Cargo', 'Celular', 'Correo', 'Negocio(s)', 'Rol'],
};

const HOJAS_CARGA = [
  {
    nombre: 'Productos',
    columnas: [
      'Código interno', 'Código de barras', 'Descripción', 'Marca', 'Modelo', 'Categoría', 'Línea',
      'Precio costo (Bs)', 'Precio contado (Bs)', 'Precio crédito (Bs)', 'Precio mínimo (Bs)',
      'Stock actual', 'Stock mínimo', '¿Controla nro. de serie?', 'Garantía (meses)', 'Observaciones',
    ],
    columnasTexto: 2,
    ejemplos: [
      ['REF-001', '7790000000011', 'Refrigerador no frost 300 L', 'Marca Ejemplo', 'RF-300', 'Refrigeradores', 'Línea blanca', 2800, 3500, 3900, 3300, 4, 1, 'Sí', 12, 'EJEMPLO — borrar'],
      ['TV-002', '7790000000028', 'Televisor LED 43 pulgadas', 'Marca Ejemplo', 'TV-43', 'Televisores', 'Línea negra', 1500, 1900, 2100, 1800, 6, 2, 'Sí', 12, 'EJEMPLO — borrar'],
    ],
    validaciones: [
      { columna: 'Categoría', categorias: true },
      { columna: 'Línea', lista: ['Línea blanca', 'Línea negra', 'Pequeños electrodomésticos', 'Otros'] },
      { columna: '¿Controla nro. de serie?', lista: ['Sí', 'No'] },
    ].concat(numeros([
      'Precio costo (Bs)', 'Precio contado (Bs)', 'Precio crédito (Bs)', 'Precio mínimo (Bs)',
      'Stock actual', 'Stock mínimo', 'Garantía (meses)',
    ])),
  },
  {
    nombre: 'Números de serie',
    columnas: ['Código interno', 'Número de serie', 'Ubicación'],
    ejemplos: [['REF-001', 'SN-0001', 'Tienda (EJEMPLO — borrar)'], ['REF-001', 'SN-0002', 'Depósito (EJEMPLO — borrar)']],
  },
  {
    nombre: 'Clientes',
    columnas: ['Nombre', 'CI o NIT', 'Teléfono', 'Dirección', 'Saldo de crédito pendiente (Bs)'],
    validaciones: numeros(['Saldo de crédito pendiente (Bs)']),
  },
  HOJA_USUARIOS,
  { nombre: 'Categorías', columnas: ['Categoría'] },
];

const INSTRUCCIONES_CARGA = [
  'Planilla de datos iniciales - Multitienda Lider',
  '',
  'Esta planilla sirve para pasarnos su información. Llene solo lo que tenga; lo demás puede quedar en blanco.',
  '1. Productos: una fila por producto. Las filas grises que dicen EJEMPLO son solo para guiarle: bórrelas.',
  '2. Números de serie: solo para los productos donde anota el número de serie de cada unidad. Una fila por unidad.',
  '3. Clientes (opcional): si tiene una lista de clientes o saldos de crédito pendientes.',
  '4. Usuarios: las personas que usarían el sistema, con su cargo.',
  '5. Categorías: la lista que aparece en el desplegable de Productos. Puede agregar o cambiar categorías.',
  '',
  'Los precios y el stock deben ser números de cero o más. La planilla no deja escribir otra cosa.',
  'Si prefiere, puede mandarnos su propio Excel por WhatsApp.',
  'Esta planilla la compartimos con usted por su correo: se guarda sola y puede volver cuando quiera.',
];

const HOJAS_LAVANDERIA = [
  {
    nombre: 'Servicios',
    columnas: ['Código', 'Servicio', 'Cómo se cobra', 'Precio normal (Bs)', 'Precio express (Bs)', 'Tiempo de entrega normal', 'Observaciones'],
    columnasTexto: 1,
    ejemplos: [
      ['LAV-KG', 'Lavado por kilo', 'Por kilo', 10, 15, '24 horas', 'EJEMPLO — borrar'],
      ['EDR-2P', 'Edredón 2 plazas', 'Por pieza', 40, 55, '48 horas', 'EJEMPLO — borrar'],
    ],
    validaciones: [
      { columna: 'Cómo se cobra', lista: ['Por kilo', 'Por prenda', 'Por pieza', 'Por m²', 'Precio fijo'] },
    ].concat(numeros(['Precio normal (Bs)', 'Precio express (Bs)'])),
  },
  {
    nombre: 'Clientes',
    columnas: ['Nombre', 'CI o NIT', 'Teléfono', 'Dirección', 'Tipo', 'Precio especial o convenio', 'Saldo pendiente (Bs)'],
    columnasTexto: 3,
    validaciones: [{ columna: 'Tipo', lista: ['Particular', 'Hotel u hostal', 'Restaurante', 'Clínica u hospital', 'Gimnasio o spa', 'Otra empresa'] }].concat(numeros(['Saldo pendiente (Bs)'])),
  },
  {
    nombre: 'Órdenes pendientes',
    columnas: ['Nro. de boleta', 'Cliente', 'Teléfono', 'Fecha de recepción', 'Detalle', 'Total (Bs)', 'Pagado (Bs)', 'Estado'],
    columnasTexto: 3,
    validaciones: [{ columna: 'Estado', lista: ['Recibido', 'En proceso', 'Listo', 'Observado'] }].concat(numeros(['Total (Bs)', 'Pagado (Bs)'])),
  },
  HOJA_USUARIOS,
];

const INSTRUCCIONES_LAVANDERIA = [
  'Planilla de datos iniciales - Lavandería',
  '',
  'Esta planilla sirve para pasarnos su información. Llene solo lo que tenga; lo demás puede quedar en blanco.',
  '1. Servicios: una fila por servicio con su precio. Las filas grises que dicen EJEMPLO son solo para guiarle: bórrelas.',
  '2. Clientes (opcional): si tiene una lista de clientes, convenios o saldos pendientes.',
  '3. Órdenes pendientes: solo la ropa que todavía está en el local el día que se empieza con el sistema.',
  '4. Usuarios: las personas que usarían el sistema, con su cargo.',
  '',
  'Los precios y saldos deben ser números de cero o más. La planilla no deja escribir otra cosa.',
  'Si prefiere, puede mandarnos su propio Excel por WhatsApp.',
  'Esta planilla la compartimos con usted por su correo: se guarda sola y puede volver cuando quiera.',
];

const CATEGORIAS_FRIAL = ['Res', 'Cerdo', 'Pollo', 'Cordero', 'Pescado', 'Embutidos', 'Procesados', 'Menudencias', 'Otros'];

const HOJAS_FRIAL = [
  {
    nombre: 'Productos',
    columnas: [
      'Código interno', 'Código de balanza (PLU)', 'Descripción', 'Categoría', 'Forma de venta', 'Presentación',
      'Precio costo (Bs por kg)', 'Precio venta (Bs por kg)', 'Precio mayorista (Bs por kg)',
      'Stock actual (kg o unidades)', 'Stock mínimo', 'Vida útil (días)', 'Observaciones',
    ],
    columnasTexto: 2,
    ejemplos: [
      ['RES-LOM', '101', 'Lomo de res al vacío', 'Res', 'Por kg', 'Fresco', 60, 85, 78, 12.5, 5, 21, 'EJEMPLO — borrar'],
      ['CER-COS', '205', 'Costilla de cerdo', 'Cerdo', 'Por kg', 'Congelado', 32, 48, 44, 20, 8, 90, 'EJEMPLO — borrar'],
    ],
    validaciones: [
      { columna: 'Categoría', categorias: true },
      { columna: 'Forma de venta', lista: ['Por kg', 'Paquete de peso fijo', 'Por unidad'] },
      { columna: 'Presentación', lista: ['Fresco', 'Congelado'] },
    ].concat(numeros([
      'Precio costo (Bs por kg)', 'Precio venta (Bs por kg)', 'Precio mayorista (Bs por kg)',
      'Stock actual (kg o unidades)', 'Stock mínimo', 'Vida útil (días)',
    ])),
  },
  {
    nombre: 'Lotes',
    columnas: ['Código interno', 'Lote o fecha de envasado', 'Fecha de vencimiento', 'Cantidad (kg)', 'Ubicación (cámara o congeladora)'],
    columnasTexto: 1,
    validaciones: numeros(['Cantidad (kg)']),
  },
  {
    nombre: 'Clientes',
    columnas: ['Nombre', 'CI o NIT', 'Teléfono', 'Dirección', 'Tipo', 'Saldo pendiente (Bs)'],
    columnasTexto: 3,
    validaciones: [{ columna: 'Tipo', lista: ['Particular', 'Restaurante', 'Revendedor', 'Otro'] }].concat(numeros(['Saldo pendiente (Bs)'])),
  },
  {
    nombre: 'Proveedores',
    columnas: ['Nombre', 'Qué le compra', 'Teléfono', 'Lo que le debe (Bs)'],
    columnasTexto: 3,
    validaciones: numeros(['Lo que le debe (Bs)']),
  },
  HOJA_USUARIOS,
  { nombre: 'Categorías', columnas: ['Categoría'] },
];

const INSTRUCCIONES_FRIAL = [
  'Planilla de datos iniciales - Frial',
  '',
  'Esta planilla sirve para pasarnos su información. Llene solo lo que tenga; lo demás puede quedar en blanco.',
  '1. Productos: una fila por producto o corte. Los pesos van en kg con decimales: escriba los decimales igual que en la fila de ejemplo. Las filas grises que dicen EJEMPLO son solo para guiarle: bórrelas.',
  '2. Lotes: solo si controla fechas de vencimiento. Una fila por lote.',
  '3. Clientes (opcional): si tiene una lista de clientes o saldos pendientes.',
  '4. Proveedores (opcional): a quién le compra y lo que le debe.',
  '5. Usuarios: las personas que usarían el sistema, con su cargo.',
  '6. Categorías: la lista que aparece en el desplegable de Productos. Puede agregar o cambiar categorías.',
  '',
  'Los precios, el stock y los saldos deben ser números de cero o más. La planilla no deja escribir otra cosa.',
  'Si prefiere, puede mandarnos su propio Excel por WhatsApp.',
  'Esta planilla la compartimos con usted por su correo: se guarda sola y puede volver cuando quiera.',
];

const FILAS_VALIDADAS = 999; // filas 2 a 1000

function reglaNumero() {
  return SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .setHelpText('Escriba un número de 0 o más.')
    .build();
}

function reglaLista(valores) {
  return SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(false).build();
}

function crearPlanilla(titulo, textoInstrucciones, hojas, categorias) {
  const ss = SpreadsheetApp.create(titulo);

  // Se reutiliza la hoja por defecto para no dejar una "Hoja 1" vacía.
  const instrucciones = ss.getSheets()[0].setName('Instrucciones');
  instrucciones.getRange(1, 1, textoInstrucciones.length, 1)
    .setValues(textoInstrucciones.map(function (l) { return [l]; }))
    .setWrap(true);
  instrucciones.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  instrucciones.setColumnWidth(1, 700);

  hojas.forEach(function (h) {
    const hoja = ss.insertSheet(h.nombre);
    hoja.getRange(1, 1, 1, h.columnas.length).setValues([h.columnas]).setFontWeight('bold');
    hoja.setFrozenRows(1);
    hoja.setColumnWidths(1, h.columnas.length, 150);
    // Códigos como texto, antes de escribir ejemplos, para no perder ceros ni pasar a notación científica.
    if (h.columnasTexto) hoja.getRange(2, 1, FILAS_VALIDADAS, h.columnasTexto).setNumberFormat('@');
    if (h.ejemplos) {
      const filas = hoja.getRange(2, 1, h.ejemplos.length, h.columnas.length);
      filas.setValues(h.ejemplos).setFontColor('#999999');
    }
  });

  let hojaCategorias;
  if (categorias) {
    hojaCategorias = ss.getSheetByName('Categorías');
    if (!hojaCategorias) throw new Error('Se pasó la lista de categorías pero la planilla no tiene hoja Categorías.');
    hojaCategorias.getRange(2, 1, categorias.length, 1).setValues(categorias.map(function (c) { return [c]; }));
  }

  hojas.forEach(function (h) {
    if (!h.validaciones) return;
    const hoja = ss.getSheetByName(h.nombre);
    h.validaciones.forEach(function (v) {
      const col = h.columnas.indexOf(v.columna);
      if (col < 0) throw new Error('Validación en hoja "' + h.nombre + '": la columna "' + v.columna + '" no existe.');
      let regla;
      if (v.numero) regla = reglaNumero();
      else if (v.lista) regla = reglaLista(v.lista);
      else if (v.categorias) {
        if (!hojaCategorias) throw new Error('Hoja "' + h.nombre + '", columna "' + v.columna + '": usa categorías pero la planilla no tiene hoja Categorías o falta pasar la lista.');
        regla = SpreadsheetApp.newDataValidation().requireValueInRange(hojaCategorias.getRange('A2:A200'), true).setAllowInvalid(false).build();
      } else throw new Error('Hoja "' + h.nombre + '", columna "' + v.columna + '": validación sin numero, lista ni categorias.');
      hoja.getRange(2, col + 1, FILAS_VALIDADAS, 1).setDataValidation(regla);
    });
  });

  return ss;
}
