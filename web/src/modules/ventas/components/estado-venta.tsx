import { Etiqueta } from "@/components/ui/etiqueta";
import { ETIQUETA_ESTADO } from "../domain-panel";

// Verde solo para completada; reserva y otros estados intermedios van en marca.
const TONO: Record<string, "exito" | "peligro"> = { completada: "exito", anulada: "peligro" };

export function EstadoVenta({ estado }: { estado: string }) {
  return <Etiqueta tono={TONO[estado] ?? "marca"}>{ETIQUETA_ESTADO[estado] ?? estado}</Etiqueta>;
}
