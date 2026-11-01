import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { NegocioUsuario, Resultado } from "./domain";

// Reciben el cliente: sirven igual al servidor (cookies) y al POS estático (navegador). Lee la RLS.
type Cliente = SupabaseClient<Database>;

// negocios!inner descarta los negocios que la RLS no deja ver (cuenta desactivada con JWT vivo).
// El filtro por usuario_id es necesario: con el permiso `usuarios` la policy deja ver filas ajenas.
export async function listarMisNegocios(
  supabase: Cliente,
  usuarioId: string,
): Promise<Resultado<NegocioUsuario[]>> {
  const { data, error } = await supabase
    .from("usuario_negocio")
    .select("negocio_id, rol, negocios!inner(nombre, tipo)")
    .eq("usuario_id", usuarioId)
    .order("created_at")
    .order("negocio_id");
  if (error) return { ok: false, error: "No se pudieron leer tus negocios." };
  return {
    ok: true,
    data: data.map((f) => ({
      negocioId: f.negocio_id,
      nombre: f.negocios.nombre,
      tipo: f.negocios.tipo,
      rol: f.rol,
    })),
  };
}

export async function permisosDeRol(
  supabase: Cliente,
  tipo: string,
  rol: string,
): Promise<Resultado<string[]>> {
  const { data, error } = await supabase
    .from("rol_permisos")
    .select("permiso")
    .eq("tipo_negocio", tipo)
    .eq("rol", rol);
  if (error) return { ok: false, error: "No se pudieron leer tus permisos." };
  return { ok: true, data: data.map((f) => f.permiso) };
}

export async function nombreDePerfil(supabase: Cliente, usuarioId: string): Promise<string | null> {
  const { data } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", usuarioId)
    .maybeSingle();
  return data?.nombre ?? null;
}
