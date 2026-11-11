import Link from "next/link";
import { Package } from "lucide-react";
import { formatearBs } from "@/lib/format/moneda";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
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
    <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border">
      {url ? (
        // Decorativa: el nombre ya está en la fila. URL firmada con vencimiento: next/image no la cachea bien.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className="size-4" aria-hidden />
      )}
    </span>
  );
}

function Precio({ p, lista }: { p: ProductoLista; lista: Lista }) {
  if (!p.conPrecio) {
    return <Etiqueta tono="aviso">Sin precio</Etiqueta>;
  }
  // Tiene otras listas pero no la principal.
  if (p.montoPrincipal == null) {
    return <Etiqueta tono="aviso">Sin precio de {ETIQUETA_LISTA[lista].toLowerCase()}</Etiqueta>;
  }
  // En USD sin tipo de cambio no hay Bs que mostrar: nunca 0.
  const bs = p.principalBs ?? (p.monedaPrincipal === "BOB" ? p.montoPrincipal : null);
  if (bs == null)
    return <span className="text-muted-foreground text-xs">Falta tipo de cambio</span>;
  return <span className="cifra text-[13px]">{formatearBs(bs)}</span>;
}

const COLUMNAS = "md:grid-cols-[3rem_8rem_minmax(0,1fr)_10rem_10rem_10rem]";

export function ListaProductos({ productos, fotos, puedeEditar, listaPrincipal }: Props) {
  return (
    <ListaFilas
      etiqueta="Productos"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span />
          <span>Código</span>
          <span>Producto</span>
          <span>Marca</span>
          <span>Categoría</span>
          <span className="text-right">Precio</span>
        </>
      }
    >
      {productos.map((p) => (
        <Fila key={p.id} columnas={`grid-cols-[auto_1fr_auto] ${COLUMNAS}`}>
          <Miniatura url={p.fotoPath ? fotos[p.fotoPath] : undefined} />
          <span className="text-muted-foreground font-mono text-xs">
            <span className="sr-only">Código: </span>
            {p.codigo}
          </span>
          <span className="col-start-2 row-start-2 min-w-0 md:col-start-auto md:row-start-auto">
            {puedeEditar ? (
              <Link
                href={`/panel/productos/${p.id}`}
                className="focus-visible:ring-ring inline-block max-w-full truncate rounded align-bottom font-semibold outline-none hover:underline focus-visible:ring-3"
              >
                {p.nombre}
              </Link>
            ) : (
              <span className="inline-block max-w-full truncate align-bottom font-semibold">
                {p.nombre}
              </span>
            )}
            {p.pesoPaqueteKg !== null && (
              <span className="text-muted-foreground ml-2 text-xs">
                Paquete de {pesoATexto(p.pesoPaqueteKg)} kg
              </span>
            )}
            {!p.activo && <Etiqueta className="ml-2 align-middle">Inactivo</Etiqueta>}
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
        </Fila>
      ))}
    </ListaFilas>
  );
}
