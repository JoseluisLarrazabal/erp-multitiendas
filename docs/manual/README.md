# Manual de usuario

Manuales para el personal de los tres negocios (tienda, frial de carnes al vacío y lavandería). Cada manual se lee solo y se
entrega en PDF a la persona de ese rol. La fuente es el Markdown de esta carpeta.

## A quién va cada manual

| Archivo | PDF | Para quién |
|---|---|---|
| `vendedor.md` | `vendedor.pdf` | Vendedor de tienda y frial: punto de venta, caja, cobro, sin conexión, reservas y cobro de cuotas |
| `lavanderia.md` | `lavanderia.pdf` | Empleado de lavandería: órdenes, estados, entrega, anulación |
| `encargado-y-dueno.md` | `encargado-y-dueno.pdf` | Encargado y dueño: todo el panel y sus diferencias en el punto de venta (venta a crédito). Incluye la sección "Solo el dueño" (usuarios, dispositivos, descuento) |
| `contador.md` | `contador.pdf` | Contador: consulta, reportes y costos. No vende ni edita |

Quién recibe qué PDF:

- Vendedor de tienda o frial: `vendedor.pdf`.
- Empleado de lavandería: `lavanderia.pdf`.
- Encargado y dueño: `encargado-y-dueno.pdf` y también `vendedor.pdf`, porque usan el punto de venta (en lavandería, también
  `lavanderia.pdf`). El manual del encargado y del dueño solo explica las diferencias en el punto de venta.
- Contador: `contador.pdf`.

La guía de la sesión de capacitación es `docs/capacitacion.md`. El registro de todas las reglas que el manual debe recoger
es `docs/decisiones-manual.md`.

Las reglas que están pendientes de confirmar con el cliente aparecen en los manuales escritas como supuestos ("por ahora…, a
confirmar con el cliente"). Lo interno (seguridad de la base, alojamiento, migraciones, riesgos técnicos) no entra en ningún
manual.

## Regenerar las capturas

Las capturas están en `img/` y se generan con datos de prueba, nunca con datos del cliente.

1. Reiniciar la base local con los datos de prueba: `supabase db reset` (carga `supabase/seed.sql`).
2. En `web/`: `pnpm build`.
3. En `web/`: `pnpm manual:capturas`.

Nunca correr las capturas contra producción: puede tener datos reales del cliente. Cada manual cita sus capturas por nombre
fijo (por ejemplo `img/panel-precios.png`); no renombrar archivos sin cambiar el manual.

## Regenerar los PDF

Desde la raíz del repo: `scripts/manual/exportar.sh`. Los PDF quedan en `docs/manual/dist/`. Esa carpeta no se versiona: los
PDF se entregan, no se guardan en el repo.

## Regla de mantenimiento

Todo PR que cambie algo visible para el usuario (un texto de pantalla, un botón, una regla, un permiso) actualiza en el mismo PR:

1. `docs/decisiones-manual.md`, con la regla nueva o cambiada;
2. el manual del rol al que afecta;
3. la captura que muestra esa pantalla, si cambió.
