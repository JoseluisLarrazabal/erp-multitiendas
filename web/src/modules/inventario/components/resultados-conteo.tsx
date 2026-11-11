"use client";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import { PAGINA_CONTEO } from "../domain";
import type { FilaConteo } from "../queries";
import { ListaConteo, type Borrador } from "./lista-conteo";
import { PaginacionConteo } from "./paginacion-conteo";

// Página de productos del conteo con sus estados de error, carga y vacío (RNF: todo estado explícito).
export function ResultadosConteo({
  carga,
  hayBusqueda,
  pagina,
  borradores,
  malos,
  alEscribir,
  alCambiarPagina,
}: {
  carga: {
    cargando: boolean;
    error: string | null;
    datos: { filas: FilaConteo[]; total: number } | null;
  };
  hayBusqueda: boolean;
  pagina: number;
  borradores: Record<string, Borrador>;
  malos: ReadonlySet<string>;
  alEscribir: (producto: FilaConteo, texto: string) => void;
  alCambiarPagina: (pagina: number) => void;
}) {
  const { cargando, error, datos } = carga;
  const filas = datos?.filas ?? [];
  const paginas = Math.max(1, Math.ceil((datos?.total ?? 0) / PAGINA_CONTEO));
  return (
    <>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {cargando && (
        <p role="status" className="text-muted-foreground text-sm">
          Cargando productos…
        </p>
      )}
      {datos && filas.length === 0 && (
        <EstadoVacio>
          {hayBusqueda
            ? "Ningún producto coincide con la búsqueda."
            : "Aún no hay productos para contar."}
        </EstadoVacio>
      )}
      {filas.length > 0 && (
        <ListaConteo filas={filas} borradores={borradores} malos={malos} alEscribir={alEscribir} />
      )}
      {datos && datos.total > PAGINA_CONTEO && (
        <PaginacionConteo pagina={pagina} paginas={paginas} alCambiar={alCambiarPagina} />
      )}
    </>
  );
}
