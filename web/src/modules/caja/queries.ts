import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { codigoErp, errorRpc, esFalloDeRed, MENSAJE_RED } from "@/lib/erp-errores";
import type { Resultado } from "@/modules/usuarios";
import type { Movimiento, TipoMovimiento } from "./domain";
import { cierreSchema, sesionCajaSchema, type Cierre, type SesionCaja } from "./schemas";

type Cliente = SupabaseClient<Database>;

// La sesión abierta del equipo, o null si no hay.
export async function cajaAbierta(
  supabase: Cliente,
  dispositivoId: string,
): Promise<Resultado<SesionCaja | null>> {
  const { data, error } = await supabase.rpc("caja_sesion_abierta", {
    p_dispositivo_id: dispositivoId,
  });
  if (error) return errorRpc(error);
  const fila = data[0];
  if (!fila) return { ok: true, data: null };
  const r = sesionCajaSchema.safeParse(fila);
  return r.success
    ? { ok: true, data: r.data }
    : { ok: false, error: "Respuesta de caja inesperada." };
}

// `id` lo genera el cliente una vez por intento: repetir la llamada no abre dos cajas. Tras abrir se confirma con
// caja_sesion_abierta (un replay de una sesión ya cerrada devuelve ese id y no hay caja abierta).
export async function abrirCaja(
  supabase: Cliente,
  datos: { id: string; negocioId: string; dispositivoId: string; montoInicial: number },
): Promise<Resultado<SesionCaja>> {
  const { error } = await supabase.rpc("abrir_caja", {
    p_id: datos.id,
    p_negocio_id: datos.negocioId,
    p_dispositivo_id: datos.dispositivoId,
    p_monto_inicial: datos.montoInicial,
  });
  if (error && codigoErp(error) !== "ERP_CAJA_ABIERTA") return errorRpc(error);
  const abierta = await cajaAbierta(supabase, datos.dispositivoId);
  if (!abierta.ok) return abierta;
  if (!abierta.data) return { ok: false, error: "La caja ya se cerró. Intenta abrirla de nuevo." };
  return { ok: true, data: abierta.data };
}

// `id` lo genera el cliente una vez por intento (reintentar tras un corte no duplica el movimiento).
export async function registrarMovimiento(
  supabase: Cliente,
  datos: { id: string; sesionId: string; tipo: TipoMovimiento; monto: number; motivo: string },
): Promise<Resultado<null>> {
  const { error } = await supabase.rpc("registrar_movimiento_caja", {
    p_id: datos.id,
    p_sesion_id: datos.sesionId,
    p_tipo: datos.tipo,
    p_monto: datos.monto,
    p_motivo: datos.motivo,
  });
  return error ? errorRpc(error) : { ok: true, data: null };
}

// Cierre con arqueo: el servidor calcula esperado, diferencia y QR. Repetir con el mismo contado devuelve lo guardado.
export async function cerrarSesion(
  supabase: Cliente,
  sesionId: string,
  montoContado: number,
): Promise<Resultado<Cierre>> {
  const { data, error } = await supabase.rpc("cerrar_caja", {
    p_sesion_id: sesionId,
    p_monto_contado: montoContado,
  });
  if (error) return errorRpc(error);
  const r = cierreSchema.safeParse(data);
  return r.success
    ? { ok: true, data: r.data }
    : { ok: false, error: "Respuesta de cierre inesperada." };
}

// Los `limite` movimientos más recientes (en orden cronológico) y el total. Con más que `limite` la lista está
// truncada: nunca se suma sobre ella (los totales salen de resumen_caja).
export const LIMITE_MOVIMIENTOS = 200;

export async function listarMovimientos(
  supabase: Cliente,
  sesionId: string,
  limite = LIMITE_MOVIMIENTOS,
): Promise<Resultado<{ movimientos: Movimiento[]; total: number }>> {
  const { data, error, count } = await supabase
    .from("caja_movimientos")
    .select("id, tipo, monto, motivo, created_at", { count: "exact" })
    .eq("sesion_id", sesionId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limite);
  if (error) {
    const red = esFalloDeRed(error);
    return { ok: false, red, error: red ? MENSAJE_RED : "No se pudieron leer los movimientos." };
  }
  return {
    ok: true,
    data: {
      total: count ?? data.length,
      movimientos: data.reverse().map((m) => ({
        id: m.id,
        tipo: m.tipo as TipoMovimiento,
        monto: Number(m.monto),
        motivo: m.motivo,
        creadoEn: m.created_at,
      })),
    },
  };
}
