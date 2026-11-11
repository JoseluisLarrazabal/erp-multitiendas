"use client";

import { CalendarDays, Printer, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatearFechaHora } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";
import { bs, ETIQUETA_MEDIO } from "../domain";
import { fechaCorta } from "../ordenes-pos";
import type { NotaVenta } from "../venta";

type Papel = "80" | "a4";

// Nota de venta (RF-VEN-05); si lleva `orden` (lavandería) se imprime como boleta con la ficha de la orden. Imprime con window.print(); el papel (80 mm o A4) lo fija la clase de página de
// globals.css. Fuera de .nota-venta todo lleva print:hidden: sale sin cromo de la app.
export function NotaVentaVista({
  nota,
  enCola,
  alNueva,
  alVerPlan,
}: {
  nota: NotaVenta;
  // La venta aún no llegó al servidor: no se dice "registrada".
  enCola: boolean;
  alNueva: () => void;
  // Venta a crédito: abre el plan de cuotas imprimible.
  alVerPlan?: () => void;
}) {
  const [papel, setPapel] = useState<Papel>("80");
  const orden = nota.orden;
  const cosa = orden ? "Orden" : "Venta";
  const fecha = formatearFechaHora(nota.fechaIso);
  return (
    <div className="flex flex-col items-center gap-3 print:block">
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-2 print:hidden">
        <p role="status" className="mr-auto text-sm font-medium">
          {enCola
            ? `${cosa} ${nota.numero} guardada en este equipo. Se enviará al volver la conexión.`
            : `${cosa} ${nota.numero} registrada`}
        </p>
        <fieldset className="flex gap-1" aria-label="Tamaño de papel">
          {(["80", "a4"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              variant={papel === p ? "secondary" : "outline"}
              className="h-10"
              aria-pressed={papel === p}
              onClick={() => setPapel(p)}
            >
              {p === "80" ? "Ticket 80 mm" : "A4"}
            </Button>
          ))}
        </fieldset>
        <Button type="button" className="h-10" onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
        {alVerPlan && (
          <Button type="button" variant="outline" className="h-10" onClick={alVerPlan}>
            <CalendarDays /> Plan de cuotas
          </Button>
        )}
        <Button type="button" variant="outline" className="h-10" onClick={alNueva} autoFocus>
          <Plus /> {orden ? "Nueva orden" : "Nueva venta"}
        </Button>
      </div>
      <article
        aria-label={`${orden ? "Boleta" : "Nota de venta"} ${nota.numero}`}
        className={cn(
          "nota-venta w-full rounded-lg border bg-white p-4 text-[13px] leading-snug text-black tabular-nums print:rounded-none print:border-0 print:p-0",
          papel === "80" ? "nota-80 max-w-[80mm] text-[12px]" : "nota-a4 max-w-[190mm]",
        )}
      >
        <header className="text-center">
          <h2 className="text-base font-bold">{nota.negocio.nombre}</h2>
          {nota.negocio.nit && <p>NIT {nota.negocio.nit}</p>}
          {nota.negocio.datosNota && (
            <p className="whitespace-pre-line">{nota.negocio.datosNota}</p>
          )}
        </header>
        <p className="mt-2 text-center font-semibold">
          {orden ? "BOLETA" : "NOTA DE VENTA"} {nota.numero}
        </p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2">
          <dt>Fecha:</dt>
          <dd>{fecha}</dd>
          <dt>Vendedor:</dt>
          <dd>{nota.vendedor}</dd>
          <dt>Cliente:</dt>
          <dd>
            {nota.cliente
              ? `${nota.cliente.nombre}${nota.cliente.documento ? ` · ${nota.cliente.documento}` : ""}`
              : "General"}
          </dd>
          {orden && (
            <>
              {orden.telefono && (
                <>
                  <dt>Teléfono:</dt>
                  <dd>{orden.telefono}</dd>
                </>
              )}
              <dt>Prendas:</dt>
              <dd>{orden.prendas}</dd>
              {orden.casillero && (
                <>
                  <dt>Casillero:</dt>
                  <dd>{orden.casillero}</dd>
                </>
              )}
              <dt>Express:</dt>
              <dd>{orden.express ? "Sí" : "No"}</dd>
              <dt>Entrega:</dt>
              <dd>{fechaCorta(orden.fechaPrometida)}</dd>
              {orden.nota && (
                <>
                  <dt>Nota:</dt>
                  <dd className="break-words">{orden.nota}</dd>
                </>
              )}
            </>
          )}
        </dl>
        <table className="mt-2 w-full border-t border-dashed border-black">
          <thead>
            <tr className="text-left">
              <th className="py-1 font-semibold">Detalle</th>
              <th className="py-1 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {nota.lineas.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="py-0.5 pr-2">
                  {l.cantidad} x {l.nombre} @ {bs(l.precio)}
                  {l.serie && <span className="block">Serie: {l.serie}</span>}
                  {l.descuento > 0 && <span className="block">Descuento: -{bs(l.descuento)}</span>}
                  {l.garantiaMeses ? (
                    <span className="block">
                      Garantía: {l.garantiaMeses} {l.garantiaMeses === 1 ? "mes" : "meses"}
                    </span>
                  ) : null}
                </td>
                <td className="py-0.5 text-right whitespace-nowrap">{bs(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1 space-y-0.5 border-t border-dashed border-black pt-1">
          {nota.descuentoVenta > 0 && (
            <p className="flex justify-between">
              <span>Descuento de la venta</span>
              <span>-{bs(nota.descuentoVenta)}</span>
            </p>
          )}
          <p className="flex justify-between text-base font-bold">
            <span>TOTAL</span>
            <span>{bs(nota.total)}</span>
          </p>
          {nota.pagos.map((p) => (
            <p key={p.medio} className="flex justify-between">
              <span>
                {ETIQUETA_MEDIO[p.medio]}
                {p.pendiente && " (QR pendiente de verificar)"}
              </span>
              <span>{bs(p.monto)}</span>
            </p>
          ))}
          {nota.credito && (
            <p className="flex justify-between font-semibold">
              <span>
                A crédito en {nota.credito.cuotas} {nota.credito.cuotas === 1 ? "cuota" : "cuotas"}
              </span>
              <span>{bs(nota.credito.financiado)}</span>
            </p>
          )}
          {nota.vuelto > 0 && (
            <p className="flex justify-between">
              <span>Vuelto</span>
              <span>{bs(nota.vuelto)}</span>
            </p>
          )}
        </div>
        {nota.pagos.some((p) => p.pendiente) && (
          <p className="mt-2 text-center font-semibold">
            QR pendiente de verificar: el pago aún no está confirmado.
          </p>
        )}
        <p className="mt-3 text-center">Gracias por su compra</p>
      </article>
    </div>
  );
}
