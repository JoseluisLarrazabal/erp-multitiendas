"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/panel/campo";
import { cn } from "@/lib/utils";
import { diferenciaDeConteo, formatearCantidad, formatearCantidadConSigno } from "../domain";
import type { ItemContado } from "./form-conteo";
import { PieOperacion } from "./pie-operacion";
import { SelectorSeries } from "./selector-series";

// Segundo paso del conteo: lo que cambiaría, antes de confirmar. Los productos sin diferencia no generan ajuste.
export function ConteoRevision({
  negocioId,
  ubicacionId,
  items,
  pendiente,
  error,
  alVolver,
  alConfirmar,
}: {
  negocioId: string;
  ubicacionId: string;
  items: readonly ItemContado[];
  pendiente: boolean;
  error: string | null;
  alVolver: () => void;
  alConfirmar: (motivo: string, series: Record<string, string[]>) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [series, setSeries] = useState<Record<string, string[]>>({});
  const [faltan, setFaltan] = useState<string | null>(null);
  const filas = items.map((i) => ({
    ...i,
    diferencia: diferenciaDeConteo(i.producto.sistema, i.contada),
  }));
  const conDiferencia = filas.filter((f) => f.diferencia !== 0);
  const sinDiferencia = filas.length - conDiferencia.length;
  // Un faltante de un producto con serie debe decir qué series ya no están.
  const exigeSeries = (f: (typeof filas)[number]) => f.producto.controlaSerie && f.diferencia < 0;

  function confirmar() {
    const mala = conDiferencia.find(
      (f) => exigeSeries(f) && (series[f.producto.id]?.length ?? 0) !== -f.diferencia,
    );
    if (mala) {
      setFaltan(`Marca ${-mala.diferencia} serie(s) faltante(s) de ${mala.producto.nombre}.`);
      return document.getElementById(`cont-series-${mala.producto.id}`)?.focus();
    }
    setFaltan(null);
    alConfirmar(motivo, series);
  }

  return (
    <section aria-label="Revisión del conteo" className="flex flex-col gap-5">
      <p className="text-sm">
        {conDiferencia.length === 0
          ? "No hay diferencias: el conteo coincide con el sistema y no genera ajustes."
          : `${conDiferencia.length} producto(s) con diferencia generarán un ajuste.`}{" "}
        {sinDiferencia > 0 && `${sinDiferencia} contado(s) sin diferencia.`} Los productos que no
        contaste no se tocan.
      </p>
      {conDiferencia.length > 0 && (
        <ul className="bg-card divide-y rounded-xl border" aria-label="Diferencias">
          {conDiferencia.map((f) => (
            <li key={f.producto.id} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-semibold">{f.producto.nombre}</span>
                <span className="text-sm tabular-nums">
                  Sistema {formatearCantidad(f.producto.sistema, f.producto.unidad)} · Contado{" "}
                  {formatearCantidad(f.contada, f.producto.unidad)} ·{" "}
                  <strong className={cn(f.diferencia < 0 && "text-destructive")}>
                    {f.diferencia < 0 ? "Faltan " : "Sobran "}
                    {formatearCantidadConSigno(f.diferencia, f.producto.unidad)}
                  </strong>
                </span>
              </div>
              {exigeSeries(f) && (
                <SelectorSeries
                  id={`cont-series-${f.producto.id}`}
                  negocioId={negocioId}
                  productoId={f.producto.id}
                  ubicacionId={ubicacionId}
                  necesarias={-f.diferencia}
                  seleccion={series[f.producto.id] ?? []}
                  alCambiar={(ids) => setSeries((s) => ({ ...s, [f.producto.id]: ids }))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <Campo
        id="cont-motivo"
        etiqueta="Motivo (opcional)"
        ayuda="Si lo dejas vacío, queda “Conteo de inventario”."
      >
        <Input
          id="cont-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={200}
          autoComplete="off"
          className="h-10"
        />
      </Campo>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
        className="flex flex-col gap-3"
      >
        <PieOperacion
          etiqueta="Confirmar conteo"
          pendiente={pendiente}
          error={faltan ?? error}
          exito={null}
        />
        <div>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={alVolver}
            disabled={pendiente}
          >
            Volver a contar
          </Button>
        </div>
      </form>
    </section>
  );
}
