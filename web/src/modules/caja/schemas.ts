import { z } from "zod";

// Monto inicial de apertura: Bs, 0 o más, hasta 2 decimales (numeric(12,2) en la base).
export const aperturaSchema = z.object({
  montoInicial: z.number().min(0).max(9_999_999).multipleOf(0.01),
});

export const sesionCajaSchema = z.object({
  id: z.guid(),
  monto_inicial: z.number(),
  abierta_en: z.string(),
});
export type SesionCaja = z.infer<typeof sesionCajaSchema>;

export const movimientoSchema = z.object({
  tipo: z.enum(["ingreso", "gasto", "retiro"]),
  monto: z.number().positive().max(9_999_999).multipleOf(0.01),
  motivo: z.string().trim().min(1).max(200),
});

// Respuesta de cerrar_caja (jsonb).
export const cierreSchema = z.object({
  monto_esperado: z.number(),
  diferencia: z.number(),
  total_qr: z.number(),
});
export type Cierre = z.infer<typeof cierreSchema>;

// Respuesta de resumen_caja (jsonb): arqueo calculado en SQL, en Bs.
export const resumenCajaSchema = z.object({
  monto_inicial: z.number(),
  ventas_efectivo: z.number(),
  ingresos: z.number(),
  gastos: z.number(),
  retiros: z.number(),
  devoluciones_efectivo: z.number(),
  esperado: z.number(),
  qr_neto: z.number(),
  cantidad_ventas: z.number(),
  cantidad_movimientos: z.number(),
});
export type ResumenCaja = z.infer<typeof resumenCajaSchema>;
