"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/components/panel/use-accion";
import { formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import { revisarCaja } from "../actions";
import { ETIQUETA_REVISION_MOVIMIENTO } from "../domain";
import type { FilaCajaRevision } from "../lecturas-panel";

function Fila({ f, alResolver }: { f: FilaCajaRevision; alResolver: (t: string) => void }) {
  const { pendiente, error, ejecutar } = useAccion();
  return (
    <li className="flex flex-col gap-3 px-4 py-4" data-testid="reco-caja">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold">{f.detalle}</span>
        <span className="font-semibold tabular-nums">{formatearBs(f.monto)}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        {formatearFechaHora(f.hora)} · {f.usuario ?? "Usuario desconocido"} ·{" "}
        {f.enviadaPor ?? "Sin conexión"}
      </p>
      <ul aria-label="Motivos de revisión" className="flex flex-wrap gap-1.5">
        {f.motivos.map((m) => (
          <li
            key={m}
            className="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-xs font-semibold"
          >
            {ETIQUETA_REVISION_MOVIMIENTO[m] ?? m}
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="min-h-9 self-start md:min-h-8"
        disabled={pendiente}
        onClick={() =>
          ejecutar(
            () => revisarCaja({ tipo: f.tipo, id: f.id }),
            () => alResolver(`${f.detalle} marcado como revisado.`),
          )
        }
      >
        {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {pendiente ? "Marcando…" : "Marcar revisado"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </li>
  );
}

export function ListaCajaPorRevisar({ filas }: { filas: readonly FilaCajaRevision[] }) {
  const [aviso, setAviso] = useState("");
  const estado = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (aviso) estado.current?.focus();
  }, [aviso]);
  return (
    <>
      <p
        ref={estado}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="text-sm font-medium outline-none empty:hidden"
      >
        {aviso}
      </p>
      {filas.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay caja por revisar.</p>
      ) : (
        <ul aria-label="Caja por revisar" className="divide-y rounded-lg border">
          {filas.map((f) => (
            <Fila key={f.tipo + f.id} f={f} alResolver={setAviso} />
          ))}
        </ul>
      )}
    </>
  );
}
