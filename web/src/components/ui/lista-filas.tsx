import { cn } from "@/lib/utils";

// Lista con aspecto de tabla densa y semántica de lista (`<ul aria-label>`): las specs y los lectores de pantalla
// la encuentran por su nombre. Para datos tabulares puros con <table> real, usa `Tabla`.
// `columnas` es la plantilla de escritorio, con clase literal: "md:grid-cols-[3rem_8rem_minmax(0,1fr)_9rem]".
// `cabeceras` son los <span> de la fila de títulos (solo escritorio, oculta a lectores: cada celda lleva su rótulo sr-only).
export function ListaFilas({
  etiqueta,
  columnas,
  cabeceras,
  children,
}: {
  etiqueta: string;
  columnas: string;
  cabeceras?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      {cabeceras && (
        <div
          aria-hidden
          className={cn(
            "text-muted-foreground border-foreground hidden h-10 items-center gap-x-3 border-b-2 text-[13px] font-semibold md:grid",
            columnas,
          )}
        >
          {cabeceras}
        </div>
      )}
      <ul className="divide-y" aria-label={etiqueta}>
        {children}
      </ul>
    </div>
  );
}

// Una fila: en móvil se apila (reordénala con `order-*` y `col-*`), desde md toma `columnas` y 44 px de alto.
export function Fila({
  columnas,
  className,
  ...props
}: React.ComponentProps<"li"> & { columnas: string }) {
  return (
    <li
      className={cn(
        "hover:bg-surface grid items-center gap-x-3 gap-y-1 py-3 md:min-h-11 md:px-0 md:py-1.5",
        columnas,
        className,
      )}
      {...props}
    />
  );
}
