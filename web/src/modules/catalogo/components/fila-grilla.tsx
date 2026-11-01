import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { formatearBs } from "@/lib/format/moneda";
import { cn } from "@/lib/utils";
import { ETIQUETA_LISTA, type FilaPrecios, type Lista, type Moneda } from "../domain";
import { bsDeUsd, celdasInvalidas, type Borrador, type Cambios } from "../grilla";

type Props = {
  fila: FilaPrecios;
  indice: number;
  listas: readonly Lista[];
  borrador: Borrador;
  cambios: Cambios;
  error?: string;
  tipoCambio: number | null;
  verCostos: boolean;
  alCambiar: (cambio: Partial<Borrador> & { lista?: string; texto?: string }) => void;
};

const celda = "px-2 py-2 align-top";

// Una fila de la grilla. Los inputs llevan data-fila y data-celda: Enter baja a la fila siguiente, misma columna.
export function FilaGrilla({
  fila,
  indice,
  listas,
  borrador,
  cambios,
  error,
  tipoCambio,
  verCostos,
  alCambiar,
}: Props) {
  const modificada = cambios.precios || cambios.costo;
  const invalidas = celdasInvalidas(borrador, listas);
  const sinTipoCambio = borrador.moneda === "USD" && tipoCambio === null;
  const esServicio = fila.tipo === "servicio";

  return (
    <tr
      className={cn("border-b", modificada && "bg-secondary/40", error && "bg-destructive/5")}
      data-modificada={modificada || undefined}
    >
      <th
        scope="row"
        className={cn(
          celda,
          "bg-card sticky left-0 z-10 w-56 min-w-56 text-left font-normal",
          modificada && "bg-secondary",
        )}
      >
        <span className="text-muted-foreground block font-mono text-xs">{fila.codigo}</span>
        <span className="block text-sm font-semibold">{fila.nombre}</span>
        {modificada && <span className="text-primary text-xs font-medium">Modificada</span>}
        {error && (
          <span role="alert" className="text-destructive block text-xs">
            {error}
          </span>
        )}
      </th>
      <td className={cn(celda, "w-28 min-w-28")}>
        <SelectNativo
          aria-label={`Moneda de ${fila.nombre}`}
          value={borrador.moneda}
          onChange={(e) => alCambiar({ moneda: e.target.value as Moneda })}
          className="h-9 md:text-sm"
        >
          <option value="BOB">Bs</option>
          <option value="USD">USD</option>
        </SelectNativo>
        {sinTipoCambio && (
          <span className="text-destructive mt-1 block text-xs">Falta tipo de cambio</span>
        )}
      </td>
      {listas.map((lista) => {
        const texto = borrador.precios[lista] ?? "";
        const malo = invalidas.includes(lista);
        const bs = borrador.moneda === "USD" ? bsDeUsd(texto, tipoCambio) : null;
        return (
          <td key={lista} className={cn(celda, "w-32 min-w-32")}>
            <Input
              aria-label={`${ETIQUETA_LISTA[lista]} de ${fila.nombre}`}
              inputMode="decimal"
              autoComplete="off"
              value={texto}
              data-fila={indice}
              data-celda={lista}
              aria-invalid={malo ? true : undefined}
              onChange={(e) => alCambiar({ lista, texto: e.target.value })}
              className="h-9 text-right tabular-nums md:text-sm"
            />
            {malo && <span className="text-destructive mt-1 block text-xs">Monto inválido</span>}
            {bs !== null && (
              <span className="text-muted-foreground mt-1 block text-right text-xs tabular-nums">
                {formatearBs(bs)}
              </span>
            )}
          </td>
        );
      })}
      {verCostos && (
        <td className={cn(celda, "w-32 min-w-32")}>
          <Input
            aria-label={`Costo de ${fila.nombre}`}
            inputMode="decimal"
            autoComplete="off"
            value={borrador.costo}
            disabled={esServicio}
            data-fila={indice}
            data-celda="costo"
            aria-invalid={invalidas.includes("costo") ? true : undefined}
            onChange={(e) => alCambiar({ costo: e.target.value })}
            className="h-9 text-right tabular-nums md:text-sm"
          />
          {invalidas.includes("costo") && (
            <span className="text-destructive mt-1 block text-xs">Monto inválido</span>
          )}
        </td>
      )}
    </tr>
  );
}
