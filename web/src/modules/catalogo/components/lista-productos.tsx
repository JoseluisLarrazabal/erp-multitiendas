import Link from "next/link";
import { Package } from "lucide-react";
import { formatearBs } from "@/lib/format/moneda";
import { cn } from "@/lib/utils";
import { ETIQUETA_LISTA, pesoATexto, type Lista, type ProductoLista } from "../domain";

type Props = {
  productos: readonly ProductoLista[];
  // Ruta firmada de cada foto, por foto_path.
  fotos: Record<string, string>;
  puedeEditar: boolean;
  // La lista que se muestra como precio (contado o normal).
  listaPrincipal: Lista;
};

function Miniatura({ url }: { url?: string }) {
  return (
    <span className="bg-muted text-muted-foreground grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border">
      {url ? (
        // Decorativa: el nombre ya está en la fila. URL firmada con vencimiento: next/image no la cachea bien.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className="size-5" aria-hidden />
      )}
    </span>
  );
}

const etiqueta = "w-fit rounded-md px-2 py-0.5 text-xs font-semibold";

function Precio({ p, lista }: { p: ProductoLista; lista: Lista }) {
  if (!p.conPrecio) {
    return (
      <span className={cn(etiqueta, "bg-secondary text-secondary-foreground")}>Sin precio</span>
    );
  }
  // Tiene otras listas pero no la principal.
  if (p.montoPrincipal == null) {
    return (
      <span className={cn(etiqueta, "bg-secondary text-secondary-foreground")}>
        Sin precio de {ETIQUETA_LISTA[lista].toLowerCase()}
      </span>
    );
  }
  // En USD sin tipo de cambio no hay Bs que mostrar: nunca 0.
  const bs = p.principalBs ?? (p.monedaPrincipal === "BOB" ? p.montoPrincipal : null);
  if (bs == null)
    return <span className="text-muted-foreground text-xs">Falta tipo de cambio</span>;
  return <span className="font-semibold tabular-nums">{formatearBs(bs)}</span>;
}

const COLUMNAS = "md:grid-cols-[3rem_8rem_minmax(0,1fr)_10rem_10rem_9rem]";

export function ListaProductos({ productos, fotos, puedeEditar, listaPrincipal }: Props) {
  return (
    <div className="bg-card rounded-xl border shadow-[0_2px_5px_#34345a0d]">
      {/* Cabeceras solo de escritorio. Lectores de pantalla: cada celda lleva su rótulo oculto. */}
      <div
        aria-hidden
        className={cn(
          "text-muted-foreground hidden gap-x-3 border-b px-4 py-2 text-xs font-semibold md:grid",
          COLUMNAS,
        )}
      >
        <span />
        <span>Código</span>
        <span>Producto</span>
        <span>Marca</span>
        <span>Categoría</span>
        <span>Precio</span>
      </div>
      <ul className="divide-y" aria-label="Productos">
        {productos.map((p) => (
          <li
            key={p.id}
            className={cn(
              "grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3",
              COLUMNAS,
              !p.activo && "bg-muted/60",
            )}
          >
            <Miniatura url={p.fotoPath ? fotos[p.fotoPath] : undefined} />
            <span className="text-muted-foreground font-mono text-xs">
              <span className="sr-only">Código: </span>
              {p.codigo}
            </span>
            <span className="col-start-2 row-start-2 min-w-0 md:col-start-auto md:row-start-auto">
              {puedeEditar ? (
                <Link
                  href={`/panel/productos/${p.id}`}
                  className="focus-visible:ring-ring truncate rounded font-semibold outline-none hover:underline focus-visible:ring-3"
                >
                  {p.nombre}
                </Link>
              ) : (
                <span className="font-semibold">{p.nombre}</span>
              )}
              {p.pesoPaqueteKg !== null && (
                <span className="text-muted-foreground ml-2 text-xs">
                  Paquete de {pesoATexto(p.pesoPaqueteKg)} kg
                </span>
              )}
              {!p.activo && <span className="text-muted-foreground ml-2 text-xs">Inactivo</span>}
            </span>
            <span className="text-muted-foreground hidden truncate text-sm md:block">
              <span className="sr-only">Marca: </span>
              {p.marca ?? "—"}
            </span>
            <span className="text-muted-foreground hidden truncate text-sm md:block">
              <span className="sr-only">Categoría: </span>
              {p.categoria ?? "Sin categoría"}
            </span>
            <span className="col-start-3 row-span-2 row-start-1 justify-self-end md:col-start-auto md:row-span-1 md:row-start-auto">
              <span className="sr-only">Precio: </span>
              <Precio p={p} lista={listaPrincipal} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
