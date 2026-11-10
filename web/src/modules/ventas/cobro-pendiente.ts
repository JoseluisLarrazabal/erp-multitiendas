import { z } from "zod";
import { ventaPayloadSchema, type VentaPayload } from "./schemas";
import type { NotaVenta } from "./venta";

// Cobro online-only (reserva o crédito) sin confirmar: lo que se envió y la nota armada con esos datos.
export type PendienteEnLinea = { payload: VentaPayload; nota: NotaVenta; guardadoEn: string };

// Viven en localStorage: se escriben ANTES de enviar y sobreviven a recargar, a cerrar la app y a cerrar sesión. Así un cobro
// cuya respuesta se perdió nunca se repite a ciegas (con otro id duplicaría el crédito, que no se anula). La clave no lleva
// usuario: otro cajero del mismo equipo ve el pendiente y no lo duplica. Cada lectura valida; lo inválido se descarta.
const CLAVE = "erp:cobros-en-linea";
export const alcanceCobros = (negocioId: string, equipoId: string) =>
  `${CLAVE}:${negocioId}:${equipoId}`;

// La nota solo se muestra; se exige lo mínimo que su vista necesita (la escribe este mismo código).
const notaSchema = z.looseObject({
  numero: z.string(),
  fechaIso: z.string(),
  vendedor: z.string(),
  negocio: z.looseObject({ nombre: z.string() }),
  lineas: z.array(z.unknown()),
});
const entradaSchema = z.object({
  payload: ventaPayloadSchema,
  nota: notaSchema,
  guardadoEn: z.iso.datetime(),
});

export function leerCobrosPendientes(alcance: string): Record<string, PendienteEnLinea> {
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(alcance) ?? "{}");
    if (typeof crudo !== "object" || crudo === null) return {};
    const salida: Record<string, PendienteEnLinea> = {};
    for (const [clave, v] of Object.entries(crudo)) {
      const e = entradaSchema.safeParse(v);
      if (e.success) salida[clave] = e.data as PendienteEnLinea;
    }
    return salida;
  } catch {
    return {};
  }
}

// false si no se pudo escribir: el llamador NO debe enviar el cobro (no quedaría rastro tras una recarga).
export function fijarCobroPendiente(
  alcance: string,
  clave: string,
  p: PendienteEnLinea | null,
): boolean {
  const todas = leerCobrosPendientes(alcance);
  if (p) todas[clave] = p;
  else delete todas[clave];
  try {
    if (Object.keys(todas).length === 0) localStorage.removeItem(alcance);
    else localStorage.setItem(alcance, JSON.stringify(todas));
    return true;
  } catch {
    return false;
  }
}
