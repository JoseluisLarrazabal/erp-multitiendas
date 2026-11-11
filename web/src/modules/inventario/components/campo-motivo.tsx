"use client";

import { Input } from "@/components/ui/input";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";

// Motivo de una operación, controlado. Obligatorio o no lo dice la etiqueta; el error lo pone el formulario.
export function CampoMotivo({
  id,
  etiqueta,
  ayuda,
  valor,
  alCambiar,
  errores = {},
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: string;
  alCambiar: (valor: string) => void;
  errores?: Errores;
}) {
  return (
    <Campo id={id} etiqueta={etiqueta} ayuda={ayuda} error={errores[id]}>
      <Input
        id={id}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        maxLength={200}
        autoComplete="off"
        {...propsCampo(id, errores, !!ayuda)}
      />
    </Campo>
  );
}
