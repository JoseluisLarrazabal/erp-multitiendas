import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// Tope solo a lecturas (GET/HEAD): cortar una escritura o un RPC puede dejarla confirmada en la base mientras la
// pantalla muestra error. Sin tope, una lectura colgada deja "Cargando…" hasta el timeout de Node (~300 s).
export const TOPE_LECTURA_MS = 15_000;

export function fetchConTope(base: typeof fetch = fetch, topeMs = TOPE_LECTURA_MS): typeof fetch {
  return (input, init) => {
    const metodo = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (metodo !== "GET" && metodo !== "HEAD") return base(input, init);
    const tope = AbortSignal.timeout(topeMs); // sigue vivo durante la lectura del cuerpo
    const propia = init?.signal ?? (input instanceof Request ? input.signal : null);
    return base(input, { ...init, signal: propia ? AbortSignal.any([propia, tope]) : tope });
  };
}

// Para Server Components, server actions y route handlers. El proxy es quien refresca la sesión.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    global: { fetch: fetchConTope() },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Un Server Component no puede escribir cookies; el proxy ya refrescó la sesión.
        }
      },
    },
  });
}
