import { Dato, Seccion } from "@/modules/catalogo/panel";
import { formatearFechaHora } from "@/lib/format/fecha";
import type { DetalleOrden } from "../lecturas-ordenes";
import { ETIQUETA_ESTADO_ORDEN } from "../schemas-ordenes";
import { diaCalendario, EstadoOrden } from "./lista-ordenes";

export const MENSAJE_REEMBOLSO = "Se devolvió el efectivo de la caja.";
export const MENSAJE_SIN_REEMBOLSO =
  "La caja de esa orden ya cerró: si corresponde, registra una devolución en Ventas.";

// Solo lectura: ficha e historial. Ítems y pagos los pinta DetalleVentaVista con la venta de la orden.
// `reembolsada`: la venta quedó anulada, o sea que anular_orden devolvió el efectivo a su caja.
export function DetalleOrdenVista({ o, reembolsada }: { o: DetalleOrden; reembolsada: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Seccion titulo="Orden">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Dato t="Estado" d={<EstadoOrden estado={o.estado} />} />
          <Dato
            t="Desde"
            d={<span className="tabular-nums">{formatearFechaHora(o.estadoEn)}</span>}
          />
          <Dato t="Cliente" d={o.clienteNombre} />
          <Dato t="Teléfono" d={o.clienteTelefono ?? "—"} />
          <Dato t="Prendas" d={<span className="tabular-nums">{o.prendas}</span>} />
          <Dato t="Casillero" d={o.casillero ?? "—"} />
          <Dato t="Express" d={o.express ? "Sí" : "No"} />
          <Dato t="Fecha prometida" d={diaCalendario(o.fechaPrometida)} />
          <Dato t="Recibida por" d={o.recibidaPor ?? "—"} />
        </dl>
        {o.nota && <p className="bg-secondary rounded-lg p-3 text-sm">Nota: {o.nota}</p>}
        {o.estado === "entregada" && (
          <dl className="grid gap-x-6 gap-y-3 border-t pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Dato t="Retira" d={o.retiradaPor ?? "—"} />
            <Dato
              t="Con"
              d={
                o.retiroCon === "carnet"
                  ? `Carnet${o.documentoRetiro ? ` ${o.documentoRetiro}` : ""}`
                  : "Boleta"
              }
            />
            <Dato
              t="Entregada"
              d={`${o.entregadaPor ?? "—"}${o.entregadaEn ? ` · ${formatearFechaHora(o.entregadaEn)}` : ""}`}
            />
          </dl>
        )}
        {o.estado === "cancelada" && (
          <div className="bg-destructive/10 text-destructive flex flex-col gap-1 rounded-lg p-3 text-sm">
            <p>
              Anulada por {o.anuladaPor ?? "—"}. Motivo: {o.motivoAnulacion}
            </p>
            <p>{reembolsada ? MENSAJE_REEMBOLSO : MENSAJE_SIN_REEMBOLSO}</p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Historial">
        <ol aria-label="Historial" className="divide-y text-sm">
          {o.eventos.map((e) => (
            <li key={e.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-2.5">
              <span className="font-medium">{ETIQUETA_ESTADO_ORDEN[e.estado] ?? e.estado}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatearFechaHora(e.creadoEn)}
              </span>
              <span className="text-muted-foreground col-span-2 text-xs">
                {e.usuario ?? "—"}
                {e.motivo ? ` · ${e.motivo}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </Seccion>
    </div>
  );
}
