import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  enviarPagoCuota,
  existePagoCuota,
  pagoCuotaSchema,
  type PagoCuotaPayload,
} from "@/modules/creditos";
import { reintentarHastaConfirmar } from "./reintento";

export type SalidaCuota =
  { t: "ok" } | { t: "rechazada"; error: string; codigo: string | null } | { t: "sin-confirmar" };

export const MENSAJE_CUOTA_SIN_CONFIRMAR =
  "No se confirmó el cobro de la cuota: no des el recibo por válido. Reintenta (se reenvía lo mismo) o descarta y verifica si quedó registrado.";

// Cobro de cuota sin confirmar: el payload (con su id) y cómo mostrarlo.
export type CuotaPendiente = { payload: PagoCuotaPayload; cliente: string; detalle: string };

// Viven en localStorage (sobreviven a recargar y a que el sistema mate la app): no se pierde el payload, y reintentarlo con el MISMO id nunca cobra dos veces
// (pagar_cuota es idempotente por id). Cada lectura valida con el schema del payload.
// La clave lleva el alcance (negocio, equipo y usuario): una pestaña con otra cuenta o equipo no ve ni se bloquea por lo de otra.
const CLAVE = "erp:cuotas-sin-confirmar";
export const alcanceCuotas = (negocioId: string, equipoId: string, usuarioId: string) =>
  `${CLAVE}:${negocioId}:${equipoId}:${usuarioId}`;

function leer(alcance: string): Record<string, CuotaPendiente> {
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(alcance) ?? "{}");
    if (typeof crudo !== "object" || crudo === null) return {};
    const salida: Record<string, CuotaPendiente> = {};
    for (const [creditoId, v] of Object.entries(crudo)) {
      const e = v as Partial<CuotaPendiente> | null;
      const p = pagoCuotaSchema.safeParse(e?.payload);
      if (p.success && typeof e?.cliente === "string" && typeof e.detalle === "string")
        salida[creditoId] = { payload: p.data, cliente: e.cliente, detalle: e.detalle };
    }
    return salida;
  } catch {
    return {};
  }
}
export const cuotasSinConfirmar = (alcance: string) => Object.values(leer(alcance));
export const cuotaSinConfirmar = (alcance: string, creditoId: string) => leer(alcance)[creditoId];
// Una entrada solo sale por un éxito confirmado, por la verificación de existencia o por un ERP que prueba que no se registró
// (PRUEBAN_NO_REGISTRADO): nunca por un permiso u otro rechazo, que no dicen qué pasó con un intento anterior.
export function fijarCuotaSinConfirmar(
  alcance: string,
  creditoId: string,
  p: CuotaPendiente | null,
) {
  const todas = leer(alcance);
  if (p) todas[creditoId] = p;
  else delete todas[creditoId];
  try {
    localStorage.setItem(alcance, JSON.stringify(todas));
  } catch {
    // Sin almacenamiento: el cobro sigue funcionando, solo no sobrevive a recargar.
  }
}
export const hayCuotasSinConfirmar = (alcance: string) => Object.keys(leer(alcance)).length > 0;

// pagar_cuota rechaza con estos DESPUÉS de reclamar la operación y la transacción se deshace: el pago no quedó.
export const PRUEBAN_NO_REGISTRADO = ["ERP_PAGO_EXCEDE_SALDO", "ERP_CAJA_CERRADA"];

// Cobra una cuota directo contra el servidor: NUNCA entra a la cola offline. Ante red caída o sin respuesta reintenta el mismo
// payload y avisa con `alVerificar`; si al final tampoco se ve el pago en el servidor devuelve "sin-confirmar" y el llamador
// conserva el payload para reintentar sin cambiar el id.
export async function cobrarCuota(
  supabase: SupabaseClient<Database>,
  payload: PagoCuotaPayload,
  o: { alVerificar: () => void; esperar?: (ms: number) => Promise<void> },
): Promise<SalidaCuota> {
  const r = await reintentarHastaConfirmar<SalidaCuota>({
    alDuda: o.alVerificar,
    esperar: o.esperar,
    intentar: async () => {
      const x = await enviarPagoCuota(supabase, payload);
      if (x.ok) return { t: "hecho", valor: { t: "ok" } };
      // Una respuesta del servidor con código es definitiva.
      if (x.codigo)
        return { t: "definitivo", valor: { t: "rechazada", error: x.error, codigo: x.codigo } };
      return { t: "duda" };
    },
    existe: async () => {
      const e = await existePagoCuota(supabase, payload.id);
      return e.ok && e.data ? { t: "ok" } : null;
    },
  });
  return r.t === "sin-confirmar" ? r : r.valor;
}
