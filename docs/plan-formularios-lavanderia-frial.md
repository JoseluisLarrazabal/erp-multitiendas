# Plan — Formularios de relevamiento: lavandería y frial

Fecha: 2026-10-26. Rama: `feat/formularios-lavanderia-frial`. Base: formulario Lider (PR #1, `docs/plan-formulario-lider.md`).

## Objetivo

Dos formularios de Google y dos planillas de carga más, generados por el mismo Apps Script que el de Lider:
uno para la lavandería y otro para el frial de carnes al vacío. El cliente los llena igual que el de Lider.

## Decisiones

- **Un solo archivo `.gs`**, que se renombra `formulario-lider.gs` → `relevamiento.gs`. El CTO lo pega una vez y
  ejecuta cada función por separado. Arriba van las funciones en este orden: `crearTodoLavanderia`, `crearTodoFrial`
  y `crearTodoLider_YA_EJECUTADO` (renombrada en la revisión: la de Lider ya se corrió). El editor preselecciona la primera.
- **Formularios separados por negocio.** Cada negocio puede llenarlo un encargado distinto y así cada formulario
  queda más corto.
- **Secciones comunes parametrizadas.** `SECCIONES_COMUNES` pasa a ser `seccionesComunes(n)`, que devuelve las
  secciones 1 a 3. La sección 4 ("Los 3 negocios juntos") queda como constante y **solo va en Lider**: es una
  pregunta global y no se repite. Parámetros de `n`:
  - `ejemploNombre`: ayuda del nombre comercial.
  - `comprobante`: el título "¿Qué datos van en la nota de venta?" cambia el texto entre "nota de venta" y "boleta".
  - `volumen`: las 2 preguntas `lista` del final de la sección 2.
  - `permisos`: `{filas, columnas}` de la grilla.
  **Con los parámetros de Lider, la salida tiene que ser idéntica a la de hoy**, porque el form de Lider ya está publicado.
- **Planilla genérica.** `crearPlanillaLider()` pasa a `crearPlanilla(titulo, instrucciones, hojas, categorias)`, data-driven.
  Cada hoja trae `{nombre, columnas, ejemplos?, columnasTexto? (cuántas columnas iniciales van como texto @),
  validaciones?: [{columna, numero:true} | {columna, lista:[...]} | {columna, categorias:true}]}`. El formato `@` se aplica
  **antes** de escribir los ejemplos (bug ya conocido de PR #1). Para Lider la secuencia de llamadas tiene que ser
  equivalente a la de hoy.
- **Flujo común:** `crearTodo(cfg)`, con `cfg = {nombre, intro, secciones, planilla:{titulo, instrucciones, hojas, categorias}}`,
  hace planilla → intro con link → form → confirmación → planilla de respuestas → 4 logs. Cada `crearTodoX` llama
  a `crearTodo` con su configuración.
- **Sin xlsx offline nuevo.** Si el cliente lo quiere en Excel, el CTO baja la Google Sheet con Archivo → Descargar → .xlsx.
  El generador Python de Lider no se toca.
- **Base de datos (decisión del CTO, 2026-10-26):** una sola base centralizada para los 3 negocios. Ver handoff.
- Redacción: usted, lenguaje simple y neutro ("¿le serviría…?"). Nada que prometa funciones.

## Intro de lavandería y frial (además de la de Lider, adaptada)

- Para qué sirve, cuánto tarda (unos 20 a 30 min), "no sé" vale, puede editar después y el link a la planilla de carga.
- "Si este negocio lo atiende un encargado, puede llenarlo él."
- "Si un dato es igual que en Multitienda Lider (titular, NIT, correo), escriba 'igual que Lider'."
- "Las preguntas sobre los 3 negocios juntos están en el formulario de Multitienda Lider."

## Parámetros comunes

| | Lavandería | Frial |
|---|---|---|
| ejemploNombre | "Ej.: Lavandería Lider." | "Ej.: Frial Lider." |
| comprobante | boleta | nota de venta |
| volumen 1 | Órdenes por día (aprox.): Menos de 10 / 10 a 30 / 31 a 60 / Más de 60 / No sé | Ventas por día (aproximado): mismas opciones que Lider |
| volumen 2 | Kilos de ropa por día (aprox.): Menos de 50 / 50 a 150 / 151 a 300 / Más de 300 / No sé | Productos o cortes distintos: Menos de 30 / 30 a 100 / Más de 100 / No sé |
| permisos filas | Recibir ropa y crear órdenes · Cambiar el estado de una orden · Cobrar y entregar · Anular una orden · Dar descuentos · Cambiar precios · Ver reportes y ganancias · Abrir y cerrar caja · Administrar usuarios | Vender · Ver costo y ganancia · Dar descuentos · Anular o devolver una venta · Registrar compras y despiece · Ajustar inventario y mermas · Cambiar precios · Ver reportes · Abrir y cerrar caja · Administrar usuarios |
| permisos columnas | Dueño · Encargado · Empleado · Todos | Dueño · Encargado · Vendedor · Todos |

## Lavandería: secciones específicas (numeradas desde 4)

**4. Servicios y precios.** Descripción: la lista completa de servicios y precios va en la planilla de carga.
- casillas+otro "Servicios que ofrece": Lavado por kilo · Lavado por prenda · Lavado en seco · Solo planchado · Lavado y planchado · Edredones y frazadas · Cortinas · Alfombras · Zapatillas · Peluches · Desmanchado · Teñido · Arreglos y costura
- casillas+otro "¿Cómo cobra?": Por kilo · Por prenda · Por pieza grande (edredón, cortina) · Por metro cuadrado · Precio fijo por servicio
- texto "Precio actual por kilo (Bs)". Ayuda: si no cobra por kilo, déjelo en blanco.
- texto "Cobro mínimo por orden". Ayuda: Ej.: mínimo 3 kg o 20 Bs. Si no cobra mínimo, déjelo en blanco.
- texto "Tiempo normal de entrega". Ayuda: Ej.: 24 horas, 2 días.
- opcion "¿Tiene servicio express?" (ayuda: entrega más rápida con recargo): SI_NO
- texto "Express: ¿en cuánto tiempo y cuánto más cobra?"
- casillas+otro "Tipos de cliente": Personas particulares · Hoteles u hostales · Restaurantes · Clínicas u hospitales · Gimnasios o spas · Otras empresas
- opcion "¿Tiene precios distintos para empresas o clientes frecuentes?": SI_NO
- parrafo "Convenios con empresas". Ayuda: ¿les cobra por mes?, ¿les da crédito?, ¿tienen precio especial?

**5. Recepción de la ropa.**
- parrafo "Una orden de hoy, paso a paso". Ayuda: desde que el cliente deja la ropa hasta que la recoge.
- opcion "¿Pesa la ropa?": Sí, con balanza digital · Sí, con balanza de aguja · No, cobro por prenda
- texto "Marca y modelo de la balanza". Ayuda: está en la etiqueta y nos sirve para saber si se puede conectar a la computadora.
- opcion "¿Cuenta las prendas al recibir?": Sí, todas · Solo las grandes o caras · No
- casillas+otro "¿Qué anota de cada orden?": Nombre del cliente · Teléfono · Cantidad de prendas · Peso · Detalle de cada prenda (tipo, color, marca) · Daños o manchas previas · Objetos olvidados en los bolsillos · Fecha de entrega prometida · Instrucciones especiales
- opcion "¿Saca fotos de daños o manchas antes de lavar?": Sí · No, pero me serviría · No lo necesito
- casillas+otro "Comprobante que entrega al recibir": Boleta numerada de talonario · Boleta a mano sin número · Ticket impreso · Mensaje por WhatsApp · Ninguno
- casillas+otro "¿Cómo identifica la ropa de cada cliente?": Etiqueta o marbete en cada prenda · Bolsa con número · Canasta o casillero numerado · No la identificamos
- opcion "¿Recoge y entrega a domicilio?": Sí, gratis · Sí, con costo · No, pero me interesaría · No
- texto "Si recoge y entrega: ¿cuánto cobra y quién lo hace?"

**6. Proceso y estados.** Descripción: el estado es el paso en el que está la ropa de cada orden.
- casillas+otro "¿Qué estados usa o le gustaría ver?": Recibido · En lavado · En secado · En planchado · Listo para entregar · Entregado · Observado (hay un problema) · Enviado a otra lavandería
- texto "¿Quién cambia el estado de una orden?"
- opcion "¿Le serviría avisar al cliente por WhatsApp cuando su ropa está lista?": SI_NO_NS
- opcion "¿Manda algún servicio a otra lavandería?" (ayuda: Ej.: lavado en seco): SI_NO
- texto "¿Cuántas lavadoras y secadoras tiene?". Ayuda: Ej.: 4 lavadoras de 15 kg y 2 secadoras.
- opcion "¿Le serviría saber qué empleado atendió cada orden?": SI_NO_NS
- casillas+otro "Insumos que compra": Detergente · Suavizante · Quitamanchas · Bolsas · Ganchos · Etiquetas
- opcion "¿Le serviría controlar el stock de insumos?": Sí · No, pero me serviría más adelante · No lo necesito

**7. Pagos, entrega y caja.**
- opcion "¿Cuándo cobra?": Todo al recibir · Todo al entregar · Una parte al recibir y el resto al entregar · Depende del cliente
- casillas+otro "Formas de pago que acepta": Efectivo · QR · Transferencia · Tarjeta · Crédito (paga después)
- opcion "¿Entrega la ropa si el cliente perdió su boleta?": Sí, mostrando carnet · No · Depende
- opcion "¿Puede recoger la ropa otra persona?": Sí, con la boleta · Sí, si el cliente avisa · No
- texto "¿Cuántos días espera si el cliente no recoge su ropa?"
- parrafo "¿Qué hace con la ropa que no recogen?". Ayuda: Ej.: cobra por guardarla, la dona después de cierto tiempo.
- parrafo "Si una prenda se pierde o se daña, ¿cómo responde?"
- opcion "¿Emite factura hoy?": SI_NO · texto "Si factura, ¿con qué sistema?" · opcion "¿Le interesa la factura electrónica?": SI_NO_NS
- opcion "Caja diaria": Abro y cierro caja con arqueo · Solo cuento el dinero al final del día · No llevo control
- opcion "¿La caja de la lavandería es separada de la de Multitienda Lider?": Sí · No · No sé
- casillas+otro "Gastos que paga desde la caja": Insumos · Agua, luz o gas · Sueldos o adelantos · Transporte · Ninguno

**8. Clientes.**
- casillas+otro "Datos que pide al cliente": Nombre · Teléfono o WhatsApp · CI o NIT · Dirección · Correo
- opcion "¿Atiende a clientes sin anotar sus datos?": SI_NO
- opcion "¿Le serviría mandar avisos o promociones por WhatsApp?": SI_NO_NS
- opcion "¿Tiene una lista de clientes para cargar?": Sí, en cuaderno · Sí, en Excel o en el celular · No

**9. Reportes y cierre.**
- casillas+otro "¿Qué reportes necesita?": Ingresos del día y del mes · Órdenes por estado · Kilos lavados por día y por mes · Ingresos por servicio · Órdenes pendientes de entrega · Ropa no recogida · Saldos por cobrar · Trabajo por empleado · Gasto en insumos · Caja diaria · Comparativo de los 3 negocios
- Después, iguales a Lider: "¿Cómo quiere recibirlos?" · "¿Quién los ve?" (opciones: Dueño · Encargado · Contador · Empleados) · "¿Qué número mira primero cada día?" (ayuda: Ej.: lo cobrado ayer, las órdenes pendientes) · Comentarios · Persona de contacto · Mejor horario para contactarlo · **Confirmación obligatoria** (última pregunta, igual a Lider).

**Planilla "Lavandería — Datos iniciales":** Instrucciones (adaptadas) +
- `Servicios`: Código · Servicio · Cómo se cobra [lista: Por kilo, Por prenda, Por pieza, Por m², Precio fijo] · Precio normal (Bs) [≥0] · Precio express (Bs) [≥0] · Tiempo de entrega normal · Observaciones. Columna 1 como texto. 2 ejemplos con "EJEMPLO — borrar" en Observaciones (p. ej. LAV-KG Lavado por kilo, Por kilo, 10, 15, 24 horas · EDR-2P Edredón 2 plazas, Por pieza, 40, 55, 48 horas).
- `Clientes`: Nombre · CI o NIT · Teléfono · Dirección · Tipo [lista: Particular, Empresa] · Precio especial o convenio · Saldo pendiente (Bs) [≥0]. Columnas 2 y 3 como texto, para no perder ceros iniciales.
- `Órdenes pendientes`: Nro. de boleta · Cliente · Teléfono · Fecha de recepción · Detalle · Total (Bs) [≥0] · Pagado (Bs) [≥0] · Estado [lista: Recibido, En proceso, Listo, Observado]. Instrucción: solo la ropa que todavía está en el local el día que se empieza con el sistema.
- `Usuarios`: mismas columnas que en Lider.

## Frial: secciones específicas (numeradas desde 4)

**4. Productos y cortes.** Descripción: la lista completa va en la planilla de carga.
- casillas+otro "¿Qué vende?": Carne de res · Cerdo · Pollo · Cordero · Pescado · Embutidos (chorizo, salchicha) · Hamburguesas y procesados · Menudencias · Carbón y artículos de parrilla
- parrafo "Cortes principales". Ayuda: Ej.: lomo, pecho, costilla, carne molida.
- casillas+otro "¿Cómo vende?": Paquete al vacío con peso variable (se cobra lo que pesa) · Paquete con peso fijo (Ej.: 1 kg) · Cortado y pesado en el momento · Por unidad
- opcion "¿Quién envasa al vacío?": Nosotros, con máquina propia · Compramos ya envasado · Las dos cosas
- opcion "¿Vende fresco o congelado?": Fresco (refrigerado) · Congelado · Los dos
- opcion "¿Los paquetes llevan etiqueta con peso y precio?": Sí, la imprime la balanza · Sí, escrita a mano · No
- opcion "¿La etiqueta tiene código de barras?" (ayuda: algunas balanzas imprimen un código con el peso o el precio; nos sirve para saber si se puede leer al cobrar): SI_NO_NS
- texto "Marca y modelo de la balanza". Ayuda: está en la etiqueta de la balanza.
- opcion "¿La balanza está conectada a una computadora?": SI_NO_NS
- casillas+otro "Tipos de precio que maneja": Precio por kg al público · Precio mayorista (restaurantes, revendedores) · Precio por paquete · Ofertas por cantidad
- parrafo "¿Quién cambia los precios y cada cuánto?"

**5. Compras, despiece e inventario.** Descripción: kardex = registro de entradas y salidas de cada producto, en kilos.
- casillas+otro "¿Cómo compra la carne?": Res entera o media res · Cortes ya listos · Paquetes ya envasados · Pollo entero
- opcion "¿Despiezan ustedes la carne?" (ayuda: cortar una media res en lomo, costilla, molida, etc.): Sí · No · A veces
- opcion "¿Anota cuánto sale de cada corte al despiezar?" (ayuda: Ej.: de 100 kg de media res salen 8 kg de lomo y 15 de costilla. Se llama rendimiento): Sí · No, pero me serviría · No lo necesito
- parrafo "Proveedores principales". Ayuda: nombre y qué le compra a cada uno (matadero, frigorífico, distribuidor). También puede llenar la pestaña Proveedores.
- opcion "¿Anota el costo de compra por kilo?": Sí, siempre · A veces · No
- opcion "¿Anota lo que debe a proveedores?" (ayuda: se llama cuentas por pagar): Sí, lo anoto · No, pero me serviría · No lo necesito
- opcion "¿Controla fechas de vencimiento?": Sí, por paquete · Sí, por lote (lo envasado el mismo día) · No
- texto "¿Cuántos días dura un paquete?". Ayuda: al vacío refrigerado y congelado, más o menos.
- opcion "¿Le serviría un aviso de productos por vencer?": SI_NO_NS
- casillas+otro "Pérdidas o salidas que no son venta": Hueso y grasa al despiezar · Pérdida de peso (la carne se seca) · Vencido · Dañado o mal envasado · Consumo propio · Traslado a otro negocio
- texto "¿Quién autoriza los ajustes de inventario?"
- opcion "Frecuencia del conteo físico": mismas opciones que la pregunta de Lider con ese título
- texto "¿Cuántas cámaras o congeladoras tiene?". Ayuda: Ej.: 1 cámara y 3 congeladoras exhibidoras.
- opcion "¿Le serviría ver el stock por cámara o congeladora?": SI_NO_NS
- fecha "Fecha posible para el conteo inicial". Ayuda: el día en que se pesaría todo el producto para empezar con el stock correcto.
- opcion "¿Debe llevar registros para controles sanitarios (por ejemplo, SENASAG)?": SI_NO_NS

**6. Ventas y caja.**
- parrafo "Una venta de hoy, paso a paso". Ayuda: desde que el cliente pide hasta que se va con su producto.
- casillas+otro "¿A quién le vende?": Público en el local · Restaurantes y pensiones · Revendedores · Pedidos por WhatsApp · Hoteles
- opcion "¿Hace entregas a domicilio?": Sí, gratis · Sí, con costo · No, pero me interesaría · No
- casillas+otro "Formas de pago que acepta": Efectivo · QR · Transferencia · Tarjeta · Crédito (pagan después)
- parrafo "Si da crédito: ¿a quién, con qué plazo y hasta qué monto?"
- texto "Descuentos: ¿quién los autoriza y hasta qué %?"
- opcion "¿Acepta devoluciones o cambios?": Sí · No · Solo si el producto salió mal
- casillas+otro "Comprobante que entrega": Nota de venta impresa · Factura · Ticket de la balanza · Foto o PDF por WhatsApp · Ninguno
- opcion "¿Emite factura hoy?" · texto "Si factura, ¿con qué sistema?" · opcion "¿Le interesa la factura electrónica?": las mismas que en la lavandería
- opcion "Caja diaria" y opcion "¿La caja del frial es separada de la de Multitienda Lider?": las mismas que en la lavandería

**7. Clientes.** Las mismas 4 preguntas de la sección 8 de la lavandería.

**8. Reportes y cierre.**
- casillas+otro "¿Qué reportes necesita?": Ventas del día y del mes (Bs y kilos) · Ventas por corte o producto · Ganancia por kilo · Stock por corte en kilos · Productos por vencer · Pérdidas y mermas · Rendimiento del despiece · Compras a proveedores · Saldos por cobrar · Kardex por producto · Caja diaria · Comparativo de los 3 negocios
- El resto, igual que en la lavandería (con "¿Quién los ve?" usando Vendedores en vez de Empleados), terminando con la confirmación obligatoria.

**Planilla "Frial — Datos iniciales":** Instrucciones (adaptadas: los pesos van en kg con decimales, ej. 12,5) +
- `Productos`: Código interno · Código de balanza (PLU) · Descripción · Categoría [desde Categorías] · Forma de venta [lista: Por kg, Paquete de peso fijo, Por unidad] · Presentación [lista: Fresco, Congelado] · Precio costo (Bs por kg) · Precio venta (Bs por kg) · Precio mayorista (Bs por kg) · Stock actual (kg o unidades) · Stock mínimo · Vida útil (días) · Observaciones. Las 2 primeras columnas como texto y las numéricas ≥0. Ejemplos: RES-LOM, 101, Lomo de res al vacío, Res, Por kg, Fresco, 60, 85, 78, 12.5, 5, 21 · CER-COS, 205, Costilla de cerdo, Cerdo, Por kg, Congelado, 32, 48, 44, 20, 8, 90. Ambos con "EJEMPLO — borrar" en Observaciones.
- `Lotes`: Código interno · Lote o fecha de envasado · Fecha de vencimiento · Cantidad (kg) [≥0] · Ubicación (cámara o congeladora). Columna 1 como texto. Instrucción: solo si controla vencimientos.
- `Clientes`: Nombre · CI o NIT · Teléfono · Dirección · Tipo [lista: Particular, Restaurante, Revendedor, Otro] · Saldo pendiente (Bs) [≥0]. Columnas 2 y 3 como texto.
- `Proveedores`: Nombre · Qué le compra · Teléfono · Lo que le debe (Bs) [≥0]. Columna 3 como texto.
- `Usuarios`: como en Lider.
- `Categorías`: Res · Cerdo · Pollo · Cordero · Pescado · Embutidos · Procesados · Menudencias · Otros.

## Pasos

1. Chairman: rama, este plan y el puntero en el handoff junto con la decisión de la base de datos.
2. Sonnet:
   - Antes de tocar nada, guarda en el scratchpad la traza de llamadas del mock de `crearTodoLider` (hoy `crearTodoLider_YA_EJECUTADO`).
   - Refactoriza y agrega los dos negocios.
   - Compara la traza de Lider antes y después: tiene que ser idéntica, salvo diferencias justificadas.
   - Extiende `test-mock.mjs` a los 3 entry points y actualiza el README.
3. Chairman: revisa el diff y corre el test. Después `/code-review` y `/ponytail-review`. Los fixes van a un Sonnet nuevo.
4. Commit, PR y merge. Después el CTO corre `crearTodoLavanderia` y `crearTodoFrial` y me pasa las URLs.
5. Chairman: verifica los forms publicados con Playwright (`FB_PUBLIC_LOAD_DATA_`) y actualiza el handoff.

## Trampas

- No cambiar ni un texto de Lider: el form ya está publicado y el `.gs` tiene que seguir siendo su fuente.
- La primera función del archivo es la que queda preseleccionada en el editor. Se presta a ejecutar la función equivocada (ya pasó con `agregarPregunta`).
- El formato `@` va antes que los ejemplos y que cualquier `setValues`.
- La validación de categoría sale de un rango de la pestaña `Categorías`. Solo Lider y frial tienen esa pestaña.
- Títulos únicos dentro de cada sección, porque el test lo verifica.

## Verificación

- `node formularios/apps-script/test-mock.mjs` pasa para los 3 entry points.
- La traza de Lider es igual antes y después del refactor.
- En vivo: cada form con la cantidad esperada de páginas y preguntas, el correo requerido y la confirmación final obligatoria.
