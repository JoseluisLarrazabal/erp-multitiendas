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
  leerSimulacion,
  type DetalleCredito,
  type PagoCuotaPayload,
  type Parametros,
  type Simulacion,
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

// Cuentas por cobrar paginadas en SQL: `total` son las unidades en total. La unidad es el cliente con todos sus créditos o, con
// `soloVencidas`, el crédito vencido. Con `clienteId`, los créditos de ese cliente (lo usa quien cobra en el POS), sin página.
export async function cargarCuentas(
  supabase: Cliente,
  negocioId: string,
  o: { clienteId?: string; soloVencidas?: boolean; limite?: number; desde?: number } = {},
): Promise<Resultado<{ cuentas: Cuenta[]; total: number }>> {
  try {
    const { data, error } = await supabase
      .rpc("cuentas_por_cobrar", {
        p_negocio_id: negocioId,
        ...(o.clienteId ? { p_cliente_id: o.clienteId } : {}),
        p_solo_vencidas: o.soloVencidas ?? false,
        p_limite: o.limite ?? 25,
        p_offset: o.desde ?? 0,
      })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    if (error) return errorRpc(error);
    const c = leerCuentas(data);
    return c ? { ok: true, data: c } : falla(ILEGIBLE);
  } catch {
    return falla(MENSAJE_RED, true);
  }
}

// Una página de clientes con saldo. Una página más allá de la última vuelve vacía y sin total (no hay filas que lo traigan): se
// relee la primera para saber cuántas hay y se devuelve la última válida. `pagina` es la que se muestra de verdad.
export async function cargarClientesConSaldo(
  supabase: Cliente,
  negocioId: string,
  pagina: number,
  porPagina: number,
): Promise<Resultado<{ cuentas: Cuenta[]; total: number; pagina: number }>> {
  const pedir = (p: number) =>
    cargarCuentas(supabase, negocioId, { limite: porPagina, desde: (p - 1) * porPagina });
  let actual = Math.max(1, pagina);
  let r = await pedir(actual);
  if (r.ok && r.data.cuentas.length === 0 && actual > 1) {
    const primera = await pedir(1);
    if (!primera.ok) return primera;
    actual = Math.max(1, Math.ceil(primera.data.total / porPagina));
    r = actual === 1 ? primera : await pedir(actual);
  }
  return r.ok ? { ok: true, data: { ...r.data, pagina: actual } } : r;
}

// Plan de una venta a crédito, calculado por el servidor con la misma regla que registrar_venta (totales y montos en Bs).
export async function simularCredito(
  supabase: Cliente,
  negocioId: string,
  o: { total: number; inicial: number | null; cuotas: number | null },
): Promise<Resultado<Simulacion>> {
  try {
    const { data, error } = await supabase
      .rpc("simular_credito", {
        p_negocio_id: negocioId,
        p_total: o.total,
        p_inicial: o.inicial ?? undefined,
        p_cuotas: o.cuotas ?? undefined,
      })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    if (error) return errorRpc(error);
    const r = leerSimulacion(data);
    return r ? { ok: true, data: r } : falla(ILEGIBLE);
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
