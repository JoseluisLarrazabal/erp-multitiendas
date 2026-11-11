"use client";

import { Input } from "@/components/ui/input";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import type { Unidad } from "../domain";

// Cantidad de una operación, controlada. `inputMode` por defecto sale de la unidad (kg admite decimales).
export function CampoCantidad({
  id,
  unidad,
  ayuda,
  valor,
  alCambiar,
  errores,
  inputMode,
  className = "sm:max-w-64",
}: {
  id: string;
  unidad: Unidad | undefined;
  ayuda: string;
  valor: string;
  alCambiar: (valor: string) => void;
  errores: Errores;
  inputMode?: "text" | "decimal" | "numeric";
  className?: string;
}) {
  return (
    <Campo id={id} etiqueta="Cantidad" ayuda={ayuda} error={errores[id]}>
      <Input
        id={id}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        inputMode={inputMode ?? (unidad === "kg" ? "decimal" : "numeric")}
        autoComplete="off"
        className={className}
        {...propsCampo(id, errores, true)}
      />
    </Campo>
  );
}
