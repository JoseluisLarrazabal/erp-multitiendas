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
  fecha: string;
  proveedor: string;
  condicion: string;
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
  const [compras, proveedores] = await Promise.all([
    supabase
      .from("compras")
      .select("id, proveedor_id, fecha, condicion")
      .eq("negocio_id", negocioId)
      .order("fecha", { ascending: false })
      .order("id")
      .range(desde, desde + porPagina - 1),
    supabase.from("proveedores").select("id, nombre").eq("negocio_id", negocioId),
  ]);
  if (compras.error || proveedores.error) return falla;
  const totales = new Map<string, number>();
  if (verCostos) {
    const t = await supabase.rpc("totales_compras", {
      p_negocio_id: negocioId,
      p_compra_ids: compras.data.map((c) => c.id),
    });
    if (t.error) return falla;
    for (const f of t.data) totales.set(f.compra_id, f.total);
  }
  const nombres = new Map(proveedores.data.map((p) => [p.id, p.nombre]));
  return {
    ok: true,
    data: {
      total,
      pagina: actual,
      filas: compras.data.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        proveedor: nombres.get(c.proveedor_id) ?? "",
        condicion: c.condicion,
        total: verCostos ? (totales.get(c.id) ?? 0) : null,
      })),
    },
  };
}
