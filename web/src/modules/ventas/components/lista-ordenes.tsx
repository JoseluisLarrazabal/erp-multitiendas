import Link from "next/link";
import { formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import { cn } from "@/lib/utils";
import type { FilaOrden } from "../lecturas-ordenes";
import { ETIQUETA_ESTADO_ORDEN } from "../schemas-ordenes";

const COLUMNAS = "md:grid-cols-[7.5rem_minmax(0,1fr)_4rem_6rem_5rem_6.5rem_9rem_6.5rem_6rem]";

// "2026-11-05" -> "05/11/2026": es un día de calendario, sin pasar por zonas horarias.
export const diaCalendario = (d: string) => d.split("-").reverse().join("/");

export function EstadoOrden({ estado }: { estado: string }) {
  return (
    <span
      className={cn(
        "w-fit rounded-md px-2 py-0.5 text-xs font-semibold",
        estado === "cancelada"
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {ETIQUETA_ESTADO_ORDEN[estado] ?? estado}
    </span>
  );
}

export function ListaOrdenes({ ordenes }: { ordenes: readonly FilaOrden[] }) {
  return (
    <div className="bg-card rounded-xl border shadow-[0_2px_5px_#34345a0d]">
      <div
        aria-hidden
        className={cn(
          "text-muted-foreground hidden gap-x-3 border-b px-4 py-2 text-xs font-semibold md:grid",
          COLUMNAS,
        )}
      >
        <span>Número</span>
        <span>Cliente</span>
        <span>Prendas</span>
        <span>Casillero</span>
        <span>Express</span>
        <span>Estado</span>
        <span>Desde</span>
        <span>Prometida</span>
        <span className="text-right">Total</span>
      </div>
      <ul className="divide-y" aria-label="Órdenes">
        {ordenes.map((o) => (
          <li key={o.id}>
            <Link
              href={`/panel/ordenes/${o.id}`}
              className={cn(
                "hover:bg-muted/60 focus-visible:ring-ring grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 text-sm outline-none focus-visible:ring-3",
                COLUMNAS,
              )}
            >
              <span className="font-mono font-semibold">{o.numero}</span>
              <span className="min-w-0 truncate">{o.cliente}</span>
              <span className="tabular-nums">
                <span className="text-muted-foreground md:hidden">Prendas: </span>
                {o.prendas}
              </span>
              <span>
                <span className="text-muted-foreground md:hidden">Casillero: </span>
                {o.casillero ?? "—"}
              </span>
              <span>{o.express ? "Express" : "—"}</span>
              <span>
                <EstadoOrden estado={o.estado} />
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatearFechaHora(o.estadoEn)}
              </span>
              <span className="tabular-nums">
                <span className="text-muted-foreground md:hidden">Prometida: </span>
                {diaCalendario(o.fechaPrometida)}
              </span>
              <span className="text-right font-semibold tabular-nums">{formatearBs(o.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
