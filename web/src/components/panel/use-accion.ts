"use client";

import { useState, useTransition } from "react";
import { ERROR_CONEXION } from "@/lib/supabase/errores";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

// Corre una server action, expone pendiente y el mensaje de error ya en español.
// Un rechazo (red caída, servidor no disponible) se muestra inline: nunca llega al error boundary.
export function useAccion() {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(accion: () => Promise<Resultado<null>>, alExito?: () => void) {
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (r.ok) alExito?.();
        else setError(r.error);
      } catch {
        setError(ERROR_CONEXION);
      }
    });
  }
  return { pendiente, error, ejecutar, limpiar: () => setError(null) };
}
