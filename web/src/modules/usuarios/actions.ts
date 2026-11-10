"use server";

// Solo para el panel. No importar desde /pos: su bundle se precachea y un ID de server action es por build
// (lo impone ESLint en src/app/(pos), el service worker y los dos archivos de módulo que corren en /pos).
import { revalidatePath } from "next/cache";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { codigoDeMensaje, mensajeDeError, validar, type Resultado } from "./domain";
import {
  asignarUsuarioSchema,
  crearUsuarioSchema,
  estadoCuentaSchema,
  quitarUsuarioSchema,
  restablecerClaveSchema,
  registrarDispositivoSchema,
} from "./schemas";

const fallo = (codigo?: string): Resultado<never> => ({ ok: false, error: mensajeDeError(codigo) });

// Cuerpo { ok: false, error } de admin-usuarios; el SDK lo entrega dentro del error en respuestas no 2xx.
async function invocarAdmin(cuerpo: Record<string, unknown>): Promise<Resultado<null>> {
  const supabase = await createClient();
  const { error } = await supabase.functions.invoke("admin-usuarios", { body: cuerpo });
  if (!error) {
    revalidatePath("/panel/usuarios");
    return { ok: true, data: null };
  }
  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 401) return fallo("ERP_SIN_SESION");
    const resp = (await error.context.json().catch(() => null)) as { error?: string } | null;
    return fallo(resp?.error);
  }
  return fallo();
}

function resultadoRpc(error: { message: string } | null, ruta: string): Resultado<null> {
  if (error) return fallo(codigoDeMensaje(error.message));
  revalidatePath(ruta);
  return { ok: true, data: null };
}

export async function crearUsuario(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(crearUsuarioSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  return invocarAdmin({
    accion: "crear",
    negocio_id: d.negocioId,
    rol: d.rol,
    correo: d.correo,
    nombre: d.nombre,
    clave: d.clave,
  });
}

export async function asignarUsuario(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(asignarUsuarioSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_usuario", {
    p_negocio_id: d.negocioId,
    p_usuario_id: d.usuarioId,
    p_rol: d.rol,
  });
  return resultadoRpc(error, "/panel/usuarios");
}

export async function quitarUsuario(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(quitarUsuarioSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("quitar_usuario", {
    p_negocio_id: d.negocioId,
    p_usuario_id: d.usuarioId,
  });
  return resultadoRpc(error, "/panel/usuarios");
}

export async function desactivarUsuario(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(estadoCuentaSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  return invocarAdmin({ accion: "desactivar", usuario_id: d.usuarioId });
}

export async function reactivarUsuario(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(estadoCuentaSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  return invocarAdmin({ accion: "reactivar", usuario_id: d.usuarioId });
}

export async function restablecerClave(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(restablecerClaveSchema, entrada);
  if (!d) return fallo("ERP_CLAVE_DEBIL");
  return invocarAdmin({ accion: "restablecer_clave", usuario_id: d.usuarioId, clave: d.clave });
}

export async function registrarDispositivo(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(registrarDispositivoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_dispositivo", {
    p_negocio_id: d.negocioId,
    p_ubicacion_id: d.ubicacionId,
    p_nombre: d.nombre,
    p_prefijo: d.prefijo,
  });
  return resultadoRpc(error, "/panel/dispositivos");
}
