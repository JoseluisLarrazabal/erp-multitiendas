import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_INTENTOS_INESPERADOS } from "@/lib/offline/envio";
import type { Database } from "@/lib/supabase/database.types";
import {
  formatearNumero,
  MAX_NUMERO_DUPLICADO,
  secuenciaAgotada,
  siguienteSecuencia,
} from "./domain";
import { leerContador, subirContador } from "./equipo-local";
import { existeVenta, type ErrorEnvio } from "./queries";
import type { VentaPayload } from "./schemas";

export const MENSAJE_AGOTADA = "Numeración del equipo agotada, avisa al encargado.";
const MENSAJE_DUPLICADOS =
  "No se pudo asignar un número de nota: otro equipo o pestaña los está usando. Recarga la página e intenta de nuevo.";
const MENSAJE_INESPERADO =
  "El servidor devolvió un error inesperado varias veces seguidas. Avisa al encargado antes de reintentar.";

export const secuenciaDe = (numero: string) =>
  Number(numero.slice(numero.lastIndexOf("-") + 1)) || 0;

export type ResultadoReglas =
  | { t: "ok"; venta: VentaPayload }
  // Sin respuesta definitiva del servidor: se puede reintentar el mismo payload (idempotente por id).
  | { t: "red"; error: string; respondio: boolean; venta: VentaPayload }
  | { t: "rechazo"; error: string; codigo: string | null; venta: VentaPayload };

// Reglas de envío de una venta compartidas por la cola offline y el cobro de reservas:
//  - solo un código ERP_ es una respuesta definitiva; cualquier otro fallo se reintenta hasta MAX_INTENTOS_INESPERADOS;
//  - `enDuda` (un intento anterior terminó sin respuesta) y ERP_OPERACION_REPETIDA se comprueban con existeVenta antes
//    de renumerar o rechazar;
//  - ERP_NUMERO_DUPLICADO (la base no guardó nada) pasa al número siguiente, el id se conserva.
export async function enviarConReglas(
  supabase: SupabaseClient<Database>,
  inicial: VentaPayload,
  o: {
    enviar: (venta: VentaPayload) => Promise<{ ok: true; numero: string } | ErrorEnvio>;
    enDuda: boolean;
    inesperados: number;
    dispositivoId: string;
    // Mayor número de nota del equipo en la cola local (los números encolados ya salieron al cliente).
    mayorEnCola: () => Promise<number>;
    // Persiste la venta renumerada antes de reenviarla.
    alRenumerar?: (venta: VentaPayload) => Promise<void>;
  },
): Promise<ResultadoReglas> {
  let venta = inicial;
  let enDuda = o.enDuda;
  const ok = (): ResultadoReglas => {
    subirContador(o.dispositivoId, secuenciaDe(venta.numero));
    return { t: "ok", venta };
  };
  const rechazo = (error: string, codigo: string | null): ResultadoReglas => ({
    t: "rechazo",
    error,
    codigo,
    venta,
  });
  for (let duplicados = 0; ; duplicados++) {
    const r = await o.enviar(venta);
    if (r.ok) return ok();
    const inesperado = !r.codigo && o.inesperados >= MAX_INTENTOS_INESPERADOS;
    if (r.red || (!r.codigo && !inesperado))
      return { t: "red", error: r.error, respondio: !r.red, venta };
    if (enDuda || r.codigo === "ERP_OPERACION_REPETIDA") {
      const existe = await existeVenta(supabase, venta.id);
      if (!existe.ok) return { t: "red", error: existe.error, respondio: !existe.red, venta };
      if (existe.data) return ok();
      enDuda = false; // no existe: los duplicados siguientes son de números que esta venta nunca guardó
    }
    if (r.codigo !== "ERP_NUMERO_DUPLICADO")
      return rechazo(inesperado ? MENSAJE_INESPERADO : r.error, r.codigo);
    if (duplicados >= MAX_NUMERO_DUPLICADO) return rechazo(MENSAJE_DUPLICADOS, r.codigo);

    subirContador(o.dispositivoId, secuenciaDe(venta.numero)); // ese número ya es de otra venta
    const seq = siguienteSecuencia(
      secuenciaDe(venta.numero),
      leerContador(o.dispositivoId),
      await o.mayorEnCola(),
    );
    if (secuenciaAgotada(seq)) return rechazo(MENSAJE_AGOTADA, r.codigo);
    const numero = formatearNumero(venta.numero.slice(0, venta.numero.lastIndexOf("-")), seq);
    venta = { ...venta, numero };
    await o.alRenumerar?.(venta);
  }
}
