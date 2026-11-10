import Link from "next/link";
import { Dato, Seccion } from "@/modules/catalogo/panel";
import { formatearFechaHora, formatearHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import {
  bsONulo,
  ETIQUETA_MOVIMIENTO,
  ETIQUETA_REVISION_MOVIMIENTO,
  textoTardias,
} from "../domain";
import type { DetalleSesion } from "../lecturas-panel";

// `enviadaPor` ya es la etiqueta completa ("Sin conexión, enviada por X"); null si la envió quien la registró.
const marca = (o: { enviadaPor: string | null }) => o.enviadaPor ?? "Sin conexión";

function FilaVentaSesion({ v }: { v: { numero: string; total: number; estado: string } }) {
  return (
    <>
      <span className="font-mono font-semibold">{v.numero}</span>
      <span className="text-muted-foreground flex-1 text-xs">
        {v.estado === "anulada" ? "Anulada" : ""}
      </span>
      <span>{formatearBs(v.total)}</span>
    </>
  );
}

const bs = (n: number | null) => (n === null ? "—" : formatearBs(n));

export function DetalleSesionVista({
  d,
  verVentas,
}: {
  d: DetalleSesion;
  // El detalle de una venta exige `ver_reportes` o `anular`: sin ellos la fila es texto.
  verVentas: boolean;
}) {
  const { sesion: s, resumen: r } = d;
  const cerrada = !!s.cerradaEn;
  const ventasTardias = r.tardias_ventas ?? 0;
  const movimientosTardios = r.tardias_movimientos ?? 0;
  // Lo que llegó sin conexión después del cierre cambia el esperado de ahora, no el arqueo ya guardado.
  const hayTardias =
    ventasTardias > 0 ||
    movimientosTardios > 0 ||
    (r.esperado !== null && s.montoEsperado !== null && r.esperado !== s.montoEsperado);
  const fila = "flex items-baseline justify-between gap-3 py-2 tabular-nums";
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Seccion titulo="Sesión">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Dato t="Equipo" d={s.equipo} />
          <Dato
            t="Apertura"
            d={`${formatearFechaHora(s.abiertaEn)}${d.abiertaPor ? ` · ${d.abiertaPor}` : ""}${d.aperturaOffline ? ` · ${marca(d.aperturaOffline)}` : ""}`}
          />
          <Dato
            t="Cierre"
            d={
              s.cerradaEn
                ? `${formatearFechaHora(s.cerradaEn)}${d.cerradaPor ? ` · ${d.cerradaPor}` : ""}`
                : "Abierta"
            }
          />
        </dl>
      </Seccion>

      <Seccion titulo="Arqueo">
        <dl className="divide-y text-sm">
          <div className={fila}>
            <dt>Efectivo inicial</dt>
            <dd>{formatearBs(r.monto_inicial)}</dd>
          </div>
          <div className={fila}>
            <dt>Ventas en efectivo</dt>
            <dd>{bs(r.ventas_efectivo)}</dd>
          </div>
          <div className={fila}>
            <dt>Ingresos</dt>
            <dd>{bs(r.ingresos)}</dd>
          </div>
          <div className={fila}>
            <dt>Gastos</dt>
            <dd>{r.gastos === null ? "—" : `−${formatearBs(r.gastos)}`}</dd>
          </div>
          <div className={fila}>
            <dt>Retiros</dt>
            <dd>{r.retiros === null ? "—" : `−${formatearBs(r.retiros)}`}</dd>
          </div>
          <div className={fila}>
            <dt>Devoluciones en efectivo</dt>
            <dd>
              {r.devoluciones_efectivo === null ? "—" : `−${formatearBs(r.devoluciones_efectivo)}`}
            </dd>
          </div>
          <div className={fila}>
            <dt>Anticipos de reservas en efectivo</dt>
            <dd>{bs(r.anticipos_efectivo)}</dd>
          </div>
          <div className={fila}>
            <dt>Devoluciones de reservas en efectivo</dt>
            <dd>
              {r.devoluciones_reserva_efectivo === null
                ? "—"
                : `−${formatearBs(r.devoluciones_reserva_efectivo)}`}
            </dd>
          </div>
          <div className={fila}>
            <dt>Cuotas de crédito en efectivo</dt>
            <dd>{bs(r.cuotas_efectivo)}</dd>
          </div>
          {cerrada && hayTardias && (
            <div className={fila}>
              <dt>Esperado con lo que llegó después</dt>
              <dd className="font-semibold" data-testid="sesion-esperado-actual">
                {bs(r.esperado)}
              </dd>
            </div>
          )}
          <div className={fila}>
            <dt>{cerrada ? "Esperado al cierre" : "Esperado"}</dt>
            <dd className="font-semibold" data-testid="sesion-esperado">
              {r.esperado === null ? "—" : bs(cerrada ? s.montoEsperado : r.esperado)}
            </dd>
          </div>
          <div className={fila}>
            <dt>Contado</dt>
            <dd className="font-semibold">{bsONulo(s.montoContado)}</dd>
          </div>
          <div className={fila}>
            <dt>Diferencia</dt>
            <dd className="font-bold" data-testid="sesion-diferencia">
              {bsONulo(s.diferencia)}
            </dd>
          </div>
          <div className={fila}>
            <dt>QR (cobrado menos devuelto)</dt>
            <dd className="font-semibold" data-testid="sesion-qr">
              {bs(r.qr_neto)}
            </dd>
          </div>
          <div className={fila}>
            <dt>Anticipos de reservas por QR (incluidos en el QR)</dt>
            <dd>{bs(r.anticipos_qr)}</dd>
          </div>
          <div className={fila}>
            <dt>Cuotas de crédito por QR (incluidas en el QR)</dt>
            <dd>{bs(r.cuotas_qr)}</dd>
          </div>
          <div className={fila}>
            <dt>Devoluciones de reservas por QR (incluidas en el QR)</dt>
            <dd>
              {r.devoluciones_reserva_qr === null
                ? "—"
                : `−${formatearBs(r.devoluciones_reserva_qr)}`}
            </dd>
          </div>
        </dl>
        {cerrada && hayTardias && (
          <p role="status" className="text-muted-foreground text-xs">
            {textoTardias(ventasTardias, r.tardias_ventas_total ?? 0, movimientosTardios)}
          </p>
        )}
        {!cerrada && (
          <p className="text-muted-foreground text-xs">
            El esperado es el de ahora; contado y diferencia aparecen al cerrar la caja.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Movimientos">
        {d.totalMovimientos === 0 ? (
          <p className="text-muted-foreground text-sm">Sin movimientos en esta sesión.</p>
        ) : (
          <ul aria-label="Movimientos" className="divide-y text-sm">
            {d.movimientos.map((m) => (
              <li key={m.id} className="flex items-baseline gap-3 py-2">
                <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
                  {formatearHora(m.creadoEn)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{ETIQUETA_MOVIMIENTO[m.tipo]}</span>
                  <span className="text-muted-foreground"> · {m.motivo}</span>
                  {d.movimientosOffline[m.id] && (
                    <span className="text-muted-foreground block text-xs">
                      {marca(d.movimientosOffline[m.id]!)}
                    </span>
                  )}
                  {d.movimientosOffline[m.id]?.motivos.map((x) => (
                    <span key={x} className="text-destructive block text-xs">
                      Por revisar: {ETIQUETA_REVISION_MOVIMIENTO[x] ?? x}
                    </span>
                  ))}
                </span>
                <span className="font-medium tabular-nums">
                  {m.tipo === "ingreso" ? "+" : "−"}
                  {formatearBs(m.monto)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {d.totalMovimientos > d.movimientos.length && (
          <p className="text-muted-foreground text-xs">
            Mostrando {d.movimientos.length} de {d.totalMovimientos} movimientos (los más
            recientes). Los totales del arqueo cuentan todos.
          </p>
        )}
      </Seccion>

      <Seccion titulo={`Ventas (${d.totalVentas})`}>
        {d.ventas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin ventas en esta sesión.</p>
        ) : (
          <>
            <ul aria-label="Ventas de la sesión" className="divide-y text-sm">
              {d.ventas.map((v) => (
                <li key={v.id}>
                  {verVentas ? (
                    <Link
                      href={`/panel/ventas/${v.id}`}
                      className="hover:bg-muted/60 flex items-baseline justify-between gap-3 py-2 tabular-nums"
                    >
                      <FilaVentaSesion v={v} />
                    </Link>
                  ) : (
                    <div className="flex items-baseline justify-between gap-3 py-2 tabular-nums">
                      <FilaVentaSesion v={v} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {d.totalVentas > d.ventas.length && (
              <p className="text-muted-foreground text-xs">
                Mostrando {d.ventas.length} de {d.totalVentas} ventas (las más recientes). Los
                totales cuentan todas.
              </p>
            )}
          </>
        )}
      </Seccion>
    </div>
  );
}
