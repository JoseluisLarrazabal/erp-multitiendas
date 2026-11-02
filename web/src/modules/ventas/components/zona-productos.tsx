"use client";

import type { Catalogo } from "../schemas";
import type { Lista, ProductoPos } from "../domain";
import { CampoBusqueda, ListaResultados } from "./buscador";

// Búsqueda y resultados del catálogo (a la izquierda del carrito).
export function ZonaProductos({
  catalogo,
  busqueda,
  alCambiarBusqueda,
  alEnter,
  campo,
  consulta,
  resultados,
  ubicacionId,
  tipoNegocio,
  lista,
  alAgregar,
}: {
  catalogo: Catalogo | null;
  busqueda: string;
  alCambiarBusqueda: (v: string) => void;
  alEnter: () => void;
  campo: React.RefObject<HTMLInputElement | null>;
  consulta: boolean;
  resultados: readonly ProductoPos[];
  ubicacionId: string;
  tipoNegocio: string;
  lista: Lista;
  alAgregar: (p: ProductoPos) => void;
}) {
  return (
    <section aria-label="Productos" className="flex min-w-0 flex-col gap-2">
      <CampoBusqueda
        valor={busqueda}
        alCambiar={alCambiarBusqueda}
        alEnter={alEnter}
        referencia={campo}
        modoConsulta={consulta}
      />
      {catalogo && busqueda.trim() === "" && (
        <p className="text-muted-foreground text-xs tabular-nums">
          {catalogo.productos.length} productos en el catálogo. Escanea o escribe para buscar.
        </p>
      )}
      {catalogo && resultados.length > 0 && (
        <ListaResultados
          productos={resultados}
          ubicaciones={catalogo.ubicaciones}
          ubicacionId={ubicacionId}
          consulta={consulta}
          tipoNegocio={tipoNegocio}
          lista={lista}
          alAgregar={alAgregar}
        />
      )}
      {catalogo && busqueda.trim() !== "" && resultados.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-sm">
          Sin resultados para &quot;{busqueda.trim()}&quot;.
        </p>
      )}
    </section>
  );
}
