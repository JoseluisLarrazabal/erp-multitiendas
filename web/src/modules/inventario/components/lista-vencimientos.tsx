import { formatearDia } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { formatearCantidad, textoDias } from "../domain";
import type { LoteVencimiento } from "../queries";

const COLUMNAS = "md:grid-cols-[minmax(0,1fr)_7rem_9rem_7rem_11rem_8rem]";

// Lotes por vencer: solo lectura. El saldo es una estimación (la venta no elige lote).
export function ListaVencimientos({ lotes }: { lotes: readonly LoteVencimiento[] }) {
  return (
    <div className="bg-card rounded-xl border shadow-[0_2px_5px_#34345a0d]">
      <div
        aria-hidden
        className={cn(
          "text-muted-foreground hidden gap-x-3 border-b px-4 py-2 text-xs font-semibold md:grid",
          COLUMNAS,
        )}
      >
        <span>Producto</span>
        <span>Lote</span>
        <span>Entró en</span>
        <span>Vence</span>
        <span>Días</span>
        <span className="text-right">Saldo estimado</span>
      </div>
      <ul className="divide-y" aria-label="Lotes por vencer">
        {lotes.map((l) => (
          <li
            key={l.loteId}
            className={cn(
              "grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm md:items-center",
              COLUMNAS,
            )}
          >
            <span className="col-span-2 min-w-0 font-semibold break-words md:col-span-1">
              <span className="sr-only">Producto: </span>
              {l.productoNombre}
              <span className="text-muted-foreground ml-2 font-mono text-xs font-normal">
                {l.productoCodigo}
              </span>
            </span>
            <span className="min-w-0 font-mono text-xs break-all">
              <span className="sr-only">Lote: </span>
              {l.codigo}
            </span>
            <span className="text-muted-foreground min-w-0 text-right break-words md:text-left">
              <span className="sr-only">Entró en: </span>
              {l.ubicacion}
            </span>
            <span className="tabular-nums">
              <span className="sr-only">Vence: </span>
              {formatearDia(l.vence)}
            </span>
            <span
              className={cn(
                "text-right tabular-nums md:text-left",
                l.dias < 0 && "text-destructive font-semibold",
              )}
            >
              <span className="sr-only">Días: </span>
              {textoDias(l.dias)}
            </span>
            <span className="col-span-2 font-semibold tabular-nums md:col-span-1 md:text-right">
              <span className="sr-only">Saldo estimado: </span>
              {formatearCantidad(l.saldo, l.unidad)}
              {l.unidad === "kg" && "\u00a0kg"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
