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
| Tienda: ventas y punto de venta | Venta con lector, efectivo, QR y mixta; nota impresa | ☐ |
| Tienda: inventario y kardex por producto | Entrada, traslado, conteo; kardex de un producto | ☐ |
| Tienda: catálogo por categoría y marca | "Productos" con 597 productos importados y sus fotos | ☐ |
| Tienda: clientes, registro y consulta | Alta y búsqueda de cliente | ☐ |
| Tienda: reportes de ventas | "Reportes" y descarga a Excel | ☐ |
| Lavandería: recepción de órdenes (cliente, prendas o servicio, peso o cantidad) | Orden con cliente, prendas y servicios [verificar servicio por kg en la demostración] | ☐ |
| Lavandería: estados recibido, en proceso, listo y entregado | "Recibida", "En lavado", "Lista", "Entregada" | ☐ |
| Lavandería: registro de pago y de entrega | Cobro al recibir; entrega con quién retira | ☐ |
| Lavandería: reportes | "Reportes", "Ingresos" | ☐ |
| Frial: ventas por peso (kg) y por tipo de corte | Venta en kg con decimales; cada corte es un producto | ☐ |
| Frial: inventario y kardex por producto o corte | Entrada con lote y vencimiento; kardex | ☐ |
| Frial: reportes | "Reportes" del frial | ☐ |
| Usuarios y accesos | Alta de cuenta, cambio de rol, desactivación | ☐ |
| Panel de administración protegido con usuario y contraseña | Ingreso solo con cuenta; el vendedor no entra al panel | ☐ |
| Publicación en el dominio y alojamiento (cláusula octava) | [dominio] con certificado válido | ☐ |

**3. Operación en paralelo.** Del [fecha] al [fecha] se operó con el sistema y el cuaderno a la vez, sin diferencias
sin explicar. Las planillas diarias firmadas se adjuntan.

**4. Datos.** Se cargaron [n] productos, el stock inicial por ubicación y [n] fotos desde la planilla del CLIENTE, con
conciliación sin diferencias. El sistema guarda una copia de seguridad diaria fuera del proveedor de alojamiento, y se
hizo una restauración de prueba el [fecha].

**5. Observaciones.** [Ninguna / Lista de observaciones y cómo se subsanaron.]

**6. Funcionalidades adicionales.** [Si se entregan los extras de la Entrega B (crédito, reservas, proveedores,
insumos): enumerarlos y dejar escrito si quedan dentro de la garantía de la cláusula novena. Decisión pendiente del CTO.]

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
- [ ] Decidir el punto 6 (extras y garantía)
- [ ] Fecha del contrato: el ejemplar del repo la tiene en blanco
