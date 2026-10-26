# Handoff — ERP Multitiendas

Documento vivo. Fuente de verdad para planificar y ejecutar el proyecto.
Última actualización: 2026-10-26.

## Estado actual

- **Contrato redactado**, pendiente de firma: `/home/shadowfreak/Downloads/Contrato_ERP_Hinojosa_Claros.docx`
  (basado en el contrato de Elegance Dominio Barbería). Solo falta la fecha de firma (a mano).
- **Anticipo cobrado** (50%). Saldo (50%) se cobra a la entrega, contra firma del acta de entrega.
- **Desarrollo:** sin empezar. Repo: `github.com/JoseluisLarrazabal/erp-multitiendas` (privado).
- **Formulario de relevamiento Lider: LISTO (2026-10-26, PR #1).** Apps Script `formularios/apps-script/formulario-lider.gs`
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
- **Próximo:** formularios de lavandería y frial (nuevo array de secciones en el mismo script, reusan `SECCIONES_COMUNES`
  — ojo: si el dueño ya respondió las comunes en Lider, no repetirlas). Después: pulir prototipo `sistema-de-gestion-multinacional/`.

## Partes

- **Desarrollador:** José Luis Larrazabal Flores (QUIVO).
- **Cliente:** Oscar Deybi Hinojosa Claros, C.I. 6498512 Cbba. Nombre comercial: **MULTITIENDA LIDER**. Cochabamba.

## Qué se vende

ERP web multi-negocio, instalable como **PWA** (computadora y celular). Un **botón selector de negocio**
cambia entre los 3 negocios; cada uno tiene **sus propias funciones y sus datos separados**.

| Negocio | Alcance contratado |
|---|---|
| Tienda de electrodomésticos (línea blanca y negra) | Ventas / punto de venta, inventario, kardex de entradas y salidas por producto, catálogo por categoría y marca, clientes, reportes de ventas |
| Lavandería | Recepción de órdenes (cliente, prendas/servicio, peso o cantidad), estados (recibido → en proceso → listo → entregado), registro de pago y entrega, reportes |
| Frial de carnes | Ventas por peso (kg) y por corte, inventario y kardex por producto/corte, reportes |
| Común | Usuarios y accesos, panel de administración, reportes básicos por negocio |

**Fuera de alcance (explícito en el contrato, cláusula décima):** facturación electrónica, contabilidad,
planillas, gestión de sucursales. Cualquier módulo nuevo se cotiza aparte.

## Condiciones del contrato que impactan la planificación

- **Plazo: 30 días calendario** desde la firma + recepción de la información del cliente. Retrasos del
  cliente (información, listados, datos iniciales de inventario) amplían el plazo. Incumplir por causa
  propia obliga a devolver el anticipo en proporción a lo no ejecutado (cláusula duodécima) → planificar
  para entregar antes del día 30.
- **Aceptación tácita:** si el cliente no hace observaciones por escrito en 15 días hábiles desde la
  presentación del sistema, se tiene por aceptado y el saldo es exigible.
- **Garantía 5 años**, solo sobre errores imputables al desarrollador. Excluye mal uso, modificaciones del
  cliente/personal/terceros, fallas de sus equipos o internet, pérdida de datos causada por ellos, proveedor
  de alojamiento, rediseños y nuevas funcionalidades. → Código mantenible y con tests en lo crítico
  (kardex, stock, ventas por peso): cada bug durante 5 años es trabajo gratis.
- **Código fuente** se entrega al cancelar el total.
- **Dominio y hosting:** igual que Elegance — **el primer año lo regalo yo; desde el segundo año corre por
  cuenta del cliente.** Dominio a definir de común acuerdo con el cliente.

## Decisiones técnicas tomadas

- **Stack de referencia:** el mismo de Elegance (`~/Documents/EleganceDominio/webapp`): Next.js + React +
  Tailwind + Supabase (auth, Postgres, RLS), PWA con service worker. Confirmar en la planificación.
- **Base de datos: Supabase Free.** Viable porque se usa a diario (no se pausa por inactividad) y es un solo
  proyecto gratis.
- **Sin fotos de productos.** No hacen falta para un ERP (nombre, código, marca, precio). Mantiene la base
  muy por debajo del límite gratis.
- **Backup diario obligatorio:** Supabase Free no hace backups. Implementar `pg_dump` diario automático
  (p. ej. GitHub Action programada) con copia fuera de Supabase. Es requisito, no opcional: un ERP con
  kardex no puede perder datos.

## Pendientes / a decidir en la planificación

- **Hosting de la app:** Vercel Hobby es solo para uso no comercial; si lo detectan pueden suspender la cuenta
  (y caerían todos los proyectos de esa cuenta, incluido Elegance). Alternativa gratis con uso comercial:
  Cloudflare Workers/Pages (Next.js vía OpenNext). Decidir y verificar términos vigentes.
- **Modelo de datos multi-negocio:** cómo separar los datos de cada negocio (columna `negocio_id` + RLS vs.
  esquemas separados) y qué catálogos/usuarios son compartidos.
- **Frial:** unidad de medida por peso (decimales en kg) en ventas, stock y kardex desde el diseño.
- **Lavandería:** flujo de estados de la orden y cobro (¿anticipo al recibir / saldo al entregar?).
- **Roles de usuario** por negocio (¿un usuario ve los 3 negocios o solo el suyo?).
- **Carga inicial de datos:** formato en que el cliente entrega listados de productos, precios e inventario.
