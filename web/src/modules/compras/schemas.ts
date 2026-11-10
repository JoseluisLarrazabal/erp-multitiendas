import { z } from "zod";
import { leerFiltros } from "@/lib/filtros";
import { parsearMonto } from "@/lib/format/moneda";
import { fechaDia } from "@/modules/inventario";
import { MEDIOS_PAGO, parsearCantidadCompra, parsearCostoCompra } from "./domain";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s));

// Alta o edición. `id` presente = edición (reemplaza nombre, contacto y activo).
export const proveedorSchema = z.object({
  negocioId: z.guid(),
  id: z.guid().optional(),
  nombre: z.string().trim().min(1).max(200),
  contacto: textoOpcional(300),
  activo: z.boolean().default(true),
});

const medio = z.enum(MEDIOS_PAGO);

export const pagoSchema = z.object({
  operacionId: z.guid(),
  negocioId: z.guid(),
  proveedorId: z.guid(),
  monto: z.string().refine((t) => (parsearMonto(t) ?? 0) > 0),
  medio,
});

// Lote y vence (frial, M-8) van juntos: uno solo no sirve. Vacío o ausente = null; la RPC exige ambos en el frial y
// los rechaza fuera de él.
const itemSchema = z
  .object({
    productoId: z.guid(),
    cantidad: z.string().refine((t) => (parsearCantidadCompra(t) ?? 0n) > 0n),
    costo: z.string().refine((t) => parsearCostoCompra(t) !== null),
    lote: textoOpcional(40)
      .nullish()
      .transform((v) => v ?? null),
    vence: fechaDia.nullish().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.lote && !d.vence) ctx.addIssue({ code: "custom", path: ["vence"] });
    if (d.vence && !d.lote) ctx.addIssue({ code: "custom", path: ["lote"] });
  });

export const compraSchema = z
  .object({
    operacionId: z.guid(),
    negocioId: z.guid(),
    proveedorId: z.guid(),
    ubicacionId: z.guid(),
    condicion: z.enum(["contado", "credito"]),
    medio: medio.optional(),
    items: z.array(itemSchema).min(1).max(200),
  })
  .refine((d) => d.condicion === "credito" || d.medio, { path: ["medio"] })
  .refine((d) => new Set(d.items.map((i) => i.productoId)).size === d.items.length, {
    path: ["items"],
  });

const motivo = z.string().trim().min(1).max(200);

export const anularCompraSchema = z.object({ operacionId: z.guid(), compraId: z.guid(), motivo });
export const anularPagoSchema = z.object({ operacionId: z.guid(), pagoId: z.guid(), motivo });
export const ultimoPagoSchema = z.object({ proveedorId: z.guid() });

// Respuesta de ultimo_pago_proveedor: null si el proveedor no tiene pagos vivos.
export const pagoVivoSchema = z
  .object({ id: z.guid(), monto: z.number(), created_at: z.string(), automatico: z.boolean() })
  .nullable();

export const PAGINA_COMPRAS = 25;
export type FiltrosCompras = { pagina: number };
export const leerFiltrosCompras = (crudo: Parameters<typeof leerFiltros>[2]) =>
  leerFiltros({ pagina: z.coerce.number().int().min(1).max(10_000) }, { pagina: 1 }, crudo);
