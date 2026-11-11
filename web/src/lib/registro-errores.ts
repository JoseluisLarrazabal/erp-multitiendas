import { createClient } from "@/lib/supabase/browser";

export type OrigenError = "rpc" | "cola" | "accion" | "js";

// La base admite 60 filas por usuario y hora: con un minuto, un solo error en bucle agotaba el cupo y tapaba los demás.
const VENTANA_MS = 600_000;
const MAX_CLAVES = 50;
const vistos = new Map<string, number>();
// Mismo valor que COOKIE_NEGOCIO de modules/usuarios/domain.ts: `lib/` no puede importar de `modules/`.
const COOKIE_NEGOCIO = "negocio_activo";

// Registra un error inesperado en la base (RNF-16). Dispara y olvida: nunca lanza ni devuelve una promesa que pueda
// rechazar (un rechazo sin atrapar dispararía `unhandledrejection`, que volvería a llamar aquí: bucle).
export function registrarError(
  origen: OrigenError,
  codigo: string | null | undefined,
  mensaje: string,
  op?: string,
): void {
  try {
    if (typeof window === "undefined" || navigator.onLine === false) return;
    const ahora = Date.now();
    const clave = `${origen}|${codigo ?? ""}|${mensaje.replace(/\d+/g, "#")}`;
    const ultimo = vistos.get(clave);
    if (ultimo !== undefined && ahora - ultimo < VENTANA_MS) return;
    for (const [k, t] of vistos) if (ahora - t >= VENTANA_MS) vistos.delete(k);
    if (vistos.size >= MAX_CLAVES) vistos.delete(vistos.keys().next().value!);
    vistos.set(clave, ahora);

    const negocio = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NEGOCIO}=`))
      ?.slice(COOKIE_NEGOCIO.length + 1);
    // Solo la ruta: la query puede llevar búsquedas de clientes.
    const contexto = {
      op,
      ruta: location.pathname,
      build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    };
    void Promise.resolve(
      createClient().rpc("registrar_error", {
        p_origen: origen,
        // La RPC acepta null; los tipos generados lo marcan string.
        p_codigo: (codigo ?? null) as string,
        p_mensaje: mensaje,
        p_contexto: contexto,
        p_negocio_id: negocio || undefined,
      }),
    ).then(
      () => {},
      () => {},
    );
  } catch {
    // Registrar nunca debe romper al llamador.
  }
}
