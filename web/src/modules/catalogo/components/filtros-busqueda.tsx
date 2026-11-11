import Link from "next/link";
import { Search } from "lucide-react";
import { BarraFiltros, CampoFiltro } from "@/components/ui/barra-filtros";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { hrefConFiltros, type Categoria, type Filtros } from "../domain";
import { CampoBusqueda } from "./campo-busqueda";

type Props = {
  ruta: string;
  filtros: Filtros;
  categorias?: readonly Categoria[];
  marcas?: readonly string[];
  // La grilla de precios no filtra por inactivos ni por categoría.
  conInactivos?: boolean;
  // Solo en Productos (escanear y buscar). En Precios el foco va a la grilla.
  enfocarBusqueda?: boolean;
};

const casilla =
  "accent-primary size-4 rounded border-input focus-visible:ring-ring focus-visible:ring-3";

// GET puro: sin JavaScript. El lector de códigos USB escribe y pulsa Enter, que envía el formulario.
export function FiltrosBusqueda({
  ruta,
  filtros,
  categorias,
  marcas,
  conInactivos,
  enfocarBusqueda = false,
}: Props) {
  const hayFiltros =
    filtros.q || filtros.categoria || filtros.marca || filtros.sinPrecio || filtros.inactivos;
  return (
    <BarraFiltros
      // Los selects y casillas no son controlados: la key los reinicia cuando cambian los filtros (p. ej. "Quitar filtros").
      key={hrefConFiltros("", filtros, { pagina: 1 })}
      method="get"
      action={ruta}
      role="search"
      aria-label="Buscar productos"
    >
      <CampoFiltro className="min-w-60 flex-[2] sm:max-w-none">
        <Label htmlFor="filtro-q">Buscar</Label>
        <CampoBusqueda defaultValue={filtros.q} enfocar={enfocarBusqueda} />
      </CampoFiltro>
      {categorias && (
        <CampoFiltro className="min-w-40 sm:max-w-56">
          <Label htmlFor="filtro-categoria">Categoría</Label>
          <SelectNativo id="filtro-categoria" name="categoria" defaultValue={filtros.categoria}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </SelectNativo>
        </CampoFiltro>
      )}
      {marcas && (
        <CampoFiltro className="min-w-40 sm:max-w-56">
          <Label htmlFor="filtro-marca">Marca</Label>
          <SelectNativo id="filtro-marca" name="marca" defaultValue={filtros.marca}>
            <option value="">Todas</option>
            {marcas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectNativo>
        </CampoFiltro>
      )}
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="sinPrecio"
          value="1"
          defaultChecked={filtros.sinPrecio}
          className={casilla}
        />
        Sin precio
      </label>
      {conInactivos && (
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="inactivos"
            value="1"
            defaultChecked={filtros.inactivos}
            className={casilla}
          />
          Incluir inactivos
        </label>
      )}
      <Button type="submit" className="max-sm:w-full">
        <Search aria-hidden />
        Buscar
      </Button>
      {hayFiltros && (
        <Link
          href={ruta}
          className="text-primary min-h-10 content-center text-sm underline-offset-4 hover:underline"
        >
          Quitar filtros
        </Link>
      )}
    </BarraFiltros>
  );
}
