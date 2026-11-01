"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

// El lector USB teclea en este campo sin clic previo (RF-CAT-03), así que arranca enfocado. Solo con puntero
// fino: en un móvil o tableta el foco automático abre el teclado sin que nadie lo pida.
export function CampoBusqueda({
  defaultValue,
  enfocar,
}: {
  defaultValue: string;
  enfocar: boolean;
}) {
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (enfocar && window.matchMedia("(pointer: fine)").matches) campo.current?.focus();
  }, [enfocar]);
  return (
    <Input
      ref={campo}
      id="filtro-q"
      name="q"
      type="search"
      defaultValue={defaultValue}
      placeholder="Código, código de barras o nombre"
      autoComplete="off"
      className="h-10"
    />
  );
}
