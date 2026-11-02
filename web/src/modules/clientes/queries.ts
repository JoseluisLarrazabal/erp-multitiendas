import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { errorRpc } from "@/lib/erp-errores";
import type { Resultado } from "@/modules/usuarios";
import { limpiarBusqueda, normalizarDocumento, type ClienteElegido } from "./domain";
import { clienteRapidoSchema } from "./schemas";

type Cliente = SupabaseClient<Database>;

// Sin datos personales en errores ni logs: solo mensajes fijos.
export async function buscarClientes(
  supabase: Cliente,
  negocioId: string,
  texto: string,
): Promise<Resultado<ClienteElegido[]>> {
  const q = limpiarBusqueda(texto);
  if (q.length < 2) return { ok: true, data: [] };
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, ci_nit, telefono")
    .eq("negocio_id", negocioId)
    .or(`nombre.ilike.%${q}%,ci_nit.ilike.%${normalizarDocumento(q)}%`)
    .order("nombre")
    .limit(8);
  if (error) return { ok: false, error: "No se pudo buscar clientes." };
  return {
    ok: true,
    data: data.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      documento: c.ci_nit,
      telefono: c.telefono,
    })),
  };
}

export async function crearCliente(
  supabase: Cliente,
  negocioId: string,
  entrada: unknown,
): Promise<Resultado<ClienteElegido>> {
  const r = clienteRapidoSchema.safeParse(entrada);
  if (!r.success) return { ok: false, error: "Escribe al menos el nombre del cliente." };
  const { data, error } = await supabase.rpc("guardar_cliente", {
    p_negocio_id: negocioId,
    p_datos: r.data,
  });
  if (error) return errorRpc(error);
  return {
    ok: true,
    data: {
      id: data,
      nombre: r.data.nombre,
      documento: r.data.ci_nit ? normalizarDocumento(r.data.ci_nit) : null,
      telefono: r.data.telefono ?? null,
    },
  };
}
