import Link from "next/link";
import { formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import { cn } from "@/lib/utils";
import type { EquipoPanel, FilaVenta } from "../lecturas-panel";
import { ETIQUETA_ESPECIAL } from "../domain-panel";
import { EstadoVenta } from "./estado-venta";

const COLUMNAS = "md:grid-cols-[8rem_9.5rem_minmax(0,1fr)_8rem_7rem]";

export function ListaVentas({
  ventas,
  equipos,
}: {
  ventas: readonly FilaVenta[];
  equipos: readonly EquipoPanel[];
}) {
  const equipo = (id: string) => {
    const e = equipos.find((x) => x.id === id);
    return e ? `${e.nombre} (${e.prefijo})` : "—";
  };
  return (
    <div className="bg-card shadow-card rounded-xl border">
      <div
        aria-hidden
        className={cn(
          "text-muted-foreground hidden gap-x-3 border-b px-4 py-2 text-xs font-semibold md:grid",
          COLUMNAS,
        )}
      >
        <span>Número</span>
        <span>Fecha</span>
        <span>Equipo</span>
        <span className="text-right">Total</span>
        <span>Estado</span>
      </div>
      <ul className="divide-y" aria-label="Ventas">
        {ventas.map((v) => (
          <li key={v.id}>
            <Link
              href={`/panel/ventas/${v.id}`}
              className={cn(
                "hover:bg-muted/60 focus-visible:ring-ring grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 outline-none focus-visible:ring-3",
                COLUMNAS,
              )}
            >
              <span className="font-mono text-sm font-semibold">{v.numero}</span>
              <span className="text-muted-foreground text-sm tabular-nums max-md:order-3">
                {formatearFechaHora(v.recibidaEn)}
              </span>
              <span className="min-w-0 truncate text-sm max-md:order-4">
                {equipo(v.dispositivoId)}
              </span>
              <span className="text-right font-semibold tabular-nums max-md:order-2">
                {formatearBs(v.total)}
              </span>
              <span className="flex flex-wrap gap-1.5 max-md:order-5 max-md:col-span-2">
                <EstadoVenta estado={v.estado} />
                {v.especial && (
                  <span className="border-border w-fit rounded-md border px-2 py-0.5 text-xs font-semibold">
                    {ETIQUETA_ESPECIAL[v.especial]}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
