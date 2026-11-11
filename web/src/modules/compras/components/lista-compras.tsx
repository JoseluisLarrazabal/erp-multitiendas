import { formatearBs } from "@/lib/format/moneda";
import { formatearFechaHora } from "@/lib/format/fecha";
import type { FilaCompra } from "../queries";
import { AnularCompra } from "./anular-compra";

// Sin estado propio. El total solo llega con ver_costos; sin él no hay columna. "Anular compra" solo con `anular`.
export function ListaCompras({
  compras,
  puedeAnular,
}: {
  compras: readonly FilaCompra[];
  puedeAnular: boolean;
}) {
  return (
    <ul
      id="lista-compras"
      tabIndex={-1}
      aria-label="Compras"
      className="bg-card shadow-card divide-y rounded-xl border"
    >
      {compras.map((c) => (
        <li
          key={c.id}
          className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[10rem_minmax(0,1fr)_8rem_9rem_9rem]"
        >
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatearFechaHora(c.creadaEn)}
          </span>
          <span className="min-w-0 truncate font-medium max-md:order-first">{c.proveedor}</span>
          <span className="text-sm">
            {c.condicion === "contado" ? "Contado" : "Crédito"}
            {c.anulada && <span className="text-destructive font-medium"> · Anulada</span>}
          </span>
          {c.total !== null && (
            <span className="text-sm tabular-nums md:text-right">{formatearBs(c.total)}</span>
          )}
          {puedeAnular && !c.anulada && (
            <span className="max-md:col-span-2 md:text-right">
              <AnularCompra compraId={c.id} proveedor={c.proveedor} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
