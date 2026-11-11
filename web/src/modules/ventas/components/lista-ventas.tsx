import Link from "next/link";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { Etiqueta } from "@/components/ui/etiqueta";
import { formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import type { EquipoPanel, FilaVenta } from "../lecturas-panel";
import { ETIQUETA_ESPECIAL } from "../domain-panel";
import { EstadoVenta } from "./estado-venta";

const COLUMNAS = "md:grid-cols-[8rem_9.5rem_minmax(0,1fr)_8rem_12rem]";

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
    <ListaFilas
      etiqueta="Ventas"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span>Número</span>
          <span>Fecha</span>
          <span>Equipo</span>
          <span className="text-right md:pr-4">Total</span>
          <span>Estado</span>
        </>
      }
    >
      {ventas.map((v) => (
        <Fila key={v.id} columnas="" className="p-0 md:py-0">
          <Link
            href={`/panel/ventas/${v.id}`}
            className={`focus-visible:ring-ring grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3 outline-none focus-visible:ring-3 md:min-h-11 md:py-1.5 ${COLUMNAS}`}
          >
            <span className="font-mono text-[13px] font-semibold">{v.numero}</span>
            <span className="text-muted-foreground text-sm tabular-nums max-md:order-3">
              {formatearFechaHora(v.recibidaEn)}
            </span>
            <span className="min-w-0 truncate text-sm max-md:order-4">
              {equipo(v.dispositivoId)}
            </span>
            <span className="cifra text-right text-[13px] max-md:order-2 md:pr-4">
              {formatearBs(v.total)}
            </span>
            <span className="flex flex-wrap gap-1.5 max-md:order-5 max-md:col-span-2">
              <EstadoVenta estado={v.estado} />
              {v.especial && <Etiqueta tono="marca">{ETIQUETA_ESPECIAL[v.especial]}</Etiqueta>}
            </span>
          </Link>
        </Fila>
      ))}
    </ListaFilas>
  );
}
