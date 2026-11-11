import Link from "next/link";
import { Search } from "lucide-react";
import { BarraFiltros, CampoFiltro } from "@/components/ui/barra-filtros";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FiltrosStock } from "../schemas";
import { CampoBusquedaStock } from "./campo-busqueda-stock";
import { casilla } from "./casilla";

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
    <BarraFiltros
      key={`${filtros.q}|${filtros.bajo}`}
      method="get"
      action="/panel/inventario"
      role="search"
      aria-label="Buscar en el inventario"
    >
      <CampoFiltro className="min-w-60 flex-[2] sm:max-w-none">
        <Label htmlFor="stock-q">Buscar</Label>
        <CampoBusquedaStock defaultValue={filtros.q} />
      </CampoFiltro>
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
      <Button type="submit">
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
    </BarraFiltros>
  );
}
