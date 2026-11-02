"use client";

import { startTransition, useState, useTransition } from "react";
import { ERROR_CONEXION } from "@/lib/supabase/errores";
import type { Resultado } from "@/modules/usuarios";

export type { Resultado };

// Corre una server action, expone pendiente y el mensaje de error ya en español.
// Un rechazo (red caída, servidor no disponible) se muestra inline: nunca llega al error boundary.
export function useAccion() {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Cubre el hueco entre que `isPending` vuelve a false y se aplica el resultado diferido (p. ej. el diálogo sigue
  // abierto con el botón habilitado): sin esto un segundo clic repetiría la acción.
  const [enVuelo, setEnVuelo] = useState(false);

  function ejecutar(accion: () => Promise<Resultado<null>>, alExito?: () => void) {
    setError(null);
    setEnVuelo(true);
    iniciar(async () => {
      // Tras un await React pierde el contexto de la transición: sin este startTransition el aviso de éxito o error
      // se pinta antes de que `pendiente` vuelva a false y el botón sigue deshabilitado (un Enter ahí se pierde).
      try {
        const r = await accion();
        startTransition(() => {
          setEnVuelo(false);
          if (r.ok) alExito?.();
          else setError(r.error);
        });
      } catch {
        startTransition(() => {
          setEnVuelo(false);
          setError(ERROR_CONEXION);
        });
      }
    });
  }
  return { pendiente: pendiente || enVuelo, error, ejecutar, limpiar: () => setError(null) };
}
