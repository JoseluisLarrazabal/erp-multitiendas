import Link from "next/link";
import { Dato, Seccion } from "@/modules/catalogo/panel";
import { formatearFechaHora, formatearHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import { bsONulo, ETIQUETA_MOVIMIENTO, ETIQUETA_REVISION_MOVIMIENTO } from "../domain";
import type { DetalleSesion } from "../lecturas-panel";

// `enviadaPor` ya es la etiqueta completa ("Sin conexión, enviada por X"); null si la envió quien la registró.
const marca = (o: { enviadaPor: string | null }) => o.enviadaPor ?? "Sin conexión";

export function DetalleSesionVista({ d }: { d: DetalleSesion }) {
  const { sesion: s, resumen: r } = d;
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
            <dd>{formatearBs(r.ventas_efectivo)}</dd>
          </div>
          <div className={fila}>
            <dt>Ingresos</dt>
            <dd>{formatearBs(r.ingresos)}</dd>
          </div>
          <div className={fila}>
            <dt>Gastos</dt>
            <dd>−{formatearBs(r.gastos)}</dd>
          </div>
          <div className={fila}>
            <dt>Retiros</dt>
            <dd>−{formatearBs(r.retiros)}</dd>
          </div>
          <div className={fila}>
            <dt>Devoluciones en efectivo</dt>
            <dd>−{formatearBs(r.devoluciones_efectivo)}</dd>
          </div>
          <div className={fila}>
            <dt>Esperado</dt>
            <dd className="font-semibold" data-testid="sesion-esperado">
              {r.esperado === null ? "—" : formatearBs(r.esperado)}
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
              {formatearBs(r.qr_neto)}
            </dd>
          </div>
        </dl>
        {!s.cerradaEn && (
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
                  <Link
                    href={`/panel/ventas/${v.id}`}
                    className="hover:bg-muted/60 flex items-baseline justify-between gap-3 py-2 tabular-nums"
                  >
                    <span className="font-mono font-semibold">{v.numero}</span>
                    <span className="text-muted-foreground flex-1 text-xs">
                      {v.estado === "anulada" ? "Anulada" : ""}
                    </span>
                    <span>{formatearBs(v.total)}</span>
                  </Link>
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
