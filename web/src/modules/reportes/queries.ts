import type { SupabaseClient } from "@supabase/supabase-js";
import { errorRpc } from "@/lib/erp-errores";
import type { Database } from "@/lib/supabase/database.types";
import type { Resultado } from "@/modules/usuarios";
import type { DatosReporte } from "./domain";
import {
  respuestaCajaSchema,
  respuestaStockSchema,
  respuestaVentasSchema,
  type FiltrosReporte,
} from "./schemas";

type Cliente = SupabaseClient<Database>;

function mensaje(e: Parameters<typeof errorRpc>[0]): Resultado<never> {
  const r = errorRpc(e);
  if (r.codigo === "ERP_LOTE_GRANDE")
    return { ...r, error: "El reporte tiene demasiadas filas. Acota el rango de fechas." };
  if (r.codigo === "ERP_DATOS_INVALIDOS")
    return { ...r, error: "El rango de fechas o los filtros no son válidos." };
  return r;
}

const RESPUESTA_INVALIDA = "El servidor devolvió un reporte con un formato inesperado.";

// Las RPC devuelven { filas, totales } en un solo jsonb (una función que devuelve filas se truncaría en 1.000).
// Costo, ganancia y valor llegan null sin ver_costos: aquí no se decide nada de permisos.
export async function leerReporte(
  supabase: Cliente,
  negocioId: string,
  f: FiltrosReporte,
): Promise<Resultado<DatosReporte>> {
  if (f.r === "stock") {
    const { data, error } = await supabase.rpc("reporte_stock", {
      p_negocio_id: negocioId,
      p_dias_sin_movimiento: f.dias,
    });
    if (error) return mensaje(error);
    const d = respuestaStockSchema.safeParse(data);
    if (!d.success) return { ok: false, error: RESPUESTA_INVALIDA };
    return { ok: true, data: { tipo: "stock", ...d.data } };
  }
  if (f.r === "caja") {
    const { data, error } = await supabase.rpc("reporte_caja", {
      p_negocio_id: negocioId,
      p_desde: f.desde,
      p_hasta: f.hasta,
    });
    if (error) return mensaje(error);
    const d = respuestaCajaSchema.safeParse(data);
    if (!d.success) return { ok: false, error: RESPUESTA_INVALIDA };
    return { ok: true, data: { tipo: "caja", ...d.data } };
  }
  const { data, error } = await supabase.rpc("reporte_ventas", {
    p_negocio_id: negocioId,
    p_desde: f.desde,
    p_hasta: f.hasta,
    p_agrupar: f.r === "masvendidos" ? "producto" : f.agrupar,
  });
  if (error) return mensaje(error);
  const d = respuestaVentasSchema.safeParse(data);
  if (!d.success) return { ok: false, error: RESPUESTA_INVALIDA };
  return { ok: true, data: { tipo: "ventas", ...d.data } };
}
