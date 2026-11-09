import { formatearBs } from "@/lib/format/moneda";
import { Dato } from "@/modules/catalogo/panel";
import { formatearDia, formatearFechaHora } from "@/lib/format/fecha";
import { ETIQUETA_ORIGEN } from "../domain";
import { AnularSaldoInicial } from "./anular-saldo-inicial";
import type { DetalleCredito } from "../schemas";

const MEDIOS: Record<string, string> = { efectivo: "Efectivo", qr: "QR" };

// Detalle de un crédito: cuotas con lo pagado (FIFO, derivado) y los pagos recibidos.
export function DetalleCreditoVista({ d }: { d: DetalleCredito }) {
  const si = (v: boolean) => (v ? "Sí" : "No");
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <dl className="bg-card grid gap-x-6 gap-y-3 rounded-xl border p-5 shadow-[0_2px_5px_#34345a0d] sm:grid-cols-2 lg:grid-cols-4">
        <Dato
          t="Cliente"
          d={`${d.cliente_nombre}${d.cliente_documento ? ` · ${d.cliente_documento}` : ""}`}
        />
        <Dato
          t="Origen"
          d={`${ETIQUETA_ORIGEN[d.origen]}${d.venta_numero ? ` ${d.venta_numero}` : ""}`}
        />
        <Dato
          t="Estado"
          d={
            d.estado === "pagado"
              ? "Pagado"
              : d.estado === "anulado"
                ? `Anulado: ${d.motivo_anulacion ?? ""}`
                : "Activo"
          }
        />
        <Dato t="Interés mensual" d={`${d.interes_mensual_pct} %`} />
        <Dato t="Inicial pagada" d={formatearBs(d.inicial)} />
        <Dato t="Capital financiado" d={formatearBs(d.capital)} />
        <Dato t="Total de cuotas" d={formatearBs(d.total)} />
        <Dato t="Saldo" d={<strong>{formatearBs(d.saldo)}</strong>} />
        {d.origen === "venta" && (
          <Dato
            t="Documentos"
            d={`CI ${si(d.docs_ci)} · Domicilio ${si(d.docs_domicilio)} · Pagaré ${si(d.docs_pagare)}`}
          />
        )}
      </dl>
      {d.origen === "saldo_inicial" && d.estado === "activo" && d.pagos.length === 0 && (
        <AnularSaldoInicial creditoId={d.id} />
      )}
      <section aria-label="Cuotas" className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Cuotas</h2>
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-3 py-2 font-semibold">N.º</th>
                <th className="px-3 py-2 font-semibold">Vence</th>
                <th className="px-3 py-2 text-right font-semibold">Capital</th>
                <th className="px-3 py-2 text-right font-semibold">Interés</th>
                <th className="px-3 py-2 text-right font-semibold">Cuota</th>
                <th className="px-3 py-2 text-right font-semibold">Pagado</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {d.cuotas.map((c) => (
                <tr key={c.numero} className="border-b last:border-0">
                  <td className="px-3 py-2">{c.numero}</td>
                  <td className="px-3 py-2">{formatearDia(c.vence_en)}</td>
                  <td className="px-3 py-2 text-right">{formatearBs(c.capital)}</td>
                  <td className="px-3 py-2 text-right">{formatearBs(c.interes)}</td>
                  <td className="px-3 py-2 text-right">{formatearBs(c.monto)}</td>
                  <td className="px-3 py-2 text-right">{formatearBs(c.pagado)}</td>
                  <td className="px-3 py-2">
                    {c.pendiente === 0 ? (
                      "Pagada"
                    ) : c.dias_atraso > 0 ? (
                      <span className="text-destructive font-medium">
                        Vencida · {c.dias_atraso} {c.dias_atraso === 1 ? "día" : "días"}
                      </span>
                    ) : (
                      `Pendiente ${formatearBs(c.pendiente)}`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-label="Pagos" className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Pagos recibidos</h2>
        {d.pagos.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-xl border p-4 text-sm">
            Aún no hay pagos de cuotas.
          </p>
        ) : (
          <ul className="bg-card divide-y rounded-xl border text-sm tabular-nums">
            {d.pagos.map((p, i) => (
              <li key={i} className="flex justify-between gap-3 px-4 py-2.5">
                <span>
                  {formatearFechaHora(p.creado_en)} · {MEDIOS[p.medio] ?? p.medio}
                </span>
                <span>{formatearBs(p.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
