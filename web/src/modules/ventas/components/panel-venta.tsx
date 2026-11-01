"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectorCliente, type ClienteElegido } from "@/modules/clientes";
import type { AccionCarrito, Permisos, ResumenCarrito } from "../carrito";
import { bs } from "../domain";
import { CarritoLineas } from "./carrito";

// Panel lateral de la venta: cliente, líneas, descuento de la venta, total y cobrar.
export function PanelVenta({
  consulta,
  resumen,
  cantidadLineas,
  permisos,
  negocioId,
  ubicacionId,
  clienteObligatorio,
  cliente,
  alCambiarCliente,
  despachar,
  bloqueado,
  descuentoTexto,
  alCambiarDescuento,
  motivoBloqueo,
  puedeCobrar,
  abrirCobro,
  tituloRef,
}: {
  consulta: boolean;
  resumen: ResumenCarrito;
  cantidadLineas: number;
  permisos: Permisos;
  negocioId: string;
  ubicacionId: string;
  clienteObligatorio: boolean;
  cliente: ClienteElegido | null;
  alCambiarCliente: (c: ClienteElegido | null) => void;
  despachar: (a: AccionCarrito) => void;
  bloqueado: boolean;
  descuentoTexto: string;
  alCambiarDescuento: (texto: string) => void;
  motivoBloqueo: string | null;
  puedeCobrar: boolean;
  abrirCobro: () => void;
  tituloRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const totales = resumen.totales;
  const hayLineas = cantidadLineas > 0;
  const puedeBajar = permisos.puedeDescontar && permisos.tope > 0;
  return (
    <aside
      aria-label="Venta"
      className={`bg-card flex flex-col gap-3 rounded-xl border p-3 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:self-start lg:overflow-y-auto ${consulta ? "max-lg:hidden" : ""}`}
    >
      <h2
        ref={tituloRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-sm font-semibold outline-none"
      >
        <ShoppingCart className="size-4" aria-hidden /> Venta actual
        <span className="text-muted-foreground font-normal tabular-nums">
          ({cantidadLineas} {cantidadLineas === 1 ? "línea" : "líneas"})
        </span>
      </h2>
      <SelectorCliente
        negocioId={negocioId}
        obligatorio={clienteObligatorio}
        valor={cliente}
        alCambiar={alCambiarCliente}
      />
      <CarritoLineas
        lineas={resumen.lineas}
        permisos={permisos}
        ubicacionId={ubicacionId}
        despachar={despachar}
        bloqueado={bloqueado}
      />
      {hayLineas && !permisos.puedeDescontar && (
        <p className="text-muted-foreground text-xs">
          Sin permiso de descuento: para bajar precios o descontar, pide a un encargado que venda
          desde su sesión.
        </p>
      )}
      {hayLineas && permisos.puedeDescontar && permisos.tope === 0 && (
        <p className="text-muted-foreground text-xs">
          Los descuentos están desactivados (tope 0 %). Un encargado puede configurarlo.
        </p>
      )}
      {hayLineas && puedeBajar && (
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>Descuento de la venta (Bs)</span>
          <Input
            aria-label="Descuento de la venta"
            inputMode="decimal"
            placeholder="0,00"
            className="h-10 w-28 text-right tabular-nums"
            value={descuentoTexto}
            disabled={bloqueado}
            onChange={(e) => alCambiarDescuento(e.target.value)}
          />
        </label>
      )}
      <div className="border-t pt-2">
        {totales && totales.subtotal !== totales.total && (
          <p className="text-muted-foreground flex justify-between text-xs tabular-nums">
            <span>Subtotal</span>
            <span>{bs(totales.subtotal)}</span>
          </p>
        )}
        <p className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Total</span>
          {/* Solo el total de escritorio es región viva: la barra móvil repite el valor y se anunciaría dos veces. */}
          <span
            className="text-3xl font-bold tabular-nums"
            data-testid="total"
            aria-live="polite"
            aria-atomic="true"
          >
            {bs(totales?.total ?? 0)}
          </span>
        </p>
      </div>
      <p role="status" className="text-destructive text-xs empty:hidden">
        {motivoBloqueo}
      </p>
      <Button
        type="button"
        className="h-12 text-base max-lg:hidden"
        disabled={!puedeCobrar}
        onClick={abrirCobro}
      >
        Cobrar <kbd className="bg-primary-foreground/20 ml-1 rounded px-1.5 text-xs">F2</kbd>
      </Button>
    </aside>
  );
}
