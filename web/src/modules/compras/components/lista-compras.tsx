import { formatearBs } from "@/lib/format/moneda";
import { formatearFechaHora } from "@/lib/format/fecha";
import type { FilaCompra } from "../queries";

// Servidor: sin estado. El total solo llega con ver_costos; sin él no hay columna.
export function ListaCompras({ compras }: { compras: readonly FilaCompra[] }) {
  return (
    <ul
      aria-label="Compras"
      className="bg-card divide-y rounded-xl border shadow-[0_2px_5px_#34345a0d]"
    >
      {compras.map((c) => (
        <li
          key={c.id}
          className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[10rem_minmax(0,1fr)_8rem_9rem]"
        >
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatearFechaHora(c.fecha)}
          </span>
          <span className="min-w-0 truncate font-medium max-md:order-first">{c.proveedor}</span>
          <span className="text-sm">{c.condicion === "contado" ? "Contado" : "Crédito"}</span>
          {c.total !== null && (
            <span className="text-sm tabular-nums md:text-right">{formatearBs(c.total)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
