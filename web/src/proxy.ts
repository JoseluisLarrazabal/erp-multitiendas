import type { NextRequest } from "next/server";
import { actualizarSesion, redirigir } from "@/lib/supabase/proxy";

const esProtegida = (ruta: string) =>
  ["/panel", "/pos"].some((base) => ruta === base || ruta.startsWith(`${base}/`));

export async function proxy(request: NextRequest) {
  const { response, autenticado, transitorio } = await actualizarSesion(request);
  if (transitorio) return response;
  const ruta = request.nextUrl.pathname;
  if (!autenticado && esProtegida(ruta)) return redirigir(request, response, "/login");
  if (autenticado && ruta === "/login") return redirigir(request, response, "/");
  return response;
}

// Fuera: el service worker (un redirect lo rompe) y los archivos estáticos públicos (manifiestos, íconos, imágenes,
// favicon), para no hacer el round-trip de sesión de Supabase por cada uno.
export const config = {
  matcher: [
    "/((?!sw-pos/|icons/|pos\\.webmanifest|panel\\.webmanifest|_next/static|_next/image|favicon.ico).*)",
  ],
};
