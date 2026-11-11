import { Etiqueta } from "@/components/ui/etiqueta";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { formatearBs } from "@/lib/format/moneda";
import { formatearFechaHora } from "@/lib/format/fecha";
import type { FilaCompra } from "../queries";
import { AnularCompra } from "./anular-compra";

const CON_TOTAL = "md:grid-cols-[10rem_minmax(0,1fr)_9rem_8rem_9rem]";
const SIN_TOTAL = "md:grid-cols-[10rem_minmax(0,1fr)_9rem_9rem]";

// Sin estado propio. El total solo llega con ver_costos; sin él no hay columna. "Anular compra" solo con `anular`.
export function ListaCompras({
  compras,
  puedeAnular,
}: {
  compras: readonly FilaCompra[];
  puedeAnular: boolean;
}) {
  const conTotal = compras.some((c) => c.total !== null);
  const columnas = conTotal ? CON_TOTAL : SIN_TOTAL;
  return (
    // El foco tras anular cae aquí (focoTrasExito): ListaFilas no deja ponerle id al <ul>.
    <div id="lista-compras" tabIndex={-1} className="outline-none">
      <ListaFilas
        etiqueta="Compras"
        columnas={columnas}
        cabeceras={
          <>
            <span>Fecha</span>
            <span>Proveedor</span>
            <span>Condición</span>
            {conTotal && <span className="text-right">Total</span>}
            <span />
          </>
        }
      >
        {compras.map((c) => (
          <Fila key={c.id} columnas={`grid-cols-[1fr_auto] ${columnas}`}>
            <span className="text-muted-foreground cifra text-[13px]">
              {formatearFechaHora(c.creadaEn)}
            </span>
            <span className="min-w-0 truncate font-semibold max-md:order-first">{c.proveedor}</span>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              {c.condicion === "contado" ? "Contado" : "Crédito"}
              {c.anulada && <Etiqueta tono="peligro">Anulada</Etiqueta>}
            </span>
            {c.total !== null && (
              <span className="cifra text-[13px] md:text-right">{formatearBs(c.total)}</span>
            )}
            {puedeAnular && !c.anulada && (
              <span className="max-md:col-span-2 md:justify-self-end">
                <AnularCompra compraId={c.id} proveedor={c.proveedor} />
              </span>
            )}
          </Fila>
        ))}
      </ListaFilas>
    </div>
  );
}
