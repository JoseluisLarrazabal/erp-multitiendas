import Link from "next/link";
import { formatearBs } from "@/lib/format/moneda";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { cn } from "@/lib/utils";
import { formatearCantidad, type FilaStock, type Ubicacion } from "../domain";
import { CantidadStock } from "./cantidad-stock";

// Producto | una columna por ubicación | total | valor (solo con ver_costos). Cabeceras solo de escritorio; en móvil
// cada fila rotula sus cantidades.
export function ListaStock({
  filas,
  ubicaciones,
  verCostos,
}: {
  filas: readonly FilaStock[];
  ubicaciones: readonly Ubicacion[];
  verCostos: boolean;
}) {
  const cols = {
    "--cols-stock": `minmax(0,1fr) repeat(${ubicaciones.length}, 6.5rem) 8rem${verCostos ? " 8rem" : ""}`,
  } as React.CSSProperties;
  return (
    <ListaFilas
      style={cols}
      etiqueta="Stock por producto"
      columnas="md:grid-cols-(--cols-stock)"
      cabeceras={
        <>
          <span>Producto</span>
          {ubicaciones.map((u) => (
            <span key={u.id} className="text-right">
              {u.nombre}
            </span>
          ))}
          <span className="text-right">Total</span>
          {verCostos && <span className="text-right">Valor</span>}
        </>
      }
    >
      {filas.map((p) => (
        <Fila
          key={p.id}
          columnas="flex flex-col items-stretch md:grid md:items-center md:grid-cols-(--cols-stock)"
          className={cn(!p.activo && "bg-muted/60")}
        >
          <div className="min-w-0">
            <Link
              href={`/panel/inventario/${p.id}`}
              className="focus-visible:ring-ring rounded font-semibold outline-none hover:underline focus-visible:ring-3"
            >
              {p.nombre}
            </Link>
            <p className="text-muted-foreground text-[13px]">
              <span className="font-mono">{p.codigo}</span>
              {!p.activo && " · Inactivo"}
              {p.bajo && p.stockMinimo !== null && (
                <strong className="text-warning">
                  {" "}
                  · Stock bajo (mínimo {formatearCantidad(p.stockMinimo, p.unidad)})
                </strong>
              )}
            </p>
          </div>
          {/* En celular: ubicaciones en una línea que envuelve y total y valor juntos; desde md, `contents` deja cada cifra en su columna. */}
          <div className="text-muted-foreground flex flex-wrap gap-x-3 md:contents">
            {ubicaciones.map((u) => (
              <p
                key={u.id}
                className="cifra flex gap-1.5 text-[13px] max-md:not-last:after:pl-1.5 max-md:not-last:after:content-['·'] md:justify-end"
              >
                <span className="text-muted-foreground md:sr-only">{u.nombre}</span>
                <CantidadStock valor={p.porUbicacion[u.id] ?? 0} unidad={p.unidad} />
              </p>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 md:contents">
            <p className="cifra flex gap-1.5 text-[13px] font-semibold md:justify-end">
              <span className="text-muted-foreground font-normal md:sr-only">Total</span>
              <CantidadStock valor={p.total} unidad={p.unidad} />
            </p>
            {verCostos && (
              <p className="cifra flex gap-1.5 text-[13px] max-md:font-semibold md:justify-end">
                <span className="text-muted-foreground font-normal md:sr-only">Valor</span>
                <span>{p.valor === null ? "—" : formatearBs(p.valor)}</span>
              </p>
            )}
          </div>
        </Fila>
      ))}
    </ListaFilas>
  );
}
