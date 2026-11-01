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
