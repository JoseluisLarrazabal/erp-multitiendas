import Link from "next/link";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import type { FilaOrden } from "../lecturas-ordenes";
import { ETIQUETA_ESTADO_ORDEN } from "../schemas-ordenes";

const COLUMNAS = "md:grid-cols-[7.5rem_minmax(0,1fr)_4rem_6rem_5rem_6.5rem_9rem_6.5rem_6rem]";

// "2026-11-05" -> "05/11/2026": es un día de calendario, sin pasar por zonas horarias.
export const diaCalendario = (d: string) => d.split("-").reverse().join("/");

export function EstadoOrden({ estado }: { estado: string }) {
  return (
    <Etiqueta
      tono={estado === "cancelada" ? "peligro" : estado === "entregada" ? "exito" : "marca"}
    >
      {ETIQUETA_ESTADO_ORDEN[estado] ?? estado}
    </Etiqueta>
  );
}

export function ListaOrdenes({ ordenes }: { ordenes: readonly FilaOrden[] }) {
  return (
    <ListaFilas
      etiqueta="Órdenes"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span>Número</span>
          <span>Cliente</span>
          <span>Prendas</span>
          <span>Casillero</span>
          <span>Express</span>
          <span>Estado</span>
          <span>Desde</span>
          <span>Prometida</span>
          <span className="text-right">Total</span>
        </>
      }
    >
      {ordenes.map((o) => (
        <Fila key={o.id} columnas="" className="p-0 md:py-0">
          <Link
            href={`/panel/ordenes/${o.id}`}
            className={`focus-visible:ring-ring grid grid-cols-2 items-center gap-x-3 gap-y-1 py-3 text-sm outline-none focus-visible:ring-3 md:min-h-11 md:py-1.5 ${COLUMNAS}`}
          >
            <span className="font-mono text-[13px] font-semibold">{o.numero}</span>
            <span className="min-w-0 truncate">{o.cliente}</span>
            <span className="tabular-nums">
              <span className="text-muted-foreground md:hidden">Prendas: </span>
              {o.prendas}
            </span>
            <span>
              <span className="text-muted-foreground md:hidden">Casillero: </span>
              {o.casillero ?? "—"}
            </span>
            <span>{o.express ? <Etiqueta tono="aviso">Express</Etiqueta> : "—"}</span>
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
            <span className="cifra text-right text-[13px]">{formatearBs(o.total)}</span>
          </Link>
        </Fila>
      ))}
    </ListaFilas>
  );
}
