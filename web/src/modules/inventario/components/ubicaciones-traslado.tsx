"use client";

import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import type { Ubicacion } from "../domain";
import { SelectUbicacion } from "./select-ubicacion";

export function UbicacionesTraslado({
  ubicaciones,
  origenId,
  destinoId,
  alCambiarOrigen,
  alCambiarDestino,
  errores,
}: {
  ubicaciones: readonly Ubicacion[];
  origenId: string;
  destinoId: string;
  alCambiarOrigen: (id: string) => void;
  alCambiarDestino: (id: string) => void;
  errores: Errores;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Campo id="tra-origen" etiqueta="Origen" error={errores["tra-origen"]}>
        <SelectUbicacion
          ubicaciones={ubicaciones}
          id="tra-origen"
          value={origenId}
          onChange={(e) => alCambiarOrigen(e.target.value)}
          {...propsCampo("tra-origen", errores)}
        />
      </Campo>
      <Campo id="tra-destino" etiqueta="Destino" error={errores["tra-destino"]}>
        <SelectUbicacion
          ubicaciones={ubicaciones}
          id="tra-destino"
          value={destinoId}
          onChange={(e) => alCambiarDestino(e.target.value)}
          {...propsCampo("tra-destino", errores)}
        />
      </Campo>
    </div>
  );
}
