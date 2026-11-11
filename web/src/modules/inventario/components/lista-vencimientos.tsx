import { formatearDia } from "@/lib/format/fecha";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { cn } from "@/lib/utils";
import { formatearCantidad, textoDias } from "../domain";
import type { LoteVencimiento } from "../queries";

const COLUMNAS = "md:grid-cols-[minmax(0,1fr)_7rem_9rem_7rem_11rem_8rem]";

// Lotes por vencer: solo lectura. El saldo es una estimación (la venta no elige lote).
export function ListaVencimientos({ lotes }: { lotes: readonly LoteVencimiento[] }) {
  return (
    <ListaFilas
      etiqueta="Lotes por vencer"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span>Producto</span>
          <span>Lote</span>
          <span>Entró en</span>
          <span>Vence</span>
          <span>Días</span>
          <span className="text-right">Saldo estimado</span>
        </>
      }
    >
      {lotes.map((l) => (
        <Fila key={l.loteId} columnas={`grid-cols-2 text-sm ${COLUMNAS}`}>
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
          <span className="text-[13px] tabular-nums">
            <span className="sr-only">Vence: </span>
            {formatearDia(l.vence)}
          </span>
          <span
            className={cn(
              "cifra text-right text-[13px] md:text-left",
              l.dias < 0 && "text-destructive font-semibold",
            )}
          >
            <span className="sr-only">Días: </span>
            {textoDias(l.dias)}
          </span>
          <span className="cifra col-span-2 text-[13px] font-semibold md:col-span-1 md:text-right">
            <span className="sr-only">Saldo estimado: </span>
            {formatearCantidad(l.saldo, l.unidad)}
            {l.unidad === "kg" && "\u00a0kg"}
          </span>
        </Fila>
      ))}
    </ListaFilas>
  );
}
