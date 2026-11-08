"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import { lineaCentavos } from "../domain";
import { formatearBs } from "@/lib/format/moneda";
import type { ProductoElegible } from "@/modules/inventario";
import { SelectorProducto } from "@/modules/inventario/panel-cliente";

export type ItemCompra = {
  clave: number;
  producto: ProductoElegible | null;
  cantidad: string;
  costo: string;
};

// Una línea de la compra: producto, cantidad y costo unitario. Los ids dependen de la clave para que haya varias.
export function FilaCompra({
  negocioId,
  item,
  errores,
  puedeQuitar,
  alCambiar,
  alQuitar,
}: {
  negocioId: string;
  item: ItemCompra;
  errores: Errores;
  puedeQuitar: boolean;
  alCambiar: (cambio: Partial<ItemCompra>) => void;
  alQuitar: () => void;
}) {
  const id = `cmp-${item.clave}`;
  const linea = lineaCentavos(item.cantidad, item.costo);
  return (
    <div className="grid gap-4 rounded-lg border p-3 md:grid-cols-[minmax(0,2fr)_8rem_9rem_auto] md:items-start">
      <SelectorProducto
        negocioId={negocioId}
        id={`${id}-producto`}
        valor={item.producto}
        alElegir={(producto) => alCambiar({ producto })}
        idSiguiente={`${id}-cantidad`}
        error={errores[`${id}-producto`]}
      />
      <Campo id={`${id}-cantidad`} etiqueta="Cantidad" error={errores[`${id}-cantidad`]}>
        <Input
          id={`${id}-cantidad`}
          inputMode="decimal"
          autoComplete="off"
          className="h-10"
          value={item.cantidad}
          onChange={(e) => alCambiar({ cantidad: e.target.value })}
          {...propsCampo(`${id}-cantidad`, errores)}
        />
      </Campo>
      <Campo
        id={`${id}-costo`}
        etiqueta="Costo unitario (Bs)"
        ayuda={linea === null ? undefined : `Línea: ${formatearBs(linea / 100)}`}
        error={errores[`${id}-costo`]}
      >
        <Input
          id={`${id}-costo`}
          inputMode="decimal"
          autoComplete="off"
          className="h-10"
          value={item.costo}
          onChange={(e) => alCambiar({ costo: e.target.value })}
          {...propsCampo(`${id}-costo`, errores, true)}
        />
      </Campo>
      {puedeQuitar && (
        <Button
          type="button"
          variant="outline"
          className="h-10 md:mt-[1.65rem]"
          aria-label="Quitar línea"
          onClick={alQuitar}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
