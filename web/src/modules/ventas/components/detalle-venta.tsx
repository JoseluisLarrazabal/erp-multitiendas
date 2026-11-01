import { Dato, Seccion } from "@/modules/catalogo/panel";
import { formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import { aMilesimas, formatearCantidad } from "../domain";
import { ETIQUETA_MEDIO, ETIQUETA_ORIGEN } from "../domain-panel";
import type { DetalleVenta } from "../lecturas-panel";
import { EstadoVenta } from "./estado-venta";

const mil = (n: number) => formatearCantidad(aMilesimas(n));

// Solo lectura: líneas, pagos y devoluciones previas. Nunca costos.
export function DetalleVentaVista({ v }: { v: DetalleVenta }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Seccion titulo="Venta">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Dato t="Número" d={<span className="font-mono font-semibold">{v.numero}</span>} />
          <Dato t="Estado" d={<EstadoVenta estado={v.estado} />} />
          <Dato
            t="Fecha"
            d={<span className="tabular-nums">{formatearFechaHora(v.recibidaEn)}</span>}
          />
          <Dato t="Equipo" d={v.equipo} />
          <Dato t="Vendedor" d={v.vendedor ?? "—"} />
          <Dato t="Cliente" d={v.cliente ?? "General"} />
          <Dato t="Origen" d={ETIQUETA_ORIGEN[v.origen] ?? v.origen} />
          <Dato
            t="Total"
            d={<span className="text-lg font-bold tabular-nums">{formatearBs(v.total)}</span>}
          />
        </dl>
        {v.estado === "anulada" && (
          <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
            Anulada{v.anuladaEn ? ` el ${formatearFechaHora(v.anuladaEn)}` : ""}
            {v.motivoAnulacion ? `. Motivo: ${v.motivoAnulacion}` : ""}
          </p>
        )}
      </Seccion>

      <Seccion titulo="Líneas">
        <ul aria-label="Líneas de la venta" className="divide-y">
          {v.items.map((i) => (
            <li key={i.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-2.5 text-sm">
              <span className="min-w-0 truncate font-medium">{i.nombre}</span>
              <span className="text-right font-semibold tabular-nums">
                {formatearBs(i.totalLinea)}
              </span>
              <span className="text-muted-foreground col-span-2 text-xs tabular-nums">
                {i.codigo} · {mil(i.cantidad)}
                {i.unidad === "kg" ? " kg" : ""} × {formatearBs(i.precioUnitario)}
                {i.descuento > 0 ? ` · descuento ${formatearBs(i.descuento)}` : ""}
                {i.devuelta > 0 ? ` · devuelto ${mil(i.devuelta)}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 border-t pt-3 text-sm tabular-nums">
          <p className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatearBs(v.subtotal)}</span>
          </p>
          {v.descuento > 0 && (
            <p className="flex justify-between">
              <span className="text-muted-foreground">Descuento de la venta</span>
              <span>−{formatearBs(v.descuento)}</span>
            </p>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Pagos">
        <ul aria-label="Pagos" className="divide-y text-sm">
          {v.pagos.map((p) => (
            <li key={p.id} className="flex justify-between py-2 tabular-nums">
              <span>{ETIQUETA_MEDIO[p.medio] ?? p.medio}</span>
              <span className="font-semibold">{formatearBs(p.monto)}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Devoluciones">
        {v.devoluciones.length === 0 ? (
          <p className="text-muted-foreground text-sm">Esta venta no tiene devoluciones.</p>
        ) : (
          <ul aria-label="Devoluciones" className="divide-y text-sm">
            {v.devoluciones.map((d) => (
              <li key={d.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-2.5">
                <span className="text-muted-foreground tabular-nums">
                  {formatearFechaHora(d.creadaEn)}
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {formatearBs(d.monto)}
                </span>
                <span className="min-w-0 truncate">{d.motivo}</span>
                <span className="text-muted-foreground text-right text-xs tabular-nums">
                  {formatearBs(d.montoEfectivo)} en efectivo ·{" "}
                  {formatearBs(Math.round((d.monto - d.montoEfectivo) * 100) / 100)} por QR
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}
