import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { enviarPagoCuota, existePagoCuota, type PagoCuotaPayload } from "@/modules/creditos";

export type SalidaCuota =
  { t: "ok" } | { t: "rechazada"; error: string; codigo: string | null } | { t: "sin-confirmar" };

const ESPERAS_MS = [1000, 2000, 4000];

export const MENSAJE_CUOTA_SIN_CONFIRMAR =
  "No se confirmó el cobro de la cuota: no des el recibo por válido. Reintenta (se reenvía lo mismo) o descarta y verifica si quedó registrado.";

// Cobros de cuota sin confirmar, por crédito. Viven fuera de los componentes: salir del modo Cuotas no pierde el payload,
// y reintentarlo con el MISMO id nunca cobra dos veces (pagar_cuota es idempotente por id).
const sinConfirmar = new Map<string, PagoCuotaPayload>();
export const cuotaSinConfirmar = (creditoId: string) => sinConfirmar.get(creditoId);
export const fijarCuotaSinConfirmar = (creditoId: string, p: PagoCuotaPayload | null) => {
  if (p) sinConfirmar.set(creditoId, p);
  else sinConfirmar.delete(creditoId);
};
export const hayCuotasSinConfirmar = () => sinConfirmar.size > 0;

// Cobra una cuota directo contra el servidor: NUNCA entra a la cola offline. Ante red caída o sin respuesta reintenta en
// memoria el mismo payload y avisa con `alVerificar`; si al final tampoco se ve el pago en el servidor devuelve
// "sin-confirmar" y el llamador conserva el payload para reintentar sin cambiar el id.
export async function cobrarCuota(
  supabase: SupabaseClient<Database>,
  payload: PagoCuotaPayload,
  o: { alVerificar: () => void; esperar?: (ms: number) => Promise<void> },
): Promise<SalidaCuota> {
  const esperar = o.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let i = 0; ; i++) {
    const r = await enviarPagoCuota(supabase, payload);
    if (r.ok) return { t: "ok" };
    // Una respuesta del servidor con código es definitiva; la repetición con otros datos no pudo cobrar nada.
    if (r.codigo) return { t: "rechazada", error: r.error, codigo: r.codigo };
    o.alVerificar();
    if (i >= ESPERAS_MS.length) {
      const existe = await existePagoCuota(supabase, payload.id);
      return existe.ok && existe.data ? { t: "ok" } : { t: "sin-confirmar" };
    }
    await esperar(ESPERAS_MS[i]!);
  }
}
