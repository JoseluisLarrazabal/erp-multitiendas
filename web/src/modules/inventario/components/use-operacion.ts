"use client";

import { useState } from "react";
import { useAccion, type Resultado } from "@/components/panel/use-accion";

// Idempotencia: el UUID nace al montar el formulario y viaja como p_operacion_id. Un reintento (mismo formulario,
// tras un error o un corte de red) conserva el id; tras un éxito nace uno nuevo. Con la acción en curso no se envía.
export function useOperacion() {
  const [operacionId, setOperacionId] = useState(() => crypto.randomUUID());
  const { pendiente, error, ejecutar, limpiar } = useAccion();

  function enviar(accion: (operacionId: string) => Promise<Resultado<null>>, alExito: () => void) {
    if (pendiente) return;
    ejecutar(
      () => accion(operacionId),
      () => {
        setOperacionId(crypto.randomUUID());
        alExito();
      },
    );
  }
  // Para quien confirma por su cuenta (diálogo) y debe renovar el id tras el éxito.
  const renovar = () => setOperacionId(crypto.randomUUID());
  return { operacionId, pendiente, error, enviar, limpiar, renovar };
}
