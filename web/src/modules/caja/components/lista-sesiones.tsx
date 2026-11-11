import Link from "next/link";
import { formatearFechaHora } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { bsONulo } from "../domain";
import type { FilaSesion } from "../lecturas-panel";

export function ListaSesiones({ sesiones }: { sesiones: readonly FilaSesion[] }) {
  return (
    <ul aria-label="Cajas" className="bg-card shadow-card divide-y rounded-xl border">
      {sesiones.map((s) => (
        <li key={s.id}>
          <Link
            href={`/panel/cajas/${s.id}`}
            className="hover:bg-muted/60 focus-visible:ring-ring grid gap-x-4 gap-y-1 px-4 py-3 text-sm outline-none focus-visible:ring-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_repeat(3,6.5rem)]"
          >
            <span className="font-semibold">{s.equipo}</span>
            <span className="text-muted-foreground tabular-nums">
              Abrió {formatearFechaHora(s.abiertaEn)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {s.cerradaEn ? `Cerró ${formatearFechaHora(s.cerradaEn)}` : "Abierta"}
            </span>
            <span className="tabular-nums md:text-right">
              <span className="text-muted-foreground md:sr-only">Esperado </span>
              {bsONulo(s.montoEsperado)}
            </span>
            <span className="tabular-nums md:text-right">
              <span className="text-muted-foreground md:sr-only">Contado </span>
              {bsONulo(s.montoContado)}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums md:text-right",
                s.diferencia !== null && s.diferencia !== 0 && "text-destructive",
              )}
            >
              <span className="text-muted-foreground font-normal md:sr-only">Diferencia </span>
              {bsONulo(s.diferencia)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
