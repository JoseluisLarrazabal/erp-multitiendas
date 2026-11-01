"use client";

import { useEffect, useState } from "react";
import { ERROR_CONEXION } from "@/lib/supabase/errores";
import type { Resultado } from "@/components/panel/use-accion";

// Carga un dato del servidor cuando cambia `clave` (null = nada que cargar). Una respuesta de otra clave se descarta,
// y al volver a una clave anterior no se muestra el resultado viejo: se pide de nuevo. `recargar` repite la petición.
export function useCarga<T>(clave: string | null, cargar: () => Promise<Resultado<T>>) {
  const [estado, setEstado] = useState<Resultado<T> | null>(null);
  const [claveVista, setClaveVista] = useState(clave);
  const [intento, setIntento] = useState(0);
  // Ajuste durante el render (patrón de React): cada cambio de clave descarta lo guardado.
  if (claveVista !== clave) {
    setClaveVista(clave);
    setEstado(null);
  }
  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    cargar()
      .catch((): Resultado<T> => ({ ok: false, error: ERROR_CONEXION }))
      .then((r) => vigente && setEstado(r));
    return () => {
      vigente = false;
    };
    // `cargar` es una closure nueva en cada render; la clave y el intento ya resumen lo que la hace cambiar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);
  const actual = clave !== null ? estado : null;
  return {
    cargando: clave !== null && actual === null,
    datos: actual?.ok ? actual.data : null,
    error: actual && !actual.ok ? actual.error : null,
    recargar: () => {
      setEstado(null);
      setIntento((n) => n + 1);
    },
  };
}
