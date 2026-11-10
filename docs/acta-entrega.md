# Acta de entrega (borrador)

Borrador para la cláusula sexta del contrato. No se firma hasta tener dominio propio (cláusula octava), el paralelo
cumplido (`docs/paralelo.md`) y las observaciones subsanadas. Los datos de las partes se completan sobre el papel: no van
al repo.

---

**ACTA DE ENTREGA Y CONFORMIDAD DE SOFTWARE**

En la ciudad de [ciudad], a los [día] días del mes de [mes] de [año], se reúnen [el CLIENTE], con C.I. [___], y [el
DESARROLLADOR], con C.I. [___], partes del contrato de desarrollo y venta de software de fecha [fecha del contrato], y
dejan constancia de lo siguiente:

**1. Entrega.** El DESARROLLADOR pone en funcionamiento y presenta el sistema ERP Multitiendas, publicado en
[dominio], para los negocios [tienda], [lavandería] y [frial].

**2. Alcance verificado (cláusula tercera).** Se revisó en presencia del CLIENTE, en sus equipos:

| Ítem del contrato | Cómo se verificó | Conforme |
|---|---|---|
| Sistema web y PWA multi-negocio con selector entre los tres negocios, datos separados | Selector "Negocio activo"; un negocio no ve datos de otro | ☐ |
| Adaptable a computadora, tableta y celular; instalable sin tiendas de aplicaciones | App instalada en [equipos] | ☐ |
| Tienda: ventas y punto de venta | Venta con lector, efectivo, QR y mixta; nota impresa con el NIT y los datos del negocio | ☐ |
| Tienda: inventario y kardex por producto | Entrada, traslado, conteo; kardex de un producto | ☐ |
| Tienda: catálogo por categoría y marca | "Productos" con 597 productos importados y sus fotos | ☐ |
| Tienda: clientes, registro y consulta | Alta y búsqueda de cliente | ☐ |
| Tienda: reportes de ventas | "Reportes" y descarga a Excel | ☐ |
| Lavandería: recepción de órdenes (cliente, prendas o servicio, peso o cantidad) | Orden con cliente, prendas y servicios, uno de ellos cobrado por kilo | ☐ |
| Lavandería: estados recibido, en proceso, listo y entregado | "Recibida", "En lavado", "Lista", "Entregada" | ☐ |
| Lavandería: registro de pago y de entrega | Cobro al recibir; entrega con quién retira | ☐ |
| Lavandería: reportes | "Reportes", "Ingresos" | ☐ |
| Frial: ventas por peso (kg) y por tipo de corte | Con un corte cargado en la demostración: venta en kg con decimales; cada corte es un producto | ☐ |
| Frial: inventario y kardex por producto o corte | Con ese corte: entrada con lote y vencimiento; kardex | ☐ |
| Frial: reportes | "Reportes" del frial | ☐ |
| Usuarios y accesos | Alta de cuenta, cambio de rol, desactivación; cambio y restablecimiento de contraseña | ☐ |
| Panel de administración protegido con usuario y contraseña | Ingreso solo con cuenta; el vendedor no entra al panel | ☐ |
| Publicación en el dominio y alojamiento (cláusula octava) | [dominio] con certificado válido | ☐ |

**3. Operación en paralelo.** Del [fecha] al [fecha] se operó con el sistema y el cuaderno a la vez, sin diferencias
sin explicar. Las planillas diarias firmadas se adjuntan.

**4. Datos.** Se cargaron [n] productos, el stock inicial por ubicación y [n] fotos desde la planilla del CLIENTE, con
conciliación sin diferencias. El frial se entrega sin catálogo: el CLIENTE carga sus cortes y precios. El sistema
guarda una copia de seguridad cifrada fuera del proveedor de alojamiento, de la base de datos dos veces al día y de las
fotos una vez por semana, y se hizo una restauración de prueba el [fecha]. La clave que descifra esas copias se entrega
con los accesos: sin ella ninguna copia se puede leer.

**5. Observaciones.** [Ninguna / Lista de observaciones y cómo se subsanaron.] Los límites conocidos del sistema y los
riesgos aceptados constan en los manuales entregados al CLIENTE.

**6. Funcionalidades adicionales.** Además del alcance de la cláusula tercera, el DESARROLLADOR entrega en
funcionamiento, y el CLIENTE recibe, las siguientes funcionalidades:

- venta a crédito con plan de cuotas, cobro de cuotas, cuentas por cobrar y carga de saldos iniciales;
- reservas con anticipo, y su conversión en venta o su cancelación;
- proveedores, compras y deudas con proveedores;
- insumos de lavandería, con su consumo y su reporte de gasto;
- venta sin conexión a internet en el punto de venta, con envío al reconectar;
- precios en dólares con tipo de cambio, y referencia del dólar paralelo.

Estas funcionalidades [quedan / no quedan] cubiertas por la garantía de la cláusula novena. [Completar según la
decisión D-01 antes de imprimir: el borrador no decide por las partes.]

**7. Conformidad.** Con la firma de esta acta el CLIENTE da su conformidad con el sistema entregado (cláusula sexta).
Desde esta fecha:
- es exigible el saldo de Bs 5.000 (cláusula cuarta);
- corre la garantía de cinco años (cláusula novena);
- con el precio total pagado, el DESARROLLADOR entrega el código fuente, los accesos y la administración del dominio
  (cláusulas séptima y octava). El alojamiento y el dominio del primer año corren por cuenta del DESARROLLADOR desde la
  publicación; desde el segundo año, por cuenta del CLIENTE.

Firmado en dos ejemplares.

| | |
|---|---|
| [CLIENTE] | [DESARROLLADOR] |

---

## Para preparar la firma

- [ ] Dominio comprado y apuntado a Vercel (RF-TR-10); certificado verificado
- [ ] Paralelo de 3 días cumplido, planillas firmadas
- [ ] Simulacro de restauración con datos reales, con fecha y tiempo (`docs/backup.md`)
- [ ] Lista de accesos a entregar con el código: repositorio, Vercel, Supabase, dominio, GitHub Actions (secreto del
      backup) y clave privada `age`. Se entregan en persona, nunca por chat
- [ ] Decidir la garantía del punto 6 (D-01, `docs/srs.md`): el punto ya enumera los extras
- [ ] Fecha del contrato: el ejemplar del repo la tiene en blanco (D-04)
- [ ] Credenciales rotadas antes de entregar los accesos (base de datos, claves de Supabase, secretos de GitHub
      Actions); diferido por el CTO al cierre (`docs/despliegue.md`)
- [ ] Copia fuera de línea de la clave privada `age` entregada y probada (`docs/backup.md`)
- [ ] NIT y datos de la nota cargados en los tres negocios ("Datos del negocio"); sin eso la nota sale sin dirección
- [ ] Un servicio por kilo cargado en la lavandería y un corte en el frial para la demostración del punto 2
- [ ] Limpieza de pruebas hecha antes del paralelo y "Actualizar ahora" pulsado una vez en cada equipo
      (`docs/paralelo.md`)
- [ ] Riesgos aceptados y límites conocidos leídos con el CLIENTE (manual del encargado y del dueño, "Solo el dueño")
- [ ] Preguntas abiertas con el CLIENTE cerradas o anotadas en el punto 5: interés en el pago anticipado de un
      crédito (P-07), saldos iniciales de crédito (P-06), anticipo al cancelar una reserva (P-12)
