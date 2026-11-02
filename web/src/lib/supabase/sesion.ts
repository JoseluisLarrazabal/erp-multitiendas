import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const TIEMPO_ENVIO_MS = 8_000;

// "red": no se pudo saber (sin red o más de 8 s). "ninguna": no hay sesión, o Auth respondió que no vale.
export type SesionLeida = "red" | "ninguna" | { usuarioId: string };

export async function leerSesion(supabase: SupabaseClient<Database>): Promise<SesionLeida> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    const limite = new Promise<never>((_, no) => {
      reloj = setTimeout(() => no(new Error("sin respuesta")), TIEMPO_ENVIO_MS);
    });
    const { data, error } = await Promise.race([supabase.auth.getSession(), limite]);
    if (error) return isAuthRetryableFetchError(error) ? "red" : "ninguna";
    return data.session ? { usuarioId: data.session.user.id } : "ninguna";
  } catch {
    return "red";
  } finally {
    clearTimeout(reloj);
  }
}
