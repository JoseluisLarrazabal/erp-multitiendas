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

// Fuera: el service worker (un redirect lo rompe), estáticos, imágenes y favicon.
export const config = {
  matcher: ["/((?!sw-pos/|_next/static|_next/image|favicon.ico).*)"],
};
