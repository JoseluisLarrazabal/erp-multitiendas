import Link from "next/link";
import { Search } from "lucide-react";
import { BarraFiltros, CampoFiltro } from "@/components/ui/barra-filtros";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import type { EquipoPanel } from "../lecturas-panel";
import type { FiltrosVentas } from "../schemas-panel";

// GET puro: funciona sin JavaScript.
export function FiltrosVentasForm({
  filtros,
  invalido,
  equipos,
}: {
  filtros: FiltrosVentas;
  invalido: boolean;
  equipos: readonly EquipoPanel[];
}) {
  const hayFiltros =
    invalido || filtros.q || filtros.estado || filtros.equipo || filtros.desde || filtros.hasta;
  return (
    <BarraFiltros
      key={JSON.stringify(filtros)}
      method="get"
      action="/panel/ventas"
      role="search"
      aria-label="Buscar ventas"
    >
      <CampoFiltro className="sm:max-w-48">
        <Label htmlFor="fv-q">Número</Label>
        <Input
          id="fv-q"
          name="q"
          type="search"
          defaultValue={filtros.q}
          placeholder="C1-000123"
          autoComplete="off"
        />
      </CampoFiltro>
      <CampoFiltro className="sm:max-w-44">
        <Label htmlFor="fv-estado">Estado</Label>
        <SelectNativo id="fv-estado" name="estado" defaultValue={filtros.estado}>
          <option value="">Todos</option>
          <option value="completada">Completada</option>
          <option value="anulada">Anulada</option>
        </SelectNativo>
      </CampoFiltro>
      <CampoFiltro className="sm:max-w-48">
        <Label htmlFor="fv-equipo">Equipo</Label>
        <SelectNativo id="fv-equipo" name="equipo" defaultValue={filtros.equipo}>
          <option value="">Todos</option>
          {equipos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre} ({e.prefijo})
            </option>
          ))}
        </SelectNativo>
      </CampoFiltro>
      <CampoFiltro className="sm:max-w-44">
        <Label htmlFor="fv-desde">Desde</Label>
        <Input id="fv-desde" name="desde" type="date" defaultValue={filtros.desde} />
      </CampoFiltro>
      <CampoFiltro className="sm:max-w-44">
        <Label htmlFor="fv-hasta">Hasta</Label>
        <Input id="fv-hasta" name="hasta" type="date" defaultValue={filtros.hasta} />
      </CampoFiltro>
      <Button type="submit">
        <Search aria-hidden /> Buscar
      </Button>
      {hayFiltros && (
        <Link
          href="/panel/ventas"
          className="text-primary min-h-10 content-center text-sm underline-offset-4 hover:underline"
        >
          Quitar filtros
        </Link>
      )}
    </BarraFiltros>
  );
}
