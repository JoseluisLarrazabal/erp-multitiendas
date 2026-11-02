import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { errorRpc, esFalloDeRed, MENSAJE_RED } from "@/lib/erp-errores";
import type { Database } from "@/lib/supabase/database.types";
import { TIEMPO_ENVIO_MS } from "@/lib/supabase/sesion";
import { falla, type Resultado } from "@/modules/usuarios";

type Cliente = SupabaseClient<Database>;

export const ESTADOS_ACTIVOS = ["recibida", "en_lavado", "lista"] as const;
export type EstadoActivo = (typeof ESTADOS_ACTIVOS)[number];

export type OrdenActiva = {
  id: string;
  numero: string;
  total: number;
  cliente: string;
  prendas: number;
  casillero: string | null;
  fechaPrometida: string;
  estado: EstadoActivo;
  express: boolean;
};

// shortcut: tope de 200 filas sin paginar (una lavandería tiene pocas órdenes activas a la vez); paginar por cursor si
// el panel de /panel/ordenes no alcanza.
const MAXIMO_ORDENES = 200;

// Columnas explícitas: `huella` no tiene grant y un `*` fallaría.
export async function cargarOrdenesActivas(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<OrdenActiva[]>> {
  const { data, error } = await supabase
    .from("ordenes")
    .select(
      "id, cliente_nombre, prendas, casillero, fecha_prometida, estado, express, ventas(numero, total)",
    )
    .eq("negocio_id", negocioId)
    .in("estado", [...ESTADOS_ACTIVOS])
    .order("estado_en")
    .order("id")
    .limit(MAXIMO_ORDENES)
    .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
  if (error) {
    const red = esFalloDeRed(error);
    return falla(red ? MENSAJE_RED : "No se pudieron leer las órdenes.", red);
  }
  return {
    ok: true,
    data: data.flatMap((o) => {
      const v = Array.isArray(o.ventas) ? o.ventas[0] : o.ventas;
      return v
        ? [
            {
              id: o.id,
              numero: v.numero,
              total: Number(v.total),
              cliente: o.cliente_nombre,
              prendas: o.prendas,
              casillero: o.casillero,
              fechaPrometida: o.fecha_prometida,
              estado: o.estado as EstadoActivo,
              express: o.express,
            },
          ]
        : [];
    }),
  };
}

async function llamar(
  pedido: PromiseLike<{ data: unknown; error: Parameters<typeof errorRpc>[0] | null }>,
): Promise<Resultado<unknown>> {
  try {
    const { data, error } = await pedido;
    return error ? errorRpc(error) : { ok: true, data };
  } catch {
    return falla(MENSAJE_RED, true);
  }
}

export async function cambiarEstadoOrden(supabase: Cliente, id: string, estado: string) {
  return llamar(
    supabase
      .rpc("cambiar_estado_orden", { p_orden_id: id, p_estado: estado })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS)),
  );
}

export type Retiro = { quien: string; con: "boleta" | "carnet"; documento: string };

export async function entregarOrden(supabase: Cliente, id: string, r: Retiro) {
  return llamar(
    supabase
      .rpc("entregar_orden", {
        p_orden_id: id,
        p_retirada_por: r.quien,
        p_retiro_con: r.con,
        ...(r.con === "carnet" ? { p_documento: r.documento } : {}),
      })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS)),
  );
}

const anulacionSchema = z.object({ reembolso: z.boolean() });

// `reembolso`: la caja de la orden seguía abierta y el efectivo volvió a ella.
export async function anularOrden(
  supabase: Cliente,
  id: string,
  motivo: string,
): Promise<Resultado<{ reembolso: boolean }>> {
  const r = await llamar(
    supabase
      .rpc("anular_orden", { p_orden_id: id, p_motivo: motivo })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS)),
  );
  if (!r.ok) return r;
  const p = anulacionSchema.safeParse(r.data);
  return p.success
    ? { ok: true, data: p.data }
    : falla("La respuesta del servidor no se entendió.");
}
