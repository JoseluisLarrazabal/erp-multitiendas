import type { SupabaseClient } from "@supabase/supabase-js";
import { errorRpc, MENSAJE_RED } from "@/lib/erp-errores";
import type { Database } from "@/lib/supabase/database.types";
import { TIEMPO_ENVIO_MS } from "@/lib/supabase/sesion";
import { falla, type Resultado } from "@/modules/usuarios";
import type { Cuenta } from "./domain";
import {
  leerCuentas,
  leerDetalle,
  leerParametros,
  type DetalleCredito,
  type PagoCuotaPayload,
  type Parametros,
} from "./schemas";

type Cliente = SupabaseClient<Database>;
const ILEGIBLE = "La respuesta del servidor no se entendió.";

// Lecturas y cobro de crédito. Todo va directo al servidor: el crédito nunca pasa por la cola offline.
export async function cargarParametros(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<Parametros>> {
  try {
    const { data, error } = await supabase
      .rpc("credito_parametros", { p_negocio_id: negocioId })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    if (error) return errorRpc(error);
    const p = leerParametros(data);
    return p ? { ok: true, data: p } : falla(ILEGIBLE);
  } catch {
    return falla(MENSAJE_RED, true);
  }
}

// Créditos activos con saldo; con `clienteId`, los de ese cliente (lo usa quien cobra en el POS).
export async function cargarCuentas(
  supabase: Cliente,
  negocioId: string,
  clienteId?: string,
): Promise<Resultado<Cuenta[]>> {
  try {
    const { data, error } = await supabase
      .rpc("cuentas_por_cobrar", {
        p_negocio_id: negocioId,
        ...(clienteId ? { p_cliente_id: clienteId } : {}),
      })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    if (error) return errorRpc(error);
    const c = leerCuentas(data);
    return c ? { ok: true, data: c } : falla(ILEGIBLE);
  } catch {
    return falla(MENSAJE_RED, true);
  }
}

// Un crédito por su id o por la venta que lo originó.
export async function cargarDetalle(
  supabase: Cliente,
  quien: { creditoId: string } | { ventaId: string },
): Promise<Resultado<DetalleCredito>> {
  try {
    const { data, error } = await supabase
      .rpc(
        "detalle_credito",
        "creditoId" in quien ? { p_credito_id: quien.creditoId } : { p_venta_id: quien.ventaId },
      )
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    if (error) return errorRpc(error);
    const d = leerDetalle(data);
    return d ? { ok: true, data: d } : falla(ILEGIBLE);
  } catch {
    return falla(MENSAJE_RED, true);
  }
}

// Idempotente por `payload.id`: repetir el mismo pago devuelve el original y no duplica nada.
export async function enviarPagoCuota(
  supabase: Cliente,
  payload: PagoCuotaPayload,
): Promise<Resultado<null>> {
  try {
    const { error } = await supabase
      .rpc("pagar_cuota", { p_pago: payload })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    return error ? errorRpc(error) : { ok: true, data: null };
  } catch {
    return falla(MENSAJE_RED, true);
  }
}

// ¿Quedó registrado el pago `operacionId`? Para saber qué pasó tras un cobro sin respuesta.
export async function existePagoCuota(
  supabase: Cliente,
  operacionId: string,
): Promise<Resultado<boolean>> {
  try {
    const { data, error } = await supabase
      .from("credito_pagos")
      .select("id")
      .eq("operacion_id", operacionId)
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    if (error) return errorRpc(error);
    return { ok: true, data: data.length > 0 };
  } catch {
    return falla(MENSAJE_RED, true);
  }
}
