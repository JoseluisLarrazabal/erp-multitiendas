/**
 * Formulario de relevamiento + planilla de carga: Multitienda Lider.
 * Pegar en script.google.com y ejecutar crearTodoLider() una sola vez.
 * Para lavandería o frial: copiar SECCIONES_LIDER como base y llamar a crearFormulario().
 *
 * Cada pregunta: { tipo, titulo, ayuda?, opciones?, otro?, obligatoria?, filas?, columnas? }
 * tipos: texto | parrafo | opcion | casillas | lista | grillaCasillas | fecha
 * FormApp no puede crear subida de archivos: el logo se pide por WhatsApp.
 * Debe ser la primera función del archivo: el editor la deja seleccionada en Ejecutar.
 */

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function crearTodoLider() {
  const planilla = crearPlanillaLider();

  const intro =
    'Este formulario nos ayuda a armar el sistema de gestión de su tienda Multitienda Lider.\n\n' +
    'Tarda unos 30 a 40 minutos. Si no sabe una respuesta, déjela en blanco o escriba "no sé": la vemos juntos en la reunión. ' +
    'Si necesita más tiempo, avísenos por WhatsApp. Después de enviarlo puede corregir sus respuestas con el enlace "Editar tu respuesta" que aparece al final.\n\n' +
    'Además de este formulario, puede llenar la planilla de carga con su lista de productos, clientes y personas:\n' +
    planilla.getUrl() + '\n\n' +
    'El logo de su negocio mándelo por WhatsApp.';

  const form = crearFormulario(
    'Multitienda Lider — Relevamiento para su sistema de gestión',
    intro,
    SECCIONES_COMUNES.concat(SECCIONES_LIDER)
  );
  form.setConfirmationMessage(
    'Gracias, recibimos su información. Si necesita corregir algo, use el enlace "Editar tu respuesta" de esta página o avísenos por WhatsApp.'
  );

  const respuestas = SpreadsheetApp.create('Multitienda Lider — Respuestas formulario');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, respuestas.getId());

  Logger.log('Editar el formulario: ' + form.getEditUrl());
  Logger.log('Link para el cliente: ' + form.getPublishedUrl());
  Logger.log('Planilla de carga: ' + planilla.getUrl());
  Logger.log('Planilla de respuestas: ' + respuestas.getUrl());
}


const SI_NO = ['Sí', 'No'];
const SI_NO_NS = ['Sí', 'No', 'No sé'];

const CATEGORIAS = [
  'Refrigeradores', 'Freezers', 'Lavadoras', 'Secadoras', 'Cocinas',
  'Hornos y microondas', 'Campanas', 'Calefones y termotanques', 'Climatización',
  'Televisores', 'Audio', 'Celulares y tablets', 'Computación',
  'Pequeños electrodomésticos', 'Muebles', 'Colchones', 'Motos y bicicletas',
];

// ---------------------------------------------------------------------------
// Secciones comunes (sirven para los 3 negocios)
// ---------------------------------------------------------------------------
const SECCIONES_COMUNES = [
  {
    titulo: '1. Datos del negocio',
    descripcion: 'Datos básicos de su negocio. Si no sabe algo, déjelo en blanco o escriba "no sé".',
    preguntas: [
      { tipo: 'texto', titulo: 'Nombre comercial', ayuda: 'Tal como quiere que aparezca en sus comprobantes. Ej.: Multitienda Lider.' },
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
        tipo: 'casillas', titulo: '¿Qué datos van en la nota de venta?', otro: true,
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
        tipo: 'casillas', titulo: '¿Cómo lleva hoy su inventario?', otro: true,
        opciones: ['Cuaderno', 'Excel', 'Sistema de otra empresa', 'No lo llevo'],
      },
      { tipo: 'texto', titulo: 'Si usa un sistema, ¿cuál?', ayuda: 'Escriba el nombre del programa o de la empresa que se lo dio.' },
      {
        tipo: 'parrafo', titulo: '¿Qué datos quiere pasar al sistema nuevo?',
        ayuda: 'Ej.: lista de productos, clientes, saldos de crédito. Puede cargarlos en la planilla de carga.',
      },
      { tipo: 'parrafo', titulo: 'Principales problemas de hoy', ayuda: 'Lo que más tiempo le quita o más errores le causa.' },
      { tipo: 'parrafo', titulo: '¿Qué es imprescindible desde el primer día?', ayuda: 'Lo que no puede faltar para que usted pueda trabajar.' },
      { tipo: 'lista', titulo: 'Ventas por día (aproximado)', opciones: ['Menos de 10', '10 a 30', '31 a 100', 'Más de 100', 'No sé'] },
      { tipo: 'lista', titulo: 'Productos distintos que maneja', opciones: ['Menos de 100', '100 a 500', '501 a 2000', 'Más de 2000', 'No sé'] },
    ],
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
        filas: [
          'Vender', 'Ver costo y ganancia', 'Dar descuentos', 'Anular o devolver una venta',
          'Cargar o ajustar inventario', 'Crear o editar productos y precios', 'Ver reportes',
          'Abrir y cerrar caja', 'Administrar usuarios',
        ],
        columnas: ['Dueño', 'Encargado', 'Vendedor', 'Todos'],
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
  },
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
      { tipo: 'opcion', titulo: '¿Emite factura hoy?', opciones: SI_NO },
      { tipo: 'texto', titulo: 'Si factura, ¿con qué sistema?' },
      { tipo: 'opcion', titulo: '¿Le interesa la factura electrónica?', opciones: SI_NO_NS },
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
// Planilla de carga
// ---------------------------------------------------------------------------
const COLUMNAS_PRODUCTOS = [
  'Código interno', 'Código de barras', 'Descripción', 'Marca', 'Modelo', 'Categoría', 'Línea',
  'Precio costo (Bs)', 'Precio contado (Bs)', 'Precio crédito (Bs)', 'Precio mínimo (Bs)',
  'Stock actual', 'Stock mínimo', '¿Controla nro. de serie?', 'Garantía (meses)', 'Observaciones',
];
const COLUMNAS_NUMERICAS_PRODUCTOS = [
  'Precio costo (Bs)', 'Precio contado (Bs)', 'Precio crédito (Bs)', 'Precio mínimo (Bs)',
  'Stock actual', 'Stock mínimo', 'Garantía (meses)',
];

const HOJAS_CARGA = [
  {
    nombre: 'Productos',
    columnas: COLUMNAS_PRODUCTOS,
    ejemplos: [
      ['REF-001', '7790000000011', 'Refrigerador no frost 300 L', 'Marca Ejemplo', 'RF-300', 'Refrigeradores', 'Línea blanca', 2800, 3500, 3900, 3300, 4, 1, 'Sí', 12, 'EJEMPLO — borrar'],
      ['TV-002', '7790000000028', 'Televisor LED 43 pulgadas', 'Marca Ejemplo', 'TV-43', 'Televisores', 'Línea negra', 1500, 1900, 2100, 1800, 6, 2, 'Sí', 12, 'EJEMPLO — borrar'],
    ],
  },
  {
    nombre: 'Números de serie',
    columnas: ['Código interno', 'Número de serie', 'Ubicación'],
    ejemplos: [['REF-001', 'SN-0001', 'Tienda (EJEMPLO — borrar)'], ['REF-001', 'SN-0002', 'Depósito (EJEMPLO — borrar)']],
  },
  {
    nombre: 'Clientes',
    columnas: ['Nombre', 'CI o NIT', 'Teléfono', 'Dirección', 'Saldo de crédito pendiente (Bs)'],
  },
  {
    nombre: 'Usuarios',
    columnas: ['Nombre', 'Cargo', 'Celular', 'Correo', 'Negocio(s)', 'Rol'],
  },
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

function validarColumna(hoja, columnas, nombre, regla) {
  hoja.getRange(2, columnas.indexOf(nombre) + 1, FILAS_VALIDADAS, 1).setDataValidation(regla);
}

function crearPlanillaLider() {
  const ss = SpreadsheetApp.create('Multitienda Lider — Datos iniciales');

  // Se reutiliza la hoja por defecto para no dejar una "Hoja 1" vacía.
  const instrucciones = ss.getSheets()[0].setName('Instrucciones');
  instrucciones.getRange(1, 1, INSTRUCCIONES_CARGA.length, 1)
    .setValues(INSTRUCCIONES_CARGA.map(function (l) { return [l]; }))
    .setWrap(true);
  instrucciones.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  instrucciones.setColumnWidth(1, 700);

  HOJAS_CARGA.forEach(function (h) {
    const hoja = ss.insertSheet(h.nombre);
    hoja.getRange(1, 1, 1, h.columnas.length).setValues([h.columnas]).setFontWeight('bold');
    hoja.setFrozenRows(1);
    hoja.setColumnWidths(1, h.columnas.length, 150);
    // Códigos como texto, antes de escribir ejemplos, para no perder ceros ni pasar a notación científica.
    if (h.nombre === 'Productos') hoja.getRange(2, 1, FILAS_VALIDADAS, 2).setNumberFormat('@');
    if (h.ejemplos) {
      const filas = hoja.getRange(2, 1, h.ejemplos.length, h.columnas.length);
      filas.setValues(h.ejemplos).setFontColor('#999999');
    }
  });

  const categorias = ss.getSheetByName('Categorías');
  categorias.getRange(2, 1, CATEGORIAS.length, 1).setValues(CATEGORIAS.map(function (c) { return [c]; }));

  const productos = ss.getSheetByName('Productos');
  const cols = COLUMNAS_PRODUCTOS;
  validarColumna(productos, cols, 'Categoría',
    SpreadsheetApp.newDataValidation().requireValueInRange(categorias.getRange('A2:A200'), true).setAllowInvalid(false).build());
  validarColumna(productos, cols, 'Línea',
    reglaLista(['Línea blanca', 'Línea negra', 'Pequeños electrodomésticos', 'Otros']));
  validarColumna(productos, cols, '¿Controla nro. de serie?', reglaLista(['Sí', 'No']));
  COLUMNAS_NUMERICAS_PRODUCTOS.forEach(function (n) { validarColumna(productos, cols, n, reglaNumero()); });

  const clientes = HOJAS_CARGA[2];
  validarColumna(ss.getSheetByName('Clientes'), clientes.columnas, 'Saldo de crédito pendiente (Bs)', reglaNumero());

  return ss;
}
