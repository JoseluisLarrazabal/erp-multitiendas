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
// `guardadoEn`: último envío (ISO); sin él (entrada antigua) no hay espera antes de descartar.
export type CuotaPendiente = {
  payload: PagoCuotaPayload;
  cliente: string;
  detalle: string;
  guardadoEn?: string;
};

// Un cobro cuyo servidor aún pudo estar procesándolo no se descarta antes de este tiempo (igual que las ventas).
export const ESPERA_VERIFICAR_MS = 60_000;
export const MENSAJE_OTRA_CUOTA =
  "Hay otra cuota sin confirmar para este crédito en este equipo. Verifícala antes de cobrar.";
// Sin rastro en el servidor: ¿ya pasó la espera para poder descartar la entrada?
export const puedeDescartarCuota = (p: CuotaPendiente, ahora = Date.now()) =>
  !p.guardadoEn || ahora - Date.parse(p.guardadoEn) >= ESPERA_VERIFICAR_MS;

// Viven en localStorage (sobreviven a recargar y a que el sistema mate la app): no se pierde el payload, y reintentarlo con el MISMO id nunca cobra dos veces
// (pagar_cuota es idempotente por id). Cada lectura valida con el schema del payload.
// La clave no lleva usuario (como la de los cobros en línea): otro cajero del mismo equipo ve la cuota pendiente y no la
// repite, ni cierra la caja con ella sin confirmar. Otro equipo u otro negocio no ven ni se bloquean por lo de otro.
const CLAVE = "erp:cuotas-sin-confirmar";
export const alcanceCuotas = (negocioId: string, equipoId: string) =>
  `${CLAVE}:${negocioId}:${equipoId}`;

function leer(alcance: string): Record<string, CuotaPendiente> {
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(alcance) ?? "{}");
    if (typeof crudo !== "object" || crudo === null) return {};
    const salida: Record<string, CuotaPendiente> = {};
    for (const [creditoId, v] of Object.entries(crudo)) {
      const e = v as Partial<CuotaPendiente> | null;
      const p = pagoCuotaSchema.safeParse(e?.payload);
      if (p.success && typeof e?.cliente === "string" && typeof e.detalle === "string")
        salida[creditoId] = {
          payload: p.data,
          cliente: e.cliente,
          detalle: e.detalle,
          ...(typeof e.guardadoEn === "string" ? { guardadoEn: e.guardadoEn } : {}),
        };
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
// false si no se pudo escribir: el llamador NO debe enviar el cobro (no quedaría rastro tras una recarga). Otra pestaña del
// mismo equipo comparte esta clave: una entrada con otro id es de otro cobro, así que ni se pisa al escribir (false) ni se
// borra al quitar (`idBorrar`: el id que esta pestaña cree tener; si lo guardado es otro, no se toca).
export function fijarCuotaSinConfirmar(
  alcance: string,
  creditoId: string,
  p: CuotaPendiente | null,
  idBorrar?: string,
): boolean {
  const todas = leer(alcance);
  const guardado = todas[creditoId]?.payload.id;
  if (p) {
    if (guardado && guardado !== p.payload.id) return false;
    todas[creditoId] = p;
  } else {
    if (guardado !== idBorrar) return true;
    delete todas[creditoId];
  }
  try {
    localStorage.setItem(alcance, JSON.stringify(todas));
    return true;
  } catch {
    return false;
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

// ERP_OPERACION_REPETIDA: un intento anterior con ese id SÍ se registró (con otro monto): se trata como cobrado.
export const MENSAJE_CUOTA_REPETIDA =
  "Ya se registró un cobro con este intento por otro monto; revisa el saldo.";
export const esCuotaRepetida = (codigo: string | null | undefined) =>
  codigo === "ERP_OPERACION_REPETIDA";
