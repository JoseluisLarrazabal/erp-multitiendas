import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esErrorTransitorio } from "@/lib/supabase/errores";
import {
  COOKIE_NEGOCIO,
  elegirNegocioActivo,
  tieneAccesoPanel,
  type NegocioUsuario,
} from "./domain";
import { listarMisNegocios, nombreDePerfil, permisosDeRol } from "./queries";

export type Contexto = {
  usuario: { id: string; correo: string; nombre: string };
  negocios: NegocioUsuario[];
  activo: NegocioUsuario | null;
  permisos: string[];
};

// Una vez por request. null = sin sesión. Con RLS: una cuenta desactivada con JWT vivo
// obtiene negocios vacíos y el resto de la app la manda a "Sin acceso".
export const obtenerContexto = cache(async (): Promise<Contexto | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  // Auth caído no es "sin sesión": que lo muestre error.tsx en vez de mandar al login.
  if (error && esErrorTransitorio(error)) throw new Error("No se pudo verificar la sesión.");
  const claims = data?.claims;
  if (!claims) return null;

  const lista = await listarMisNegocios(supabase, claims.sub);
  if (!lista.ok) throw new Error(lista.error);
  const preferido = (await cookies()).get(COOKIE_NEGOCIO)?.value;
  const activo = elegirNegocioActivo(lista.data, preferido);

  let permisos: string[] = [];
  if (activo) {
    const p = await permisosDeRol(supabase, activo.tipo, activo.rol);
    if (!p.ok) throw new Error(p.error);
    permisos = p.data;
  }
  const correo = typeof claims.email === "string" ? claims.email : "";
  const nombre = (await nombreDePerfil(supabase, claims.sub)) ?? correo;
  return { usuario: { id: claims.sub, correo, nombre }, negocios: lista.data, activo, permisos };
});

// Guarda de /panel. Se llama en el layout y al inicio de cada página: Next no re-ejecuta un layout conservado en peticiones RSC parciales.
export const exigirPanel = cache(async (): Promise<Contexto & { activo: NegocioUsuario }> => {
  const contexto = await obtenerContexto();
  if (!contexto) redirect("/login");
  if (!contexto.activo) redirect("/sin-acceso");
  // Chequeo en servidor; el proxy solo sabe si hay sesión, no qué permisos tiene.
  if (!tieneAccesoPanel(contexto.permisos)) redirect("/pos");
  return { ...contexto, activo: contexto.activo };
});

// Guarda de una página que exige un permiso concreto. Sin él, vuelve al inicio del panel.
export async function exigirPermiso(
  permiso: string,
): Promise<Contexto & { activo: NegocioUsuario }> {
  const contexto = await exigirPanel();
  if (!contexto.permisos.includes(permiso)) redirect("/panel");
  return contexto;
}
