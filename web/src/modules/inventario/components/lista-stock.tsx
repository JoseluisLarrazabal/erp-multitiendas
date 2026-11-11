import Link from "next/link";
import { formatearBs } from "@/lib/format/moneda";
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
  const columnas = {
    gridTemplateColumns: `minmax(0,1fr) repeat(${ubicaciones.length}, 6.5rem) 8rem${verCostos ? " 8rem" : ""}`,
  };
  return (
    <div className="bg-card shadow-card rounded-xl border">
      <div
        aria-hidden
        style={columnas}
        className="text-muted-foreground hidden gap-x-3 border-b px-4 py-2 text-xs font-semibold md:grid"
      >
        <span>Producto</span>
        {ubicaciones.map((u) => (
          <span key={u.id} className="text-right">
            {u.nombre}
          </span>
        ))}
        <span className="text-right">Total</span>
        {verCostos && <span className="text-right">Valor</span>}
      </div>
      <ul className="divide-y" aria-label="Stock por producto">
        {filas.map((p) => (
          <li
            key={p.id}
            style={columnas}
            className={cn(
              "flex flex-col gap-1 px-4 py-3 md:grid md:items-center md:gap-x-3",
              !p.activo && "bg-muted/60",
            )}
          >
            <div className="min-w-0">
              <Link
                href={`/panel/inventario/${p.id}`}
                className="focus-visible:ring-ring rounded font-semibold outline-none hover:underline focus-visible:ring-3"
              >
                {p.nombre}
              </Link>
              <p className="text-muted-foreground text-xs">
                <span className="font-mono">{p.codigo}</span>
                {!p.activo && " · Inactivo"}
                {p.bajo && p.stockMinimo !== null && (
                  <strong className="text-foreground">
                    {" "}
                    · Stock bajo (mínimo {formatearCantidad(p.stockMinimo, p.unidad)})
                  </strong>
                )}
              </p>
            </div>
            {ubicaciones.map((u) => (
              <p key={u.id} className="flex justify-between gap-2 text-sm md:justify-end">
                <span className="text-muted-foreground md:sr-only">{u.nombre}</span>
                <CantidadStock valor={p.porUbicacion[u.id] ?? 0} unidad={p.unidad} />
              </p>
            ))}
            <p className="flex justify-between gap-2 text-sm font-semibold md:justify-end">
              <span className="text-muted-foreground font-normal md:sr-only">Total</span>
              <CantidadStock valor={p.total} unidad={p.unidad} />
            </p>
            {verCostos && (
              <p className="flex justify-between gap-2 text-sm md:justify-end">
                <span className="text-muted-foreground md:sr-only">Valor</span>
                <span className="tabular-nums">
                  {p.valor === null ? "—" : formatearBs(p.valor)}
                </span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
