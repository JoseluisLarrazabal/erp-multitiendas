import { formatearDia, formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import type { DetalleCredito } from "../schemas";

// Plan de cuotas imprimible (RF-CRE-02): A4, con el CSS de impresión de globals.css. Lo que se imprime es lo que fijó el
// servidor al crear el crédito, no el cálculo de la pantalla. Lo usan el POS (tras vender) y el detalle del crédito.
export function PlanCuotasImprimible({
  d,
  negocio,
  numeroVenta,
}: {
  d: DetalleCredito;
  negocio: { nombre: string; nit: string | null; datosNota: string | null };
  numeroVenta: string;
}) {
  return (
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
          {d.cliente_nombre}
          {d.cliente_documento ? ` · ${d.cliente_documento}` : ""}
        </dd>
        <dt>Fecha:</dt>
        <dd>{formatearFechaHora(d.creado_en).slice(0, 10)}</dd>
        <dt>Inicial pagada:</dt>
        <dd>{formatearBs(d.inicial)}</dd>
        <dt>Capital financiado:</dt>
        <dd>{formatearBs(d.capital)}</dd>
        <dt>Interés mensual:</dt>
        <dd>{d.interes_mensual_pct} % sobre saldo</dd>
        <dt>Documentos:</dt>
        <dd>
          {[
            d.docs_ci && "CI",
            d.docs_domicilio && "comprobante de domicilio",
            d.docs_pagare && "pagaré",
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
          {d.cuotas.map((c) => (
            <tr key={c.numero}>
              <td className="py-0.5">{c.numero}</td>
              <td className="py-0.5">{formatearDia(c.vence_en)}</td>
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
            <td className="py-1 text-right">{formatearBs(d.total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-6 grid grid-cols-2 gap-8 text-center">
        <span className="border-t border-black pt-1">Firma del cliente</span>
        <span className="border-t border-black pt-1">Firma del vendedor</span>
      </p>
    </article>
  );
}
