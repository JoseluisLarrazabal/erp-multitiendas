"use client";

import { CloudOff, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatearBs } from "@/lib/format/moneda";
import { TIPO_VENTA } from "../cola-ventas";
import type { ColaPos, OperacionRechazada, Pendientes } from "../use-cola";
import { DescartarVenta } from "./descartar-venta";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const MENSAJE_CAMBIO = "La venta ya no estaba rechazada, así que no se descartó. Revisa la lista.";
const MENSAJE_FALLO = "No se pudo completar la acción en este equipo. Recarga la página.";

// "1 venta, 2 movimientos de caja y 1 apertura de caja": las ventas conservan su texto de siempre ("2 ventas").
function textoPendientes(p: Pendientes): string {
  const partes = [
    p.ventas > 0 && plural(p.ventas, "venta", "ventas"),
    p.aperturas > 0 && plural(p.aperturas, "apertura de caja", "aperturas de caja"),
    p.movimientos > 0 && plural(p.movimientos, "movimiento de caja", "movimientos de caja"),
  ].filter((t): t is string => t !== false);
  const ultimo = partes.pop();
  return `${partes.length > 0 ? `${partes.join(", ")} y ` : ""}${ultimo}`;
}

type Descarte = { t: "venta"; venta: OperacionRechazada } | { t: "ilegibles" };

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
  // shortcut: la apertura y los movimientos rechazados piden confirmación sin comprobar antes si ya llegaron al
  // servidor; un rechazo con código ERP_ significa que no se guardó. Si hace falta, existencia por id como en las ventas.
  async function pedirDescarte(v: OperacionRechazada) {
    setMensaje(null);
    if (v.tipo !== TIPO_VENTA) return setDescartando({ t: "venta", venta: v });
    setRevisando(v.id);
    await intentar(async () => {
      const r = await cola.revisarDescarte(v.id);
      if (r.t === "error") setMensaje(r.mensaje);
      else if (r.t === "confirmar") setDescartando({ t: "venta", venta: v });
    });
    setRevisando(null);
  }
  const etiqueta = (v: OperacionRechazada) =>
    v.tipo === TIPO_VENTA ? `la venta ${v.titulo}` : v.titulo.toLowerCase();
  const aEncargado = "Avisa al encargado: no se borra solo.";

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div role="status" aria-live="polite" className="empty:hidden">
        {estado.pendientes.ventas + estado.pendientes.aperturas + estado.pendientes.movimientos >
          0 && (
          <p className="border-warning-line bg-warning-soft text-warning flex items-center gap-2 rounded-lg border px-3 py-3 text-[15px]">
            <CloudOff className="size-4 shrink-0" aria-hidden />
            <span>
              <strong>{textoPendientes(estado.pendientes)} sin enviar</strong>.{" "}
              {sesionCaducada
                ? "Inicia sesión para enviarlas."
                : "Se envían solas al volver la conexión."}
            </span>
          </p>
        )}
      </div>
      <div role="status" aria-live="polite" className="empty:hidden">
        {estado.ajenas > 0 && (
          <p className="border-warning-line bg-warning-soft text-warning rounded-lg border px-3 py-3 text-[15px]">
            {plural(estado.ajenas, "operación de otro negocio", "operaciones de otros negocios")}{" "}
            sin enviar: entra con la cuenta y el negocio que las hicieron.
          </p>
        )}
      </div>
      {mensaje && (
        <p
          role="alert"
          className="border-destructive bg-destructive-soft text-destructive rounded-lg border px-3 py-3 text-sm font-medium"
        >
          {mensaje}
        </p>
      )}
      {estado.ilegibles > 0 && (
        <p className="border-destructive bg-destructive-soft text-destructive flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-3 text-sm font-medium">
          <span className="min-w-0 flex-1 basis-48">
            {plural(estado.ilegibles, "registro dañado", "registros dañados")}
            {puedeDescartar ? "." : `. ${aEncargado}`}
          </span>
          {puedeDescartar && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setDescartando({ t: "ilegibles" })}
            >
              <Trash2 aria-hidden /> Descartar
            </Button>
          )}
        </p>
      )}
      {estado.rechazadas.length > 0 && (
        <section
          aria-label="Operaciones rechazadas"
          className="border-destructive bg-destructive-soft flex flex-col gap-2 rounded-lg border p-3"
        >
          <h2 className="text-destructive text-sm font-semibold">
            {plural(estado.rechazadas.length, "operación rechazada", "operaciones rechazadas")} al
            enviar
          </h2>
          {!puedeDescartar && (
            <p className="text-foreground text-sm">
              Para descartar una operación rechazada avisa al encargado.
            </p>
          )}
          <ul className="divide-destructive/20 divide-y text-sm">
            {estado.rechazadas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="cifra text-[15px]">{v.titulo}</span>
                {v.total !== null && (
                  <span className="cifra text-[15px]">{formatearBs(v.total)}</span>
                )}
                <span className="text-foreground min-w-0 flex-1 basis-48">{v.error}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={
                    revisando !== null ||
                    (descartando?.t === "venta" && descartando.venta.id === v.id)
                  }
                  aria-label={`Reintentar ${etiqueta(v)}`}
                  onClick={() => void intentar(() => cola.reintentar(v.id))}
                >
                  <RotateCw aria-hidden /> Reintentar
                </Button>
                {puedeDescartar && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={revisando !== null}
                    aria-label={`Descartar ${etiqueta(v)}`}
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
              ? descartando.venta.tipo === TIPO_VENTA
                ? `Descartar la venta ${descartando.venta.titulo}`
                : `Descartar: ${descartando.venta.titulo}`
              : "Descartar los registros dañados"
          }
          descripcion={
            descartando.t === "venta"
              ? descartando.venta.tipo === TIPO_VENTA
                ? `${descartando.venta.total !== null ? `El cliente ya pagó ${formatearBs(descartando.venta.total)}. ` : ""}Si la descartas, la venta no llegará al sistema: el stock y la caja no la reflejarán y no se puede deshacer.`
                : `Si la descartas, ${descartando.venta.titulo.toLowerCase()} no llegará al sistema y la caja no lo reflejará. No se puede deshacer.`
              : `Se borrarán ${plural(estado.ilegibles, "registro guardado", "registros guardados")} que no se pueden leer. Pueden ser ventas ya cobradas y no se puede deshacer.`
          }
          accion={
            descartando.t === "venta"
              ? descartando.venta.tipo === TIPO_VENTA
                ? "Descartar venta"
                : "Descartar"
              : "Descartar registros"
          }
          alCancelar={() => setDescartando(null)}
          alConfirmar={() => {
            const d = descartando;
            setDescartando(null);
            void intentar(async () => {
              if (d.t === "ilegibles") return cola.descartarIlegibles(estado.ordenesIlegibles);
              if (!(await cola.descartar(d.venta.id))) setMensaje(MENSAJE_CAMBIO);
            });
          }}
        />
      )}
    </div>
  );
}
