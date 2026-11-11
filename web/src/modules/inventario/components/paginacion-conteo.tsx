"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginacionConteo({
  pagina,
  paginas,
  alCambiar,
}: {
  pagina: number;
  paginas: number;
  alCambiar: (pagina: number) => void;
}) {
  return (
    <nav aria-label="Paginación del conteo" className="flex items-center justify-between gap-3">
      <Button variant="outline" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>
        <ChevronLeft aria-hidden /> Anterior
      </Button>
      <span className="text-sm tabular-nums">
        Página {pagina} de {paginas}
      </span>
      <Button variant="outline" disabled={pagina >= paginas} onClick={() => alCambiar(pagina + 1)}>
        Siguiente <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
