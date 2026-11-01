import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FiltrosStock } from "../schemas";
import { CampoBusquedaStock } from "./campo-busqueda-stock";

const casilla =
  "accent-primary size-4 rounded border-input focus-visible:ring-ring/50 focus-visible:ring-3";

// GET puro, sin JavaScript. El lector USB teclea y pulsa Enter, que envía el formulario.
export function FiltrosStockForm({
  filtros,
  bajos,
}: {
  filtros: FiltrosStock;
  // Productos bajo el mínimo (productos_stock_bajo); null si no se pudo contar.
  bajos: number | null;
}) {
  return (
    <form
      key={`${filtros.q}|${filtros.bajo}`}
      method="get"
      action="/panel/inventario"
      role="search"
      aria-label="Buscar en el inventario"
      className="flex flex-wrap items-end gap-x-4 gap-y-3"
    >
      <div className="flex min-w-60 flex-[2] flex-col gap-1.5">
        <Label htmlFor="stock-q">Buscar</Label>
        <CampoBusquedaStock defaultValue={filtros.q} />
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="bajo"
          value="1"
          defaultChecked={filtros.bajo}
          className={casilla}
        />
        Stock bajo{bajos !== null && ` (${bajos})`}
      </label>
      <Button type="submit" className="h-10">
        <Search aria-hidden /> Buscar
      </Button>
      {(filtros.q || filtros.bajo) && (
        <Link
          href="/panel/inventario"
          className="text-primary min-h-10 content-center text-sm underline-offset-4 hover:underline"
        >
          Quitar filtros
        </Link>
      )}
    </form>
  );
}
