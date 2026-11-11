import Link from "next/link";
import { BarraFiltros, CampoFiltro } from "@/components/ui/barra-filtros";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { DIAS_SIN_MOVIMIENTO, etiquetaAgrupar, type DefReporte } from "../domain";
import { hrefReportes, rangosRapidos, type FiltrosReporte } from "../schemas";

const ATAJOS = [
  ["hoy", "Hoy"],
  ["mes", "Este mes"],
  ["anterior", "Mes anterior"],
] as const;

// GET puro: funciona sin JavaScript. Stock no depende de fechas; los demás reportes sí.
export function FiltrosReporteForm({
  filtros,
  def,
  tipo,
  hoy,
}: {
  filtros: FiltrosReporte;
  def: DefReporte;
  tipo: string;
  hoy: string;
}) {
  const esStock = def.id === "stock";
  const rangos = rangosRapidos(hoy);
  return (
    <div className="flex flex-col gap-3">
      <BarraFiltros
        key={JSON.stringify(filtros)}
        method="get"
        action="/panel/reportes"
        role="search"
        aria-label="Filtros del reporte"
      >
        <input type="hidden" name="r" value={filtros.r} />
        {/* Lo que este reporte no muestra se conserva, para que cambiar de reporte no pierda los filtros. */}
        {esStock && (
          <>
            <input type="hidden" name="desde" value={filtros.desde} />
            <input type="hidden" name="hasta" value={filtros.hasta} />
          </>
        )}
        {!def.agrupar && <input type="hidden" name="agrupar" value={filtros.agrupar} />}
        {!esStock && (
          <>
            <input type="hidden" name="filtro" value={filtros.filtro} />
            <input type="hidden" name="dias" value={filtros.dias} />
          </>
        )}
        {!esStock && (
          <>
            <CampoFiltro>
              <Label htmlFor="fr-desde">Desde</Label>
              <Input
                id="fr-desde"
                name="desde"
                type="date"
                defaultValue={filtros.desde}
                max={filtros.hasta}
              />
            </CampoFiltro>
            <CampoFiltro>
              <Label htmlFor="fr-hasta">Hasta</Label>
              <Input
                id="fr-hasta"
                name="hasta"
                type="date"
                defaultValue={filtros.hasta}
                min={filtros.desde}
              />
            </CampoFiltro>
          </>
        )}
        {def.agrupar && (
          <CampoFiltro>
            <Label htmlFor="fr-agrupar">Agrupar por</Label>
            <SelectNativo id="fr-agrupar" name="agrupar" defaultValue={filtros.agrupar}>
              {def.agrupar.map((a) => (
                <option key={a} value={a}>
                  {etiquetaAgrupar(a, tipo)}
                </option>
              ))}
            </SelectNativo>
          </CampoFiltro>
        )}
        {esStock && (
          <>
            <CampoFiltro>
              <Label htmlFor="fr-filtro">Mostrar</Label>
              <SelectNativo id="fr-filtro" name="filtro" defaultValue={filtros.filtro}>
                <option value="todo">Todo</option>
                <option value="bajo">Stock bajo</option>
                <option value="sin">Sin movimiento</option>
              </SelectNativo>
            </CampoFiltro>
            <CampoFiltro>
              <Label htmlFor="fr-dias">Sin salidas hace</Label>
              <SelectNativo id="fr-dias" name="dias" defaultValue={String(filtros.dias)}>
                {DIAS_SIN_MOVIMIENTO.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </SelectNativo>
            </CampoFiltro>
          </>
        )}
        <Button type="submit">Aplicar</Button>
      </BarraFiltros>
      {!esStock && (
        <nav aria-label="Atajos de fecha" className="flex flex-wrap items-center gap-2">
          {ATAJOS.map(([k, etiqueta]) => (
            <Link
              key={k}
              href={hrefReportes({ ...filtros, ...rangos[k] })}
              className={buttonVariants({ variant: "outline" })}
            >
              {etiqueta}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
