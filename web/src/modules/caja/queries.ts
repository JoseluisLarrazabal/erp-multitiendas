import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { codigoErp, errorRpc } from "@/lib/erp-errores";
import type { Resultado } from "@/modules/usuarios";
import { sesionCajaSchema, type SesionCaja } from "./schemas";

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
