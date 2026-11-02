import { codigoErp, errorRpc, esFalloDeRed } from "@/lib/erp-errores";
import type { ResultadoEnvio } from "./cola";

// Errores sin código ERP_ (PGRST, 40P01, 5xx) pueden ser transitorios: se reintentan este número de veces y después la
// fila pasa a rechazada, para que una fila envenenada no corte la cola para siempre.
export const MAX_INTENTOS_INESPERADOS = 5;

type ErrorRpc = { message?: string; code?: string };

// Resultado de una RPC idempotente de la cola que falló (apertura y movimientos de caja). Sin respuesta: red. Con código
// ERP_: rechazo definitivo. Otro error: red, con tope.
export function resultadoDeError(error: ErrorRpc, intentos: number): ResultadoEnvio {
  const e = errorRpc(error);
  if (esFalloDeRed(error)) return { t: "red", error: e.error };
  if (codigoErp(error) || intentos >= MAX_INTENTOS_INESPERADOS)
    return { t: "rechazo", error: e.error, codigo: e.codigo };
  return { t: "red", error: e.error, respondio: true };
}
