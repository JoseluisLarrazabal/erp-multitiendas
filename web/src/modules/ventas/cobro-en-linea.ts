import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { mayorSecuenciaEnCola } from "./cola-ventas";
import { enviarConReglas } from "./envio-venta";
import { enviarVenta, existeVenta } from "./queries";
import type { VentaPayload } from "./schemas";

export const MENSAJE_SIN_CONFIRMAR =
  "No se confirmó el cobro: no entregues el producto. Reintenta el cobro (se reenvía lo mismo) o descarta y verifica si quedó registrado.";

export type SalidaEnLinea =
  | { t: "ok"; numero: string; payload: VentaPayload }
  | { t: "rechazada"; error: string; codigo: string | null }
  | { t: "sin-confirmar"; payload: VentaPayload };

const ESPERAS_MS = [1000, 2000, 4000];

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
  },
): Promise<SalidaEnLinea | { t: "no-armada" }> {
  const esperar = o.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const mayorEnCola = o.mayorEnCola ?? mayorSecuenciaEnCola;
  let venta = o.previo ?? o.armar(o.primerNumero);
  if (!venta) return { t: "no-armada" };
  let enDuda = !!o.previo;
  for (let i = 0; ; i++) {
    const r = await enviarConReglas(supabase, venta, {
      enviar: (v) => enviarVenta(supabase, v),
      enDuda,
      inesperados: i,
      dispositivoId: venta.dispositivo_id,
      mayorEnCola: () => mayorEnCola(venta!.dispositivo_id),
    });
    venta = r.venta;
    if (r.t === "ok") return { t: "ok", numero: r.venta.numero, payload: r.venta };
    if (r.t === "rechazo") return { t: "rechazada", error: r.error, codigo: r.codigo };
    // Sin respuesta definitiva: la base pudo guardarla, así que los intentos siguientes van en duda.
    enDuda = true;
    o.alVerificar();
    if (i >= ESPERAS_MS.length) {
      const existe = await existeVenta(supabase, venta.id);
      return existe.ok && existe.data
        ? { t: "ok", numero: venta.numero, payload: venta }
        : { t: "sin-confirmar", payload: venta };
    }
    await esperar(ESPERAS_MS[i]!);
  }
}
