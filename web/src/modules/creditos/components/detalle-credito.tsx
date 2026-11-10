import { formatearBs } from "@/lib/format/moneda";
import { Dato } from "@/modules/catalogo/panel";
import { formatearDia, formatearFechaHora } from "@/lib/format/fecha";
import { agruparPagos, ETIQUETA_ORIGEN } from "../domain";
import { AnularPagoCuota, type EquipoAbierto } from "./anular-pago-cuota";
import { AnularSaldoInicial } from "./anular-saldo-inicial";
import { BotonImprimirPlan } from "./boton-imprimir-plan";
import { DocumentosCredito } from "./documentos-credito";
import { PlanCuotasImprimible } from "./plan-cuotas-imprimible";
import type { DetalleCredito } from "../schemas";

// Detalle de un crédito: cuotas con lo pagado (FIFO, derivado) y los pagos recibidos.
export function DetalleCreditoVista({
  d,
  puedeGestionar,
  puedeAnular,
  equipos,
  negocio,
}: {
  d: DetalleCredito;
  puedeGestionar: boolean;
  puedeAnular: boolean;
  // Cajas abiertas de donde puede salir el efectivo de un reverso; null si no se pudieron leer.
  equipos: readonly EquipoAbierto[] | null;
  negocio: { nombre: string; nit: string | null; datosNota: string | null };
}) {
  const si = (v: boolean) => (v ? "Sí" : "No");
  const pagos = agruparPagos(d.pagos);
  const ultimo = pagos.find((p) => p.operacionId === d.ultimo_pago_id);
  const editable = d.origen === "venta" && d.estado !== "anulado";
  return (
    <>
      <div className="flex min-w-0 flex-col gap-6 print:hidden">
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
          {d.origen === "venta" && !(puedeGestionar && editable) && (
            <Dato
              t="Documentos"
              d={`CI ${si(d.docs_ci)} · Domicilio ${si(d.docs_domicilio)} · Pagaré ${si(d.docs_pagare)}`}
            />
          )}
        </dl>
        {d.venta_numero && <BotonImprimirPlan />}
        {puedeGestionar && editable && (
          <DocumentosCredito
            creditoId={d.id}
            inicial={{ ci: d.docs_ci, domicilio: d.docs_domicilio, pagare: d.docs_pagare }}
          />
        )}
        {puedeAnular && d.estado !== "anulado" && ultimo && (
          <AnularPagoCuota
            key={ultimo.operacionId}
            pagoOperacionId={ultimo.operacionId}
            descripcionPago={`${formatearFechaHora(ultimo.creadoEn)} por ${formatearBs(ultimo.total)}`}
            equipos={equipos}
          />
        )}
        {puedeGestionar &&
          d.origen === "saldo_inicial" &&
          d.estado === "activo" &&
          d.pagos.length === 0 && <AnularSaldoInicial creditoId={d.id} />}
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
          {pagos.length === 0 ? (
            <p className="text-muted-foreground bg-card rounded-xl border p-4 text-sm">
              Aún no hay pagos de cuotas.
            </p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border text-sm tabular-nums">
              {pagos.map((p) => (
                <li
                  key={p.operacionId}
                  className={`flex flex-wrap justify-between gap-x-3 px-4 py-2.5 ${p.anulado ? "text-muted-foreground" : ""}`}
                >
                  <span className={p.anulado ? "line-through" : ""}>
                    {formatearFechaHora(p.creadoEn)} · {detalleMedios(p)}
                    {p.esReverso && p.motivo ? ` · ${p.motivo}` : ""}
                  </span>
                  <span>
                    {p.esReverso && <strong className="mr-2">Anulación de pago</strong>}
                    {p.anulado && <strong className="mr-2">Anulado</strong>}
                    <span className={p.anulado ? "line-through" : ""}>{formatearBs(p.total)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {d.venta_numero && (
        <div className="hidden print:block">
          <PlanCuotasImprimible d={d} negocio={negocio} numeroVenta={d.venta_numero} />
        </div>
      )}
    </>
  );
}

// "Efectivo Bs 10,00 + QR Bs 5,00"; un pago mixto no se muestra como un solo medio.
function detalleMedios(p: { efectivo: number; qr: number }) {
  return [
    p.efectivo !== 0 && `Efectivo ${formatearBs(p.efectivo)}`,
    p.qr !== 0 && `QR ${formatearBs(p.qr)}`,
  ]
    .filter(Boolean)
    .join(" + ");
}
