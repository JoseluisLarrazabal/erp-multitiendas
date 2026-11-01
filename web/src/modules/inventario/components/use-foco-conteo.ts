"use client";

import { useEffect, useRef } from "react";
import type { FilaConteo } from "../queries";

// Foco del conteo con lector USB: tras buscar con un solo resultado va a su cantidad, y al salir de la revisión
// no queda en el vacío (vuelve al botón o al mensaje de éxito).
export function useFocoConteo(
  carga: { cargando: boolean; datos: { filas: FilaConteo[] } | null },
  revisando: boolean,
) {
  const alVolver = useRef<"cont-revisar" | "cont-exito" | null>(null);
  const tras = useRef(false);
  const filas = carga.datos?.filas;
  useEffect(() => {
    if (!tras.current || carga.cargando || !filas) return;
    tras.current = false;
    if (filas.length === 1) document.getElementById(`cont-cant-${filas[0]!.id}`)?.focus();
  }, [carga.cargando, filas]);
  useEffect(() => {
    if (revisando || !alVolver.current) return;
    document.getElementById(alVolver.current)?.focus();
    alVolver.current = null;
  }, [revisando]);
  return {
    trasBuscar: () => (tras.current = true),
    alSalirDeRevision: (id: "cont-revisar" | "cont-exito") => (alVolver.current = id),
  };
}
