import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { ESTADOS_ORDEN, ETIQUETA_ESTADO_ORDEN, type FiltrosOrdenes } from "../schemas-ordenes";

// GET puro: funciona sin JavaScript. Cambiar un filtro reinicia el cursor (no hay campo `desde`).
export function FiltrosOrdenesForm({
  filtros,
  invalido,
}: {
  filtros: FiltrosOrdenes;
  invalido: boolean;
}) {
  const hayFiltros = invalido || filtros.q || filtros.estado;
  return (
    <form
      key={JSON.stringify(filtros)}
      method="get"
      action="/panel/ordenes"
      role="search"
      aria-label="Buscar órdenes"
      className="flex flex-wrap items-end gap-x-4 gap-y-3"
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1.5 sm:max-w-64">
        <Label htmlFor="fo-q">Número o cliente</Label>
        <Input
          id="fo-q"
          name="q"
          type="search"
          defaultValue={filtros.q}
          placeholder="L1-000123 o nombre"
          autoComplete="off"
          className="h-10"
        />
      </div>
      <div className="flex min-w-40 flex-1 flex-col gap-1.5 sm:max-w-52">
        <Label htmlFor="fo-estado">Estado</Label>
        <SelectNativo id="fo-estado" name="estado" defaultValue={filtros.estado}>
          <option value="">Activas</option>
          {ESTADOS_ORDEN.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_ORDEN[e]}
            </option>
          ))}
          <option value="sin_recoger">Sin recoger (más de 30 días)</option>
        </SelectNativo>
      </div>
      <Button type="submit" className="h-10">
        <Search aria-hidden /> Buscar
      </Button>
      {hayFiltros && (
        <Link
          href="/panel/ordenes"
          className="text-primary min-h-10 content-center text-sm underline-offset-4 hover:underline"
        >
          Quitar filtros
        </Link>
      )}
    </form>
  );
}
