import Link from "next/link";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { formatearFechaHora } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { bsONulo, colorDiferencia } from "../domain";
import type { FilaSesion } from "../lecturas-panel";

const COLUMNAS = "md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_6.5rem_6.5rem_6.5rem]";

export function ListaSesiones({ sesiones }: { sesiones: readonly FilaSesion[] }) {
  return (
    <ListaFilas
      etiqueta="Cajas"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span>Equipo</span>
          <span>Apertura</span>
          <span>Cierre</span>
          <span className="text-right">Esperado</span>
          <span className="text-right">Contado</span>
          <span className="text-right">Diferencia</span>
        </>
      }
    >
      {sesiones.map((s) => (
        <Fila key={s.id} columnas="grid-cols-1" className="py-0 md:py-0">
          <Link
            href={`/panel/cajas/${s.id}`}
            className={cn(
              "focus-visible:ring-ring grid items-center gap-x-3 gap-y-1 rounded py-3 text-sm outline-none focus-visible:ring-3 md:min-h-11 md:py-1.5",
              COLUMNAS,
            )}
          >
            <span className="font-semibold">{s.equipo}</span>
            <span className="text-muted-foreground">Abrió {formatearFechaHora(s.abiertaEn)}</span>
            <span className="text-muted-foreground">
              {s.cerradaEn ? `Cerró ${formatearFechaHora(s.cerradaEn)}` : "Abierta"}
            </span>
            <span className="text-[13px] md:text-right">
              <span className="text-muted-foreground md:sr-only">Esperado </span>
              <span className="cifra">{bsONulo(s.montoEsperado)}</span>
            </span>
            <span className="text-[13px] md:text-right">
              <span className="text-muted-foreground md:sr-only">Contado </span>
              <span className="cifra">{bsONulo(s.montoContado)}</span>
            </span>
            <span className="text-[13px] md:text-right">
              <span className="text-muted-foreground md:sr-only">Diferencia </span>
              <span className={cn("cifra font-semibold", colorDiferencia(s.diferencia))}>
                {bsONulo(s.diferencia)}
              </span>
            </span>
          </Link>
        </Fila>
      ))}
    </ListaFilas>
  );
}
