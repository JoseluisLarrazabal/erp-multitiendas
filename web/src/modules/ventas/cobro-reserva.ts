import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { MAX_NUMERO_DUPLICADO, secuenciaAgotada } from "./domain";
import { enviarVenta, existeVenta } from "./queries";
import type { VentaPayload } from "./schemas";

export const MENSAJE_SIN_CONFIRMAR =
  "No se confirmó el cobro: no entregues el producto. Vuelve a confirmar para reintentar con el mismo número; no cobres otra vez.";

export type SalidaReserva =
  | { t: "ok"; numero: string; payload: VentaPayload }
  | { t: "rechazada"; error: string; codigo: string | null }
  | { t: "sin-confirmar"; payload: VentaPayload }
  | { t: "agotada" }
  | { t: "no-armada" };

const ESPERAS_MS = [1000, 2000, 4000];

// Una venta de reserva NUNCA entra a la cola offline: va directo al servidor con su id (idempotente por id y huella).
// Ante red caída o sin respuesta reintenta en memoria el MISMO payload y avisa con `alVerificar` (estado bloqueante);
// si al final tampoco existe la venta en el servidor, devuelve "sin-confirmar" y el llamador conserva el payload para
// reintentar sin cambiar id ni número. ERP_NUMERO_DUPLICADO (la base no guardó nada) pasa al número siguiente.
export async function cobrarReserva(
  supabase: SupabaseClient<Database>,
  o: {
    // Payload ya armado en un intento anterior sin confirmar: se reenvía idéntico.
    previo?: VentaPayload;
    // Arma el payload con el número `seq`; null si no se puede armar.
    armar: (seq: number) => VentaPayload | null;
    primerNumero: number;
    alVerificar: () => void;
    esperar?: (ms: number) => Promise<void>;
  },
): Promise<SalidaReserva> {
  const esperar = o.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let seq = o.primerNumero;
  for (let duplicados = 0; ; duplicados++) {
    if (secuenciaAgotada(seq)) return { t: "agotada" };
    const payload = duplicados === 0 && o.previo ? o.previo : o.armar(seq);
    if (!payload) return { t: "no-armada" };
    let ultimo = await enviarVenta(supabase, payload);
    for (let i = 0; !ultimo.ok && !ultimo.codigo && i < ESPERAS_MS.length; i++) {
      o.alVerificar();
      await esperar(ESPERAS_MS[i]!);
      ultimo = await enviarVenta(supabase, payload);
    }
    if (ultimo.ok) return { t: "ok", numero: ultimo.numero, payload };
    if (!ultimo.codigo) {
      o.alVerificar();
      const existe = await existeVenta(supabase, payload.id);
      return existe.ok && existe.data
        ? { t: "ok", numero: payload.numero, payload }
        : { t: "sin-confirmar", payload };
    }
    if (ultimo.codigo === "ERP_NUMERO_DUPLICADO" && duplicados < MAX_NUMERO_DUPLICADO) {
      seq += 1;
      continue;
    }
    return { t: "rechazada", error: ultimo.error, codigo: ultimo.codigo };
  }
}
