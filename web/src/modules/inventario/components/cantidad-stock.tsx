import { cn } from "@/lib/utils";
import { formatearCantidad, type Unidad } from "../domain";

// Una cantidad de stock. Cero sin ruido (las filas en 0 que crea fijar_costos no son un dato); negativo con texto,
// no solo con color (RN-04).
export function CantidadStock({ valor, unidad }: { valor: number; unidad: Unidad }) {
  if (valor === 0) return <span className="text-muted-foreground tabular-nums">0</span>;
  if (valor < 0) {
    return (
      <span className="text-destructive font-semibold tabular-nums">
        {formatearCantidad(valor, unidad)} <span className="text-xs font-medium">negativo</span>
      </span>
    );
  }
  return <span className={cn("tabular-nums")}>{formatearCantidad(valor, unidad)}</span>;
}
