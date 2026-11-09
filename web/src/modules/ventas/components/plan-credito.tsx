"use client";

import { ArrowLeft, Loader2, Plus, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatearBs } from "@/lib/format/moneda";
import { createClient } from "@/lib/supabase/browser";
import { cargarDetalle, fechaCorta, type DetalleCredito } from "@/modules/creditos";

// Plan de cuotas imprimible (RF-CRE-02), hermano de NotaVentaVista: A4, con el CSS de impresión de globals.css. Lo
// que se imprime es lo que fijó el servidor al crear el crédito, no el cálculo de la pantalla.
export function PlanCreditoVista({
  ventaId,
  negocio,
  numeroVenta,
  alVolver,
  alNueva,
}: {
  ventaId: string;
  negocio: { nombre: string; nit: string | null; datosNota: string | null };
  numeroVenta: string;
  alVolver: () => void;
  alNueva: () => void;
}) {
  const [estado, setEstado] = useState<
    { t: "cargando" } | { t: "error"; mensaje: string } | { t: "listo"; d: DetalleCredito }
  >({ t: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void cargarDetalle(createClient(), { ventaId }).then((r) => {
      if (!cancelado)
        setEstado(r.ok ? { t: "listo", d: r.data } : { t: "error", mensaje: r.error });
    });
    return () => {
      cancelado = true;
    };
  }, [ventaId, intento]);

  return (
    <div className="flex flex-col items-center gap-3 print:block">
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-2 print:hidden">
        <p role="status" className="mr-auto text-sm font-medium">
          Plan de cuotas de la venta {numeroVenta}
        </p>
        <Button type="button" variant="outline" className="h-10" onClick={alVolver}>
          <ArrowLeft /> Nota de venta
        </Button>
        <Button
          type="button"
          className="h-10"
          disabled={estado.t !== "listo"}
          onClick={() => window.print()}
        >
          <Printer /> Imprimir
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={alNueva}>
          <Plus /> Nueva venta
        </Button>
      </div>
      {estado.t === "cargando" && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm print:hidden">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando el plan…
        </p>
      )}
      {estado.t === "error" && (
        <div
          role="alert"
          className="border-destructive text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm print:hidden"
        >
          <span>{estado.mensaje}</span>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              setEstado({ t: "cargando" });
              setIntento(intento + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      {estado.t === "listo" && (
        <article
          aria-label={`Plan de cuotas ${numeroVenta}`}
          className="nota-venta nota-a4 w-full max-w-[190mm] rounded-lg border bg-white p-4 text-[13px] leading-snug text-black tabular-nums print:rounded-none print:border-0 print:p-0"
        >
          <header className="text-center">
            <h2 className="text-base font-bold">{negocio.nombre}</h2>
            {negocio.nit && <p>NIT {negocio.nit}</p>}
            {negocio.datosNota && <p className="whitespace-pre-line">{negocio.datosNota}</p>}
          </header>
          <p className="mt-2 text-center font-semibold">PLAN DE CUOTAS · VENTA {numeroVenta}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2">
            <dt>Cliente:</dt>
            <dd>
              {estado.d.cliente_nombre}
              {estado.d.cliente_documento ? ` · ${estado.d.cliente_documento}` : ""}
            </dd>
            <dt>Fecha:</dt>
            <dd>{fechaCorta(estado.d.creado_en)}</dd>
            <dt>Inicial pagada:</dt>
            <dd>{formatearBs(estado.d.inicial)}</dd>
            <dt>Capital financiado:</dt>
            <dd>{formatearBs(estado.d.capital)}</dd>
            <dt>Interés mensual:</dt>
            <dd>{estado.d.interes_mensual_pct} % sobre saldo</dd>
            <dt>Documentos:</dt>
            <dd>
              {[
                estado.d.docs_ci && "CI",
                estado.d.docs_domicilio && "comprobante de domicilio",
                estado.d.docs_pagare && "pagaré",
              ]
                .filter(Boolean)
                .join(", ") || "ninguno"}
            </dd>
          </dl>
          <table className="mt-2 w-full border-t border-dashed border-black">
            <thead>
              <tr className="text-left">
                <th className="py-1 font-semibold">N.º</th>
                <th className="py-1 font-semibold">Vence</th>
                <th className="py-1 text-right font-semibold">Capital</th>
                <th className="py-1 text-right font-semibold">Interés</th>
                <th className="py-1 text-right font-semibold">Cuota</th>
              </tr>
            </thead>
            <tbody>
              {estado.d.cuotas.map((c) => (
                <tr key={c.numero}>
                  <td className="py-0.5">{c.numero}</td>
                  <td className="py-0.5">{fechaCorta(c.vence_en)}</td>
                  <td className="py-0.5 text-right">{formatearBs(c.capital)}</td>
                  <td className="py-0.5 text-right">{formatearBs(c.interes)}</td>
                  <td className="py-0.5 text-right">{formatearBs(c.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-dashed border-black font-bold">
                <td className="py-1" colSpan={4}>
                  TOTAL A PAGAR EN CUOTAS
                </td>
                <td className="py-1 text-right">{formatearBs(estado.d.total)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-6 grid grid-cols-2 gap-8 text-center">
            <span className="border-t border-black pt-1">Firma del cliente</span>
            <span className="border-t border-black pt-1">Firma del vendedor</span>
          </p>
        </article>
      )}
    </div>
  );
}
