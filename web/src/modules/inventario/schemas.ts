import { z } from "zod";
import { parsearMonto } from "@/modules/catalogo";
import { MAX_ITEMS_CONTEO, MAX_SERIES } from "./domain";

// guid y no uuid: z.uuid() exige versión RFC y los IDs del seed no la cumplen.
const id = z.guid();
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((t) => (t === "" ? null : t));

// Texto crudo de una cantidad -> número. No conoce la unidad del producto: que sea entera con `unidad` lo exige el
// formulario y, como red, la RPC. Coma o punto decimal, hasta 3 decimales, sin miles ("1.500" es ambiguo).
const cantidad = (conSigno = false, admiteCero = false) =>
  z
    .string()
    .trim()
    .transform((t) => t.replace(/^−/, "-"))
    .refine(
      (t) =>
        (conSigno ? /^[+-]?\d{1,9}([.,]\d{1,3})?$/ : /^\d{1,9}([.,]\d{1,3})?$/).test(t) &&
        !/^[+-]?\d+\.\d{3}$/.test(t),
    )
    .transform((t) => Number(t.replace(",", ".")))
    .refine((n) => admiteCero || n !== 0);

const operacion = { operacionId: id, negocioId: id };

export const entradaSchema = z.object({
  ...operacion,
  productoId: id,
  ubicacionId: id,
  cantidad: cantidad().refine((n) => n > 0),
  costo: z
    .string()
    .trim()
    .refine((t) => t === "" || parsearMonto(t, 4, true) !== null)
    .transform((t) => (t === "" ? null : parsearMonto(t, 4, true))),
  motivo: textoOpcional(200),
});

const serieIds = z.array(id).max(MAX_SERIES);

export const salidaSchema = z
  .object({
    ...operacion,
    productoId: id,
    ubicacionId: id,
    tipo: z.enum(["ajuste", "danado", "merma", "cambio_garantia", "devolucion_proveedor"]),
    // Con signo solo en `ajuste`; en el resto es la cantidad que sale (positiva) y se envía negativa.
    cantidad: z.string(),
    motivo: z.string().trim().min(1).max(200),
    serieIds: serieIds.nullable(),
  })
  .transform((d, ctx) => {
    const r = cantidad(d.tipo === "ajuste").safeParse(d.cantidad);
    if (!r.success || (d.tipo !== "ajuste" && r.data <= 0)) {
      ctx.issues.push({
        code: "custom",
        message: "cantidad",
        path: ["cantidad"],
        input: d.cantidad,
      });
      return z.NEVER;
    }
    return { ...d, cantidad: d.tipo === "ajuste" ? r.data : -r.data };
  });

export const trasladoSchema = z
  .object({
    ...operacion,
    productoId: id,
    origenId: id,
    destinoId: id,
    cantidad: cantidad().refine((n) => n > 0),
    motivo: textoOpcional(200),
    serieIds: serieIds.nullable(),
  })
  .refine((d) => d.origenId !== d.destinoId, { path: ["destinoId"] });

export const conteoSchema = z.object({
  ...operacion,
  ubicacionId: id,
  motivo: textoOpcional(200),
  items: z
    .array(
      z.object({
        productoId: id,
        cantidad: cantidad(false, true),
        serieIds: serieIds.nullable(),
      }),
    )
    .min(1)
    .max(MAX_ITEMS_CONTEO),
});

export const seriesSchema = z.object({
  negocioId: id,
  productoId: id,
  ubicacionId: id,
  // Una por línea (o separadas por coma o punto y coma).
  series: z
    .string()
    .max(100_000)
    .transform((t) =>
      t
        .split(/[\n\r,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(100)).min(1).max(MAX_SERIES)),
});

export const busquedaSchema = z.object({
  negocioId: id,
  q: z.string().trim().min(1).max(80),
});

export const stockProductoSchema = z.object({ negocioId: id, productoId: id });
export const seriesDisponiblesSchema = z.object({
  negocioId: id,
  productoId: id,
  ubicacionId: id,
});
export const paginaConteoSchema = z.object({
  negocioId: id,
  ubicacionId: id,
  q: z.string().trim().max(80),
  pagina: z.number().int().min(1).max(10_000),
});

// Parámetros de /panel/inventario.
export const filtrosStockSchema = z.object({
  q: z.string().trim().max(120).catch(""),
  bajo: z
    .string()
    .catch("")
    .transform((v) => v === "1"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type FiltrosStock = z.infer<typeof filtrosStockSchema>;

// Parámetros del kardex: cursor y ubicación.
export const filtrosKardexSchema = z.object({
  ubicacion: z.union([id, z.literal("")]).catch(""),
  desde: z.union([id, z.literal("")]).catch(""),
});
