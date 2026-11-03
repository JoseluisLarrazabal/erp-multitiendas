import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { cn } from "@/lib/utils";
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
      <form
        key={JSON.stringify(filtros)}
        method="get"
        action="/panel/reportes"
        role="search"
        aria-label="Filtros del reporte"
        className="flex flex-wrap items-end gap-x-4 gap-y-3"
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
            <div className="flex min-w-36 flex-1 flex-col gap-1.5 sm:max-w-44">
              <Label htmlFor="fr-desde">Desde</Label>
              <Input
                id="fr-desde"
                name="desde"
                type="date"
                defaultValue={filtros.desde}
                max={filtros.hasta}
                className="h-10"
              />
            </div>
            <div className="flex min-w-36 flex-1 flex-col gap-1.5 sm:max-w-44">
              <Label htmlFor="fr-hasta">Hasta</Label>
              <Input
                id="fr-hasta"
                name="hasta"
                type="date"
                defaultValue={filtros.hasta}
                min={filtros.desde}
                className="h-10"
              />
            </div>
          </>
        )}
        {def.agrupar && (
          <div className="flex min-w-36 flex-1 flex-col gap-1.5 sm:max-w-44">
            <Label htmlFor="fr-agrupar">Agrupar por</Label>
            <SelectNativo id="fr-agrupar" name="agrupar" defaultValue={filtros.agrupar}>
              {def.agrupar.map((a) => (
                <option key={a} value={a}>
                  {etiquetaAgrupar(a, tipo)}
                </option>
              ))}
            </SelectNativo>
          </div>
        )}
        {esStock && (
          <>
            <div className="flex min-w-36 flex-1 flex-col gap-1.5 sm:max-w-44">
              <Label htmlFor="fr-filtro">Mostrar</Label>
              <SelectNativo id="fr-filtro" name="filtro" defaultValue={filtros.filtro}>
                <option value="todo">Todo</option>
                <option value="bajo">Stock bajo</option>
                <option value="sin">Sin movimiento</option>
              </SelectNativo>
            </div>
            <div className="flex min-w-36 flex-1 flex-col gap-1.5 sm:max-w-44">
              <Label htmlFor="fr-dias">Sin salidas hace</Label>
              <SelectNativo id="fr-dias" name="dias" defaultValue={String(filtros.dias)}>
                {DIAS_SIN_MOVIMIENTO.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </SelectNativo>
            </div>
          </>
        )}
        <Button type="submit" className="h-10">
          Aplicar
        </Button>
      </form>
      {!esStock && (
        <nav aria-label="Atajos de fecha" className="flex flex-wrap items-center gap-2">
          {ATAJOS.map(([k, etiqueta]) => (
            <Link
              key={k}
              href={hrefReportes({ ...filtros, ...rangos[k] })}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "min-h-9 md:min-h-8",
              )}
            >
              {etiqueta}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
