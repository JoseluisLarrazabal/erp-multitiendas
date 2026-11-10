import { z } from "zod";
import { limitesDelDia } from "@/lib/format/fecha";
import { leerFiltros } from "@/lib/filtros";

const id = z.guid();
const dia = z.string().refine((d) => d === "" || limitesDelDia(d) !== null);

// Parámetros de /panel/ventas.
const camposFiltros = {
  q: z.string().trim().max(20),
  estado: z.enum(["", "completada", "anulada"]),
  equipo: z.union([id, z.literal("")]),
  desde: dia,
  hasta: dia,
  pagina: z.coerce.number().int().min(1).max(10_000),
};
export type FiltrosVentas = {
  [K in keyof typeof camposFiltros]: z.output<(typeof camposFiltros)[K]>;
};
const FILTROS_VACIOS: FiltrosVentas = {
  q: "",
  estado: "",
  equipo: "",
  desde: "",
  hasta: "",
  pagina: 1,
};
export const leerFiltrosVentas = (crudo: Parameters<typeof leerFiltros>[2]) =>
  leerFiltros(camposFiltros, FILTROS_VACIOS, crudo);

export const anularSchema = z.object({
  ventaId: id,
  motivo: z.string().trim().min(1).max(200),
});

export const devolverSchema = z.object({
  id,
  ventaId: id,
  dispositivoId: id,
  cajaSesionId: id,
  medio: z.enum(["efectivo", "qr"]),
  motivo: z.string().trim().min(1).max(200),
  items: z
    .array(
      z.object({
        ventaItemId: id,
        cantidad: z.number().positive().max(999_999).multipleOf(0.001),
      }),
    )
    .min(1)
    .max(200),
});

// Porcentaje con coma o punto, hasta 2 decimales, 0 a 100.
export const topeTextoSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,2})?$/)
  .transform((t) => Number(t.replace(",", ".")))
  .refine((n) => n >= 0 && n <= 100);

export const topeSchema = z.object({ negocioId: id, tope: topeTextoSchema });

// Mismos límites que guardar_datos_negocio: NIT de una línea (20), nota de hasta 300 caracteres y 6 líneas.
export const datosNegocioSchema = z.object({
  negocioId: id,
  nit: z
    .string()
    .trim()
    .max(20)
    .regex(/^[^\r\n]*$/),
  datosNota: z
    .string()
    .transform((t) => t.replaceAll("\r\n", "\n").trim())
    .pipe(
      z
        .string()
        .max(300)
        .refine((t) => t.split("\n").length <= 6),
    ),
});

export function hrefVentas(f: Partial<FiltrosVentas>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.estado) p.set("estado", f.estado);
  if (f.equipo) p.set("equipo", f.equipo);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.pagina && f.pagina > 1) p.set("pagina", String(f.pagina));
  const s = p.toString();
  return `/panel/ventas${s ? `?${s}` : ""}`;
}

// Reconciliación: `desde` es el id de la última venta de la página anterior (paginación por cursor de la RPC).
export const leerDesdeReconciliacion = (crudo: Parameters<typeof leerFiltros>[2]) =>
  leerFiltros({ desde: id }, { desde: "" }, crudo);

export const revisarSchema = z.object({ ventaId: id });
export const pagoQrSchema = z.object({ pagoId: id, cobrado: z.boolean() });

const pagosPendientes = z.array(z.object({ id, monto: z.number() }));
export const parsearPagosPendientes = (json: unknown) => pagosPendientes.safeParse(json);
