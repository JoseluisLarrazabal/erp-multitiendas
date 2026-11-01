import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import type { Categoria, Filtros } from "../domain";

type Props = {
  ruta: string;
  filtros: Filtros;
  categorias?: readonly Categoria[];
  marcas?: readonly string[];
  // La grilla de precios no filtra por inactivos ni por categoría.
  conInactivos?: boolean;
};

const casilla =
  "accent-primary size-4 rounded border-input focus-visible:ring-ring/50 focus-visible:ring-3";

// GET puro: sin JavaScript. El lector de códigos USB escribe y pulsa Enter, que envía el formulario: la
// búsqueda arranca enfocada para que escanear funcione sin clic.
export function FiltrosBusqueda({ ruta, filtros, categorias, marcas, conInactivos }: Props) {
  const hayFiltros =
    filtros.q || filtros.categoria || filtros.marca || filtros.sinPrecio || filtros.inactivos;
  return (
    <form
      method="get"
      action={ruta}
      role="search"
      aria-label="Buscar productos"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="filtro-q">Buscar</Label>
          <Input
            id="filtro-q"
            name="q"
            type="search"
            defaultValue={filtros.q}
            placeholder="Código, código de barras o nombre"
            autoComplete="off"
            // El lector USB teclea en este campo sin clic previo (RF-CAT-03).
            autoFocus
            className="h-10"
          />
        </div>
        <Button type="submit" className="h-10 self-end">
          <Search aria-hidden />
          Buscar
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {categorias && (
          <div className="flex min-w-40 flex-1 flex-col gap-1.5 sm:max-w-56">
            <Label htmlFor="filtro-categoria">Categoría</Label>
            <SelectNativo id="filtro-categoria" name="categoria" defaultValue={filtros.categoria}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </SelectNativo>
          </div>
        )}
        {marcas && (
          <div className="flex min-w-40 flex-1 flex-col gap-1.5 sm:max-w-56">
            <Label htmlFor="filtro-marca">Marca</Label>
            <SelectNativo id="filtro-marca" name="marca" defaultValue={filtros.marca}>
              <option value="">Todas</option>
              {marcas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectNativo>
          </div>
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
        <Button type="submit" variant="outline" className="h-10">
          Aplicar filtros
        </Button>
        {hayFiltros && (
          <Link
            href={ruta}
            className="text-primary min-h-10 content-center text-sm underline-offset-4 hover:underline"
          >
            Quitar filtros
          </Link>
        )}
      </div>
    </form>
  );
}
