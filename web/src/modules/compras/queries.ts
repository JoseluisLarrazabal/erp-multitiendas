import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Resultado } from "@/modules/usuarios";

type Cliente = SupabaseClient<Database>;

export type FilaProveedor = {
  id: string;
  nombre: string;
  contacto: string | null;
  activo: boolean;
  deuda: number;
};

export type FilaCompra = {
  id: string;
  creadaEn: string;
  proveedor: string;
  condicion: string;
  anulada: boolean;
  // null = sin ver_costos.
  total: number | null;
};

export async function listarProveedores(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<FilaProveedor[]>> {
  const [lista, deudas] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id, nombre, contacto, activo")
      .eq("negocio_id", negocioId)
      .order("nombre")
      .order("id"),
    supabase.rpc("deudas_proveedores", { p_negocio_id: negocioId }),
  ]);
  if (lista.error || deudas.error)
    return { ok: false, error: "No se pudieron leer los proveedores." };
  const deudaDe = new Map(deudas.data.map((d) => [d.proveedor_id, d.deuda]));
  return { ok: true, data: lista.data.map((p) => ({ ...p, deuda: deudaDe.get(p.id) ?? 0 })) };
}

// Cuántos proveedores tienen deuda y cuánto se les debe (solo la RPC de deudas; listarProveedores suma la lista).
export async function resumenDeudaProveedores(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<{ proveedores: number; total: number }>> {
  const { data, error } = await supabase.rpc("deudas_proveedores", { p_negocio_id: negocioId });
  if (error) return { ok: false, error: "No se pudo leer lo que se debe a proveedores." };
  const conDeuda = data.filter((d) => d.deuda > 0);
  return {
    ok: true,
    data: { proveedores: conDeuda.length, total: conDeuda.reduce((t, d) => t + d.deuda, 0) },
  };
}

export async function listarCompras(
  supabase: Cliente,
  negocioId: string,
  pagina: number,
  porPagina: number,
  verCostos: boolean,
): Promise<Resultado<{ filas: FilaCompra[]; total: number; pagina: number }>> {
  const falla = { ok: false, error: "No se pudieron leer las compras." } as const;
  const { count, error: errorConteo } = await supabase
    .from("compras")
    .select("id", { count: "exact", head: true })
    .eq("negocio_id", negocioId);
  if (errorConteo) return falla;
  const total = count ?? 0;
  const actual = Math.min(Math.max(1, pagina), Math.max(1, Math.ceil(total / porPagina)));
  if (total === 0) return { ok: true, data: { filas: [], total, pagina: actual } };
  const desde = (actual - 1) * porPagina;
  const compras = await supabase
    .from("compras")
    .select("id, created_at, condicion, proveedores(nombre)")
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false })
    .order("id")
    .range(desde, desde + porPagina - 1);
  if (compras.error) return falla;
  const ids = compras.data.map((c) => c.id);
  const anuladas = await supabase
    .from("compra_anulaciones")
    .select("compra_id")
    .in("compra_id", ids);
  if (anuladas.error) return falla;
  const anuladaIds = new Set(anuladas.data.map((a) => a.compra_id));
  const totales = new Map<string, number>();
  if (verCostos) {
    const t = await supabase.rpc("totales_compras", {
      p_negocio_id: negocioId,
      p_compra_ids: ids,
    });
    if (t.error) return falla;
    for (const f of t.data) totales.set(f.compra_id, f.total);
  }
  return {
    ok: true,
    data: {
      total,
      pagina: actual,
      filas: compras.data.map((c) => ({
        id: c.id,
        creadaEn: c.created_at,
        proveedor: c.proveedores?.nombre ?? "",
        condicion: c.condicion,
        anulada: anuladaIds.has(c.id),
        total: verCostos ? (totales.get(c.id) ?? 0) : null,
      })),
    },
  };
}
