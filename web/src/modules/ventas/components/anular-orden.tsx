"use client";

import { useState, type FormEvent } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo } from "@/components/panel/campo";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { anularOrden } from "../actions-ordenes";

// Anular exige motivo y confirmación. El servidor decide permiso, estado y si la caja sigue abierta.
export function AnularOrden({ ordenId, numero }: { ordenId: string; numero: string }) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  function pedir(e: FormEvent) {
    e.preventDefault();
    if (motivo.trim() === "") return setError("Escribe el motivo de la anulación.");
    setError(null);
    setConfirmando(true);
  }

  return (
    <form onSubmit={pedir} noValidate aria-label="Anular orden" className="flex flex-col gap-3">
      <Campo
        id="anular-orden-motivo"
        etiqueta="Motivo de la anulación"
        ayuda="Si la caja de la orden sigue abierta, se devuelve el efectivo cobrado."
        error={error ?? undefined}
      >
        <Input
          id="anular-orden-motivo"
          autoComplete="off"
          maxLength={200}
          className="h-10"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          {...propsCampo(
            "anular-orden-motivo",
            error ? { "anular-orden-motivo": error } : {},
            true,
          )}
        />
      </Campo>
      <Button type="submit" variant="outline" className="text-destructive h-10 self-start">
        <Ban aria-hidden /> Anular orden
      </Button>
      <ConfirmarAccion
        abierto={confirmando}
        alCambiarAbierto={setConfirmando}
        titulo={`¿Anular la orden ${numero}?`}
        descripcion="La orden queda cancelada. No se puede deshacer."
        confirmar="Anular orden"
        focoFinal={() => document.getElementById("detalle-estado")}
        accion={() => anularOrden({ ordenId, motivo })}
      />
    </form>
  );
}
