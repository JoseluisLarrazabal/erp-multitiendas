import Link from "next/link";
import { Package } from "lucide-react";
import { formatearBs } from "@/lib/format/moneda";
import { cn } from "@/lib/utils";
import type { ProductoLista } from "../domain";

type Props = {
  productos: readonly ProductoLista[];
  // Ruta firmada de cada foto, por foto_path.
  fotos: Record<string, string>;
  puedeEditar: boolean;
};

function Miniatura({ url, nombre }: { url?: string; nombre: string }) {
  return (
    <span className="bg-muted text-muted-foreground grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border">
      {url ? (
        // URL firmada de Storage con vencimiento: next/image no la optimiza ni la cachea bien.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Foto de ${nombre}`}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <Package className="size-5" aria-label="Sin foto" role="img" />
      )}
    </span>
  );
}

function Precio({ p }: { p: ProductoLista }) {
  if (!p.conPrecio) {
    return (
      <span className="bg-secondary text-secondary-foreground w-fit rounded-md px-2 py-0.5 text-xs font-semibold">
        Sin precio
      </span>
    );
  }
  // Con precio en USD y sin tipo de cambio, o sin lista principal: no hay Bs que mostrar, nunca 0.
  if (p.principalBs == null) {
    return <span className="text-muted-foreground text-xs">Falta tipo de cambio</span>;
  }
  return <span className="font-semibold tabular-nums">{formatearBs(p.principalBs)}</span>;
}

export function ListaProductos({ productos, fotos, puedeEditar }: Props) {
  return (
    <ul
      className="bg-card divide-y rounded-xl border shadow-[0_2px_5px_#34345a0d]"
      aria-label="Productos"
    >
      {productos.map((p) => (
        <li
          key={p.id}
          className={cn(
            "grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[auto_8rem_minmax(0,1fr)_10rem_10rem_9rem]",
            !p.activo && "bg-muted/60",
          )}
        >
          <Miniatura url={p.fotoPath ? fotos[p.fotoPath] : undefined} nombre={p.nombre} />
          <span className="text-muted-foreground font-mono text-xs md:order-none">{p.codigo}</span>
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
            {!p.activo && <span className="text-muted-foreground ml-2 text-xs">Inactivo</span>}
          </span>
          <span className="text-muted-foreground hidden truncate text-sm md:block">
            {p.marca ?? "—"}
          </span>
          <span className="text-muted-foreground hidden truncate text-sm md:block">
            {p.categoria ?? "Sin categoría"}
          </span>
          <span className="col-start-3 row-span-2 row-start-1 justify-self-end md:col-start-auto md:row-span-1 md:row-start-auto">
            <Precio p={p} />
          </span>
        </li>
      ))}
    </ul>
  );
}
