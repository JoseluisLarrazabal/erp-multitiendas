import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Resultado } from "@/modules/usuarios";
import { limpiarBusqueda, normalizarDocumento } from "./domain";
import type { FiltrosClientes } from "./schemas";

type Cliente = SupabaseClient<Database>;

export type FilaCliente = {
  id: string;
  nombre: string;
  ci_nit: string | null;
  telefono: string | null;
  direccion: string | null;
};

// Sin datos personales en errores ni logs: solo mensajes fijos.
export async function listarClientes(
  supabase: Cliente,
  negocioId: string,
  f: FiltrosClientes,
  porPagina: number,
): Promise<Resultado<{ filas: FilaCliente[]; total: number; pagina: number }>> {
  const q = limpiarBusqueda(f.q);
  const filtrada = (soloConteo: boolean) => {
    let c = supabase
      .from("clientes")
      .select(
        "id, nombre, ci_nit, telefono, direccion",
        soloConteo ? { count: "exact", head: true } : undefined,
      )
      .eq("negocio_id", negocioId);
    if (q) c = c.or(`nombre.ilike.%${q}%,ci_nit.ilike.%${normalizarDocumento(q)}%`);
    return c;
  };
  const { count, error: errorConteo } = await filtrada(true);
  if (errorConteo) return { ok: false, error: "No se pudieron leer los clientes." };
  const total = count ?? 0;
  const pagina = Math.min(Math.max(1, f.pagina), Math.max(1, Math.ceil(total / porPagina)));
  if (total === 0) return { ok: true, data: { filas: [], total, pagina } };
  const desde = (pagina - 1) * porPagina;
  const { data, error } = await filtrada(false)
    .order("nombre")
    .order("id")
    .range(desde, desde + porPagina - 1);
  if (error) return { ok: false, error: "No se pudieron leer los clientes." };
  return { ok: true, data: { filas: data, total, pagina } };
}
