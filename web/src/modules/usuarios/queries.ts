import type { SupabaseClient } from "@supabase/supabase-js";
import { esFalloDeRed, MENSAJE_RED } from "@/lib/erp-errores";
import type { Database } from "@/lib/supabase/database.types";
import {
  falla,
  type Dispositivo,
  type FilaUsuario,
  type NegocioUsuario,
  type PersonaExterna,
  type Resultado,
  type Ubicacion,
} from "./domain";

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
  if (error) {
    const red = esFalloDeRed(error);
    return falla(red ? MENSAJE_RED : "No se pudieron leer tus negocios.", red);
  }
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
  if (error) {
    const red = esFalloDeRed(error);
    return falla(red ? MENSAJE_RED : "No se pudieron leer tus permisos.", red);
  }
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

// shortcut: puede_administrar_cuenta y puede_restablecer_clave por fila (dos RPC por usuario). Aceptable con ~15 usuarios por negocio;
// pasar a una RPC por lote si un negocio supera ~50.
export async function listarUsuariosDelNegocio(
  supabase: Cliente,
  negocioId: string,
  miId: string,
): Promise<Resultado<FilaUsuario[]>> {
  const { data, error } = await supabase
    .from("usuario_negocio")
    .select("usuario_id, rol, perfiles!inner(nombre, activo)")
    .eq("negocio_id", negocioId)
    .order("created_at")
    .order("usuario_id");
  if (error) return { ok: false, error: "No se pudo leer el personal." };
  const filas = await Promise.all(
    data.map(async (f): Promise<FilaUsuario | null> => {
      const [{ data: puede, error: e }, { data: restablece, error: e2 }] = await Promise.all([
        supabase.rpc("puede_administrar_cuenta", { p_usuario_id: f.usuario_id }),
        supabase.rpc("puede_restablecer_clave", { p_usuario_id: f.usuario_id }),
      ]);
      if (e || e2) return null;
      return {
        usuarioId: f.usuario_id,
        nombre: f.perfiles.nombre,
        rol: f.rol,
        activo: f.perfiles.activo,
        esYo: f.usuario_id === miId,
        puedeAdministrar: puede === true,
        puedeRestablecer: restablece === true,
      };
    }),
  );
  if (filas.includes(null)) return { ok: false, error: "No se pudo leer el personal." };
  return { ok: true, data: filas.filter((f) => f !== null) };
}

// P-15: el personal se comparte. La RLS solo deja ver los negocios donde tengo `usuarios`,
// así que son personas que yo mismo puedo administrar en el otro negocio.
export async function listarPersonasDeOtrosNegocios(
  supabase: Cliente,
  negocioId: string,
  miId: string,
  yaEnNegocio: readonly string[],
): Promise<Resultado<PersonaExterna[]>> {
  const { data, error } = await supabase
    .from("usuario_negocio")
    .select("usuario_id, perfiles!inner(nombre, activo)")
    .neq("negocio_id", negocioId)
    .neq("usuario_id", miId)
    .order("usuario_id");
  if (error) return { ok: false, error: "No se pudieron leer las personas de tus otros negocios." };
  const vistos = new Set(yaEnNegocio);
  const personas: PersonaExterna[] = [];
  for (const f of data) {
    if (!f.perfiles.activo || vistos.has(f.usuario_id)) continue;
    vistos.add(f.usuario_id);
    personas.push({ usuarioId: f.usuario_id, nombre: f.perfiles.nombre });
  }
  personas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { ok: true, data: personas };
}

export async function rolesDelTipo(supabase: Cliente, tipo: string): Promise<Resultado<string[]>> {
  const { data, error } = await supabase
    .from("rol_permisos")
    .select("rol")
    .eq("tipo_negocio", tipo);
  if (error) return { ok: false, error: "No se pudieron leer los roles." };
  return { ok: true, data: [...new Set(data.map((f) => f.rol))] };
}

export async function listarUbicaciones(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<Ubicacion[]>> {
  const { data, error } = await supabase
    .from("ubicaciones")
    .select("id, nombre")
    .eq("negocio_id", negocioId)
    .order("nombre");
  if (error) return { ok: false, error: "No se pudieron leer las ubicaciones." };
  return { ok: true, data };
}

export async function listarDispositivos(
  supabase: Cliente,
  negocioId: string,
  ubicaciones: readonly Ubicacion[],
): Promise<Resultado<Dispositivo[]>> {
  const { data, error } = await supabase
    .from("dispositivos")
    .select("id, nombre, prefijo, ubicacion_id")
    .eq("negocio_id", negocioId)
    .order("prefijo");
  if (error) return { ok: false, error: "No se pudieron leer los dispositivos." };
  const nombres = new Map(ubicaciones.map((u) => [u.id, u.nombre]));
  return {
    ok: true,
    data: data.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      prefijo: d.prefijo,
      ubicacion: nombres.get(d.ubicacion_id) ?? "",
    })),
  };
}
