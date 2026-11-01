import { z } from "zod";
import { parsearMonto } from "./domain";

// guid y no uuid: z.uuid() exige versión RFC y los IDs del seed no la cumplen.
const id = z.guid();
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((t) => (t === "" ? null : t));

const montoTexto = (decimales = 2, admiteCero = false) =>
  z
    .string()
    .refine((t) => parsearMonto(t, decimales, admiteCero) !== null)
    .transform((t) => parsearMonto(t, decimales, admiteCero)!);

const enteroOpcional = z
  .string()
  .trim()
  .refine((t) => t === "" || /^\d{1,3}$/.test(t))
  .transform((t) => (t === "" ? null : Number(t)));

const decimalOpcional = z
  .string()
  .trim()
  .refine((t) => t === "" || /^\d{1,9}([.,]\d{1,3})?$/.test(t))
  .transform((t) => (t === "" ? null : Number(t.replace(",", "."))));

export const productoSchema = z.object({
  negocioId: id,
  id: id.nullable(),
  codigo: z.string().trim().min(1).max(60),
  codigoBarras: textoOpcional(60),
  nombre: z.string().trim().min(1).max(200),
  marca: textoOpcional(80),
  modelo: textoOpcional(80),
  categoriaId: id.nullable(),
  tipo: z.enum(["producto", "servicio", "insumo"]),
  unidad: z.enum(["unidad", "kg"]),
  controlaSerie: z.boolean(),
  garantiaMeses: enteroOpcional,
  stockMinimo: decimalOpcional,
});

export const categoriaSchema = z.object({
  negocioId: id,
  id: id.nullable(),
  nombre: z.string().trim().min(1).max(80),
});

export const tipoCambioSchema = z.object({
  negocioId: id,
  valor: montoTexto(4),
});

export const estadoProductoSchema = z.object({ productoId: id, activo: z.boolean() });
export const fotoSchema = z.object({
  productoId: id,
  fotoPath: z.string().max(200).nullable(),
});

const LISTAS = ["contado", "credito", "mayorista", "minimo", "normal", "express"] as const;

// Una fila de la grilla: texto crudo de cada celda. Una lista vacía se borra; una escrita debe ser un monto.
export const filaPreciosSchema = z.object({
  productoId: id,
  moneda: z.enum(["BOB", "USD"]),
  precios: z.partialRecord(
    z.enum(LISTAS),
    z
      .string()
      .refine((t) => t.trim() === "" || parsearMonto(t) !== null)
      .transform((t) => (t.trim() === "" ? null : parsearMonto(t))),
  ),
});

export const guardarGrillaSchema = z.object({
  negocioId: id,
  filas: z
    .array(
      z.object({
        productoId: id,
        // null = solo cambió el costo; no se tocan los precios.
        precios: filaPreciosSchema.omit({ productoId: true }).nullable(),
        costo: montoTexto(4, true).nullable(),
      }),
    )
    .min(1)
    .max(200),
});

const textoUrl = (max: number) => z.string().trim().max(max).catch("");

// Parámetros de URL: son entrada del usuario y se validan como cualquier otra.
export const filtrosSchema = z.object({
  q: textoUrl(120),
  categoria: z.union([id, z.literal("")]).catch(""),
  marca: textoUrl(80),
  sinPrecio: z
    .string()
    .catch("")
    .transform((v) => v === "1"),
  inactivos: z
    .string()
    .catch("")
    .transform((v) => v === "1"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});
