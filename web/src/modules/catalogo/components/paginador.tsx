import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  pagina: number;
  porPagina: number;
  total: number;
  hrefDe: (pagina: number) => string;
  // Palabra para el conteo: "productos".
  unidad?: string;
};

export function Paginador({ pagina, porPagina, total, hrefDe, unidad = "productos" }: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  const boton = cn(buttonVariants({ variant: "outline" }), "h-10");
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" role="status">
        {desde}–{hasta} de {total} {unidad}
      </p>
      <div className="flex items-center gap-2">
        {pagina > 1 ? (
          <Link href={hrefDe(pagina - 1)} className={boton}>
            <ChevronLeft aria-hidden /> Anterior
          </Link>
        ) : (
          <span aria-disabled className={cn(boton, "pointer-events-none opacity-50")}>
            <ChevronLeft aria-hidden /> Anterior
          </span>
        )}
        <span className="text-sm tabular-nums">
          Página {pagina} de {paginas}
        </span>
        {pagina < paginas ? (
          <Link href={hrefDe(pagina + 1)} className={boton}>
            Siguiente <ChevronRight aria-hidden />
          </Link>
        ) : (
          <span aria-disabled className={cn(boton, "pointer-events-none opacity-50")}>
            Siguiente <ChevronRight aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
