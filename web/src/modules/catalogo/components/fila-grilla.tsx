import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { formatearBs } from "@/lib/format/moneda";
import { cn } from "@/lib/utils";
import { ETIQUETA_LISTA, type FilaPrecios, type Lista, type Moneda } from "../domain";
import {
  bsDeUsd,
  celdasInvalidas,
  mensajeDeMontoInvalido,
  type Borrador,
  type Cambios,
} from "../grilla";

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

// ids para aria-describedby; descarta los que no aplican.
const descritoPor = (...ids: (string | false | null | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined;

// Una fila de la grilla. Los inputs llevan data-fila y data-celda: Enter baja a la fila siguiente, misma columna
// (use-teclado-grilla). Cada celda tiene id propio para enlazar su error y su equivalente en Bs con aria-describedby.
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
  const invalidas = celdasInvalidas(fila, borrador, listas);
  const sinTipoCambio = borrador.moneda === "USD" && tipoCambio === null;
  // Por qué el costo no se puede escribir o qué pasa si se escribe.
  const notaCosto =
    fila.tipo === "servicio"
      ? "Los servicios no tienen costo."
      : fila.costoVaria
        ? "Hay costos distintos por ubicación. Escribir uno los reemplaza a todos."
        : null;
  const idError = `fila-${fila.id}-error`;

  return (
    <tr
      className={cn("border-b", modificada && "bg-secondary/40", error && "bg-destructive-soft")}
      data-modificada={modificada || undefined}
    >
      <th
        scope="row"
        className={cn(
          celda,
          "bg-card sticky left-0 z-10 w-36 min-w-36 text-left font-normal md:w-48 md:min-w-48",
          modificada && "bg-secondary",
        )}
      >
        <span className="text-muted-foreground block truncate font-mono text-xs">
          {fila.codigo}
        </span>
        <span className="line-clamp-2 text-sm font-semibold md:line-clamp-none">{fila.nombre}</span>
        {modificada && <span className="text-primary text-xs font-medium">Modificada</span>}
        {error && (
          <span id={idError} role="alert" className="text-destructive block text-xs">
            {error}
          </span>
        )}
      </th>
      <td className={cn(celda, "w-24")}>
        <SelectNativo
          aria-label={`Moneda de ${fila.nombre}`}
          value={borrador.moneda}
          onChange={(e) => alCambiar({ moneda: e.target.value as Moneda })}
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
        const id = `celda-${fila.id}-${lista}`;
        return (
          <td key={lista} className={cn(celda, "w-28 min-w-28")}>
            <Input
              id={id}
              aria-label={`${ETIQUETA_LISTA[lista]} de ${fila.nombre}`}
              inputMode="decimal"
              autoComplete="off"
              value={texto}
              data-fila={indice}
              data-celda={lista}
              aria-invalid={malo ? true : undefined}
              aria-describedby={descritoPor(
                malo && `${id}-error`,
                bs !== null && `${id}-bs`,
                error && idError,
              )}
              onChange={(e) => alCambiar({ lista, texto: e.target.value })}
              className="cifra text-right md:text-[13px]"
            />
            {malo && (
              <span id={`${id}-error`} className="text-destructive mt-1 block text-xs">
                {mensajeDeMontoInvalido(texto)}
              </span>
            )}
            {bs !== null && (
              <span
                id={`${id}-bs`}
                className="text-muted-foreground mt-1 block text-right text-xs tabular-nums"
              >
                {formatearBs(bs)}
              </span>
            )}
          </td>
        );
      })}
      {verCostos && (
        // title en la celda: un input deshabilitado no recibe el puntero y no muestra el suyo.
        <td title={notaCosto ?? undefined} className={cn(celda, "w-28 min-w-28")}>
          <Input
            id={`celda-${fila.id}-costo`}
            aria-label={`Costo de ${fila.nombre}`}
            inputMode="decimal"
            autoComplete="off"
            value={borrador.costo}
            disabled={fila.tipo === "servicio"}
            placeholder={fila.costoVaria ? "Varía" : undefined}
            data-fila={indice}
            data-celda="costo"
            aria-invalid={invalidas.includes("costo") ? true : undefined}
            aria-describedby={descritoPor(
              invalidas.includes("costo") && `celda-${fila.id}-costo-error`,
              notaCosto && `celda-${fila.id}-costo-nota`,
              error && idError,
            )}
            onChange={(e) => alCambiar({ costo: e.target.value })}
            className="cifra text-right md:text-[13px]"
          />
          {invalidas.includes("costo") && (
            <span
              id={`celda-${fila.id}-costo-error`}
              className="text-destructive mt-1 block text-xs"
            >
              {mensajeDeMontoInvalido(borrador.costo)}
            </span>
          )}
          {notaCosto && (
            <span id={`celda-${fila.id}-costo-nota`} className="sr-only">
              {notaCosto}
            </span>
          )}
        </td>
      )}
    </tr>
  );
}
