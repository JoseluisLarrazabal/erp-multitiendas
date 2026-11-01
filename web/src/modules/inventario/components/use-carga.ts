"use client";

import { useEffect, useState } from "react";
import { ERROR_CONEXION } from "@/lib/supabase/errores";
import type { Resultado } from "@/components/panel/use-accion";

// Carga un dato del servidor cuando cambia `clave` (null = nada que cargar). Una respuesta de otra clave se descarta.
export function useCarga<T>(clave: string | null, cargar: () => Promise<Resultado<T>>) {
  const [estado, setEstado] = useState<{ clave: string; r: Resultado<T> } | null>(null);
  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    cargar()
      .catch((): Resultado<T> => ({ ok: false, error: ERROR_CONEXION }))
      .then((r) => vigente && setEstado({ clave, r }));
    return () => {
      vigente = false;
    };
    // `cargar` es una closure nueva en cada render; la clave ya resume lo que la hace cambiar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  const actual = clave !== null && estado?.clave === clave ? estado.r : null;
  return {
    cargando: clave !== null && actual === null,
    datos: actual?.ok ? actual.data : null,
    error: actual && !actual.ok ? actual.error : null,
  };
}
