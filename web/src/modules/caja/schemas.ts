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
  // null sin `ver_reportes` (M4): los términos del esperado no salen de la base.
  ventas_efectivo: z.number().nullable(),
  ingresos: z.number().nullable(),
  gastos: z.number().nullable(),
  retiros: z.number().nullable(),
  devoluciones_efectivo: z.number().nullable(),
  // Reservas (RF-RES): lo recibido y devuelto por caja, por medio. Parte del esperado y del QR neto.
  anticipos_efectivo: z.number().nullable(),
  anticipos_qr: z.number().nullable(),
  devoluciones_reserva_efectivo: z.number().nullable(),
  devoluciones_reserva_qr: z.number().nullable(),
  esperado: z.number().nullable(),
  qr_neto: z.number().nullable(),
  cantidad_ventas: z.number(),
  cantidad_movimientos: z.number(),
});
export type ResumenCaja = z.infer<typeof resumenCajaSchema>;

// Lo que la cola guarda de una apertura y de un movimiento hechos sin conexión. `creada_en` es la hora del equipo y va
// en `p_offline`; el servidor la limita a su propia hora.
const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
export const payloadAperturaSchema = z.object({
  id: z.guid(),
  negocio_id: z.guid(),
  dispositivo_id: z.guid(),
  monto_inicial: z.number().min(0),
  creada_en: fechaIso,
});
export type PayloadApertura = z.infer<typeof payloadAperturaSchema>;
export const payloadMovimientoSchema = z.object({
  id: z.guid(),
  sesion_id: z.guid(),
  tipo: z.enum(["ingreso", "gasto", "retiro"]),
  monto: z.number().positive(),
  motivo: z.string().min(1),
  creada_en: fechaIso,
});
export type PayloadMovimiento = z.infer<typeof payloadMovimientoSchema>;
