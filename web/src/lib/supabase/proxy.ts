import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";
import { esErrorTransitorio } from "./errores";

// Refresca la sesión y devuelve la respuesta que lleva las cookies nuevas.
// getClaims valida el JWT; nunca getSession para decidir en el servidor.
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  // Auth caído o sin red no es "sin sesión": no se redirige a nadie por eso.
  return {
    response,
    autenticado: data?.claims != null,
    transitorio: error !== null && esErrorTransitorio(error),
  };
}

// Una redirección conserva las cookies que el refresco dejó en `origen`.
export function redirigir(request: NextRequest, origen: NextResponse, ruta: string) {
  const destino = NextResponse.redirect(new URL(ruta, request.url));
  origen.cookies.getAll().forEach((c) => destino.cookies.set(c));
  origen.headers.forEach((valor, clave) => {
    if (clave === "cache-control") destino.headers.set(clave, valor);
  });
  return destino;
}
