"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

// El lector USB teclea sin clic previo: arranca enfocado, solo con puntero fino (en móvil abriría el teclado).
export function CampoBusquedaStock({ defaultValue }: { defaultValue: string }) {
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    campo.current?.focus();
    campo.current?.select();
  }, []);
  return (
    <Input
      ref={campo}
      id="stock-q"
      name="q"
      type="search"
      defaultValue={defaultValue}
      placeholder="Código, código de barras o nombre"
      autoComplete="off"
    />
  );
}
