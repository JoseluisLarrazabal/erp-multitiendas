"use client";

import { CloudOff, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatearBs } from "@/lib/format/moneda";
import type { ColaPos, VentaRechazada } from "../use-cola";
import { DescartarVenta } from "./descartar-venta";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const MENSAJE_FALLO = "No se pudo completar la acción en este equipo. Recarga la página.";

type Descarte = { t: "venta"; venta: VentaRechazada } | { t: "ilegibles" };

// RF-VEN-10: las ventas sin enviar siempre a la vista. Los contenedores `status` están siempre montados: un lector de
// pantalla solo anuncia cambios de texto en una región que ya existía. Descartar solo con `devolver_fuera_plazo`.
export function AvisoCola({
  cola,
  sesionCaducada,
  puedeDescartar,
}: {
  cola: ColaPos;
  sesionCaducada: boolean;
  puedeDescartar: boolean;
}) {
  const { estado } = cola;
  const [descartando, setDescartando] = useState<Descarte | null>(null);
  const [revisando, setRevisando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function intentar(accion: () => Promise<void>) {
    try {
      await accion();
    } catch {
      setMensaje(MENSAJE_FALLO);
    }
  }
  // Una venta que ya llegó al servidor solo se quita de la lista; si no, se pide la confirmación escrita.
  async function pedirDescarte(v: VentaRechazada) {
    setMensaje(null);
    setRevisando(v.id);
    await intentar(async () => {
      const r = await cola.revisarDescarte(v.id);
      if (r.t === "error") setMensaje(r.mensaje);
      else if (r.t === "confirmar") setDescartando({ t: "venta", venta: v });
    });
    setRevisando(null);
  }
  const aEncargado = "Avisa al encargado: no se borra solo.";

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div role="status" aria-live="polite" className="empty:hidden">
        {estado.pendientes > 0 && (
          <p className="bg-secondary text-secondary-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
            <CloudOff className="size-4 shrink-0" aria-hidden />
            <span>
              <strong>{plural(estado.pendientes, "venta sin enviar", "ventas sin enviar")}</strong>.{" "}
              {sesionCaducada
                ? "Inicia sesión para enviarlas."
                : "Se envían solas al volver la conexión."}
            </span>
          </p>
        )}
      </div>
      <div role="status" aria-live="polite" className="empty:hidden">
        {estado.ajenas > 0 && (
          <p className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-sm">
            {plural(estado.ajenas, "venta de otro negocio", "ventas de otros negocios")} sin enviar:
            entra con la cuenta y el negocio que las hicieron.
          </p>
        )}
      </div>
      {mensaje && (
        <p
          role="alert"
          className="border-destructive text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {mensaje}
        </p>
      )}
      {estado.ilegibles > 0 && (
        <p className="border-destructive text-destructive flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 basis-48">
            {plural(estado.ilegibles, "registro dañado", "registros dañados")}
            {puedeDescartar ? "." : `. ${aEncargado}`}
          </span>
          {puedeDescartar && (
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setDescartando({ t: "ilegibles" })}
            >
              <Trash2 aria-hidden /> Descartar
            </Button>
          )}
        </p>
      )}
      {estado.rechazadas.length > 0 && (
        <section
          aria-label="Ventas rechazadas"
          className="border-destructive flex flex-col gap-2 rounded-lg border p-3"
        >
          <h2 className="text-destructive text-sm font-semibold">
            {plural(estado.rechazadas.length, "venta rechazada", "ventas rechazadas")} al enviar
          </h2>
          {!puedeDescartar && (
            <p className="text-muted-foreground text-sm">
              Para descartar una venta rechazada avisa al encargado.
            </p>
          )}
          <ul className="divide-y text-sm">
            {estado.rechazadas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium tabular-nums">{v.numero}</span>
                {v.total !== null && <span className="tabular-nums">{formatearBs(v.total)}</span>}
                <span className="text-muted-foreground min-w-0 flex-1 basis-48">{v.error}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  aria-label={`Reintentar la venta ${v.numero}`}
                  onClick={() => void intentar(() => cola.reintentar(v.id))}
                >
                  <RotateCw aria-hidden /> Reintentar
                </Button>
                {puedeDescartar && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={revisando !== null}
                    aria-label={`Descartar la venta ${v.numero}`}
                    onClick={() => void pedirDescarte(v)}
                  >
                    <Trash2 aria-hidden /> Descartar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {descartando && (
        <DescartarVenta
          titulo={
            descartando.t === "venta"
              ? `Descartar la venta ${descartando.venta.numero}`
              : "Descartar los registros dañados"
          }
          descripcion={
            descartando.t === "venta"
              ? `${descartando.venta.total !== null ? `El cliente ya pagó ${formatearBs(descartando.venta.total)}. ` : ""}Si la descartas, la venta no llegará al sistema: el stock y la caja no la reflejarán y no se puede deshacer.`
              : `Se borrarán ${plural(estado.ilegibles, "registro guardado", "registros guardados")} que no se pueden leer. Pueden ser ventas ya cobradas y no se puede deshacer.`
          }
          accion={descartando.t === "venta" ? "Descartar venta" : "Descartar registros"}
          alCancelar={() => setDescartando(null)}
          alConfirmar={() => {
            const d = descartando;
            setDescartando(null);
            void intentar(() =>
              d.t === "venta"
                ? cola.descartar(d.venta.id)
                : cola.descartarIlegibles(estado.ordenesIlegibles),
            );
          }}
        />
      )}
    </div>
  );
}
