import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { mayorSecuenciaEnCola } from "./cola-ventas";
import { enviarConReglas } from "./envio-venta";
import { enviarVenta, existeVenta } from "./queries";
import { reintentarHastaConfirmar } from "./reintento";
import type { VentaPayload } from "./schemas";

export const MENSAJE_SIN_CONFIRMAR =
  "No se confirmó el cobro: no entregues el producto. Reintenta el cobro (se reenvía lo mismo) o descarta y verifica si quedó registrado.";

export type SalidaEnLinea =
  | { t: "ok"; numero: string; payload: VentaPayload }
  | { t: "rechazada"; error: string; codigo: string | null }
  | { t: "sin-confirmar"; payload: VentaPayload }
  // El pendiente no se pudo guardar en este equipo: NO se envió nada (o nada nuevo).
  | { t: "no-guardada" };

class NoGuardada extends Error {}

// Una venta online-only (completar una reserva o vender a crédito) NUNCA entra a la cola offline: va directo al servidor con su id (idempotente por id y huella).
// Las reglas de envío (duda, número duplicado, operación repetida) son las de la cola: ver enviarConReglas. Ante red
// caída o sin respuesta reintenta en memoria el MISMO payload y avisa con `alVerificar` (estado bloqueante); si al final
// tampoco existe la venta en el servidor devuelve "sin-confirmar" y el llamador conserva el payload para reintentar sin
// cambiar id ni número.
export async function cobrarEnLinea(
  supabase: SupabaseClient<Database>,
  o: {
    // Payload de un intento anterior sin confirmar: se reenvía idéntico y en duda (se comprueba antes de renumerar).
    previo?: VentaPayload;
    // Arma el payload con el número `seq`; null si no se puede armar.
    armar: (seq: number) => VentaPayload | null;
    primerNumero: number;
    alVerificar: () => void;
    esperar?: (ms: number) => Promise<void>;
    mayorEnCola?: (dispositivoId: string) => Promise<number>;
    // Persiste el payload ANTES de enviarlo (primer envío y cada renumeración); false = no se pudo y no se envía.
    guardar?: (venta: VentaPayload) => boolean;
  },
): Promise<SalidaEnLinea | { t: "no-armada" }> {
  const mayorEnCola = o.mayorEnCola ?? mayorSecuenciaEnCola;
  let venta = o.previo ?? o.armar(o.primerNumero);
  if (!venta) return { t: "no-armada" };
  // Un intento anterior sin confirmar ya está en duda: se comprueba antes de renumerar.
  let enDuda = !!o.previo;
  // Un previo ya está guardado (así llegó aquí).
  if (!o.previo && o.guardar && !o.guardar(venta)) return { t: "no-guardada" };
  const guardar = o.guardar;
  const r = await reintentarHastaConfirmar<SalidaEnLinea>({
    alDuda: o.alVerificar,
    esperar: o.esperar,
    intentar: async (i) => {
      const x = await enviarConReglas(supabase, venta!, {
        enviar: (v) => enviarVenta(supabase, v),
        enDuda,
        inesperados: i,
        dispositivoId: venta!.dispositivo_id,
        mayorEnCola: () => mayorEnCola(venta!.dispositivo_id),
        alRenumerar: async (v) => {
          if (guardar && !guardar(v)) throw new NoGuardada();
        },
      });
      venta = x.venta;
      if (x.t === "ok")
        return { t: "hecho", valor: { t: "ok", numero: x.venta.numero, payload: x.venta } };
      if (x.t === "rechazo")
        return { t: "definitivo", valor: { t: "rechazada", error: x.error, codigo: x.codigo } };
      enDuda = true; // sin respuesta definitiva: la base pudo guardarla
      return { t: "duda" };
    },
    existe: async () => {
      const e = await existeVenta(supabase, venta!.id);
      return e.ok && e.data ? { t: "ok", numero: venta!.numero, payload: venta! } : null;
    },
  }).catch((e: unknown) => {
    if (e instanceof NoGuardada) return null;
    throw e;
  });
  if (!r) return { t: "no-guardada" };
  return r.t === "sin-confirmar" ? { t: "sin-confirmar", payload: venta as VentaPayload } : r.valor;
}
