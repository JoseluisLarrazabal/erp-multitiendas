import { Etiqueta } from "@/components/ui/etiqueta";
import { ETIQUETA_ESTADO } from "../domain-panel";

export function EstadoVenta({ estado }: { estado: string }) {
  return (
    <Etiqueta tono={estado === "anulada" ? "peligro" : "exito"}>
      {ETIQUETA_ESTADO[estado] ?? estado}
    </Etiqueta>
  );
}
