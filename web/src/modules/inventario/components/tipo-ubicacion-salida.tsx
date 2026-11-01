"use client";

import { SelectNativo } from "@/components/ui/select-nativo";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import { TIPOS_SALIDA, type TipoSalida, type Ubicacion } from "../domain";
import { SelectUbicacion } from "./select-ubicacion";

export function TipoUbicacionSalida({
  ubicaciones,
  tipo,
  ubicacionId,
  alCambiarTipo,
  alCambiarUbicacion,
  errores,
}: {
  ubicaciones: readonly Ubicacion[];
  tipo: TipoSalida;
  ubicacionId: string;
  alCambiarTipo: (tipo: TipoSalida) => void;
  alCambiarUbicacion: (id: string) => void;
  errores: Errores;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Campo id="sal-tipo" etiqueta="Tipo" error={errores["sal-tipo"]}>
        <SelectNativo
          id="sal-tipo"
          value={tipo}
          onChange={(e) => alCambiarTipo(e.target.value as TipoSalida)}
          {...propsCampo("sal-tipo", errores)}
        >
          {TIPOS_SALIDA.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </SelectNativo>
      </Campo>
      <Campo id="sal-ubicacion" etiqueta="Ubicación" error={errores["sal-ubicacion"]}>
        <SelectUbicacion
          ubicaciones={ubicaciones}
          id="sal-ubicacion"
          value={ubicacionId}
          onChange={(e) => alCambiarUbicacion(e.target.value)}
          {...propsCampo("sal-ubicacion", errores)}
        />
      </Campo>
    </div>
  );
}
