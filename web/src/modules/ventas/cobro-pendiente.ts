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

// false si no se pudo escribir: el llamador NO debe enviar el cobro (no quedaría rastro tras una recarga). Otra pestaña
// del mismo equipo comparte esta clave: una entrada con otro id es de otro cobro, así que ni se pisa al escribir (false)
// ni se borra al quitar (`idBorrar`: el id que esta pestaña cree tener; si lo guardado es otro, no se toca).
export function fijarCobroPendiente(
  alcance: string,
  clave: string,
  p: PendienteEnLinea | null,
  idBorrar?: string,
): boolean {
  const todas = leerCobrosPendientes(alcance);
  const guardado = todas[clave]?.payload.id;
  if (p) {
    if (guardado && guardado !== p.payload.id) return false;
    todas[clave] = p;
  } else {
    if (guardado !== idBorrar) return true;
    delete todas[clave];
  }
  try {
    if (Object.keys(todas).length === 0) localStorage.removeItem(alcance);
    else localStorage.setItem(alcance, JSON.stringify(todas));
    return true;
  } catch {
    return false;
  }
}

// Montos fijos (centavos) que el cobro muestra como "sin confirmar". No mientras el envío está en vuelo: ahí todavía no falló nada.
export function montosCongelados(p: PendienteEnLinea | undefined, estado: { t: string }) {
  if (!p || estado.t === "enviando") return undefined;
  const de = (medio: string) =>
    Math.round((p.payload.pagos.find((x) => x.medio === medio)?.monto ?? 0) * 100);
  return { efectivo: de("efectivo"), qr: de("qr") };
}
