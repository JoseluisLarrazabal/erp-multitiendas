import { z } from "zod";
import { cantidad, dinero } from "./schemas";

// Payload de crear_reserva: mismas claves y reglas que el servidor (RF-RES-01).
export const reservaPayloadSchema = z.strictObject({
  id: z.guid(),
  dispositivo_id: z.guid(),
  caja_sesion_id: z.guid(),
  cliente_id: z.guid(),
  producto_id: z.guid(),
  cantidad,
  precio_acordado: dinero.refine((n) => n > 0),
  anticipo: dinero.refine((n) => n > 0),
  medio: z.enum(["efectivo", "qr"]),
});
export type ReservaPayload = z.infer<typeof reservaPayloadSchema>;

// Fila de reservas_activas (numeric llega como número).
export const reservaActivaSchema = z.object({
  id: z.guid(),
  cliente_id: z.guid(),
  cliente_nombre: z.string(),
  producto_id: z.guid(),
  producto_nombre: z.string(),
  ubicacion_id: z.guid(),
  cantidad: z.number(),
  precio_acordado: z.number(),
  anticipo: z.number(),
  medio: z.enum(["efectivo", "qr"]),
  created_at: z.string(),
});
