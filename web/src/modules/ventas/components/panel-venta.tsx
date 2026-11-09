"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectorCliente, type ClienteElegido } from "@/modules/clientes";
import type { AccionCarrito, Permisos, ResumenCarrito } from "../carrito";
import { bs } from "../domain";
import type { FichaTexto } from "../orden";
import type { Parametros } from "@/modules/creditos";
import type { FormCredito, PlanVenta } from "../credito-venta";
import { CarritoLineas } from "./carrito";
import { ClienteEscrito, FichaOrden } from "./ficha-orden";
import { FormCreditoVenta } from "./form-credito-venta";

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
  orden,
  sinRed,
  reserva,
  credito,
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
  // Lavandería: ficha de la orden. null en tienda y frial.
  orden: {
    ficha: FichaTexto;
    alCambiarFicha: (f: FichaTexto) => void;
    express: boolean;
    alCambiarExpress: (v: boolean) => void;
  } | null;
  sinRed: boolean;
  // Venta que completa una reserva: cliente y carrito fijos, sin descuento.
  reserva: { cliente: string; anticipo: number; alQuitar: () => void } | null;
  // Venta a crédito (RF-CRE): null si el usuario no puede (sin gestionar_credito, lavandería o reserva en curso).
  credito: {
    form: FormCredito;
    alCambiar: (cambios: Partial<FormCredito>) => void;
    alAlternar: (activo: boolean) => void;
    parametros: Parametros | null;
    plan: PlanVenta | null;
    // Fallo al calcular el plan (conexión): botón para volver a pedirlo.
    alReintentar: (() => void) | null;
  } | null;
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
      {reserva && (
        <div className="bg-muted flex flex-col gap-1.5 rounded-lg p-2.5 text-sm">
          <p>
            Completando la reserva de <span className="font-medium">{reserva.cliente}</span>.
            Anticipo recibido: <span className="tabular-nums">{bs(reserva.anticipo)}</span>.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-9 self-start"
            onClick={reserva.alQuitar}
          >
            Descartar reserva
          </Button>
        </div>
      )}
      {reserva ? null : orden && sinRed && !cliente ? (
        <ClienteEscrito
          ficha={orden.ficha}
          alCambiar={orden.alCambiarFicha}
          bloqueado={bloqueado}
        />
      ) : (
        <SelectorCliente
          negocioId={negocioId}
          obligatorio={clienteObligatorio}
          valor={cliente}
          alCambiar={alCambiarCliente}
        />
      )}
      {orden && (
        <FichaOrden
          ficha={orden.ficha}
          alCambiar={orden.alCambiarFicha}
          express={orden.express}
          alCambiarExpress={orden.alCambiarExpress}
          bloqueado={bloqueado}
        />
      )}
      <CarritoLineas
        lineas={resumen.lineas}
        permisos={permisos}
        ubicacionId={ubicacionId}
        despachar={despachar}
        bloqueado={bloqueado}
        listaFija={orden !== null || !!credito?.form.activo}
      />
      {credito && (
        <FormCreditoVenta
          form={credito.form}
          alCambiar={credito.alCambiar}
          alAlternar={credito.alAlternar}
          parametros={credito.parametros}
          plan={credito.plan}
          alReintentar={credito.alReintentar}
          bloqueado={bloqueado}
          sinRed={sinRed}
          hayLineas={hayLineas}
        />
      )}
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
      {hayLineas && puedeBajar && !reserva && (
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
        Cobrar{" "}
        <kbd className="border-primary-foreground/50 ml-1 rounded border px-1.5 text-xs">F2</kbd>
      </Button>
    </aside>
  );
}
