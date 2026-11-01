"use client";

import { useCallback, useEffect, useRef } from "react";
import type { NotaVenta } from "./venta";

const finoPuntero = () => window.matchMedia("(pointer: fine)").matches;

// Con ratón o lector el foco vuelve a la búsqueda. En táctil va al título de la venta: no se abre el teclado a cada
// toque y el foco no queda en un botón que desaparece (el de "Agregar" o el de "Nueva venta").
export function useFocoVenta(nota: NotaVenta | null) {
  const campo = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const enfocarTrasAccion = useCallback(() => {
    if (finoPuntero()) campo.current?.focus();
    else titulo.current?.focus({ preventScroll: true });
  }, []);
  const veniaDeNota = useRef(false);
  useEffect(() => {
    if (nota) {
      veniaDeNota.current = true;
      return;
    }
    if (finoPuntero()) campo.current?.focus();
    else if (veniaDeNota.current) titulo.current?.focus();
    veniaDeNota.current = false;
  }, [nota]);
  return { campo, titulo, enfocarTrasAccion };
}
