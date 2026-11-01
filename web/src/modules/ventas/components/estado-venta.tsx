import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO } from "../domain-panel";

export function EstadoVenta({ estado }: { estado: string }) {
  return (
    <span
      className={cn(
        "w-fit rounded-md px-2 py-0.5 text-xs font-semibold",
        estado === "anulada"
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {ETIQUETA_ESTADO[estado] ?? estado}
    </span>
  );
}
