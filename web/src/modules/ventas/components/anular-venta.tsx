"use client";

import { useState, type FormEvent } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo } from "@/components/panel/campo";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { anularVenta } from "../actions";

// Anular exige motivo y confirmación. El servidor decide permiso, plazo y estado de la caja.
export function AnularVenta({ ventaId, numero }: { ventaId: string; numero: string }) {
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
    <form onSubmit={pedir} noValidate aria-label="Anular venta" className="flex flex-col gap-3">
      <Campo
        id="anular-motivo"
        etiqueta="Motivo de la anulación"
        ayuda="Devuelve el stock y quita la venta del efectivo esperado de su caja."
        error={error ?? undefined}
      >
        <Input
          id="anular-motivo"
          autoComplete="off"
          maxLength={200}
          className="h-10"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          {...propsCampo("anular-motivo", error ? { "anular-motivo": error } : {}, true)}
        />
      </Campo>
      <Button type="submit" variant="outline" className="text-destructive h-10 self-start">
        <Ban aria-hidden /> Anular venta
      </Button>
      <ConfirmarAccion
        abierto={confirmando}
        alCambiarAbierto={setConfirmando}
        titulo={`¿Anular la venta ${numero}?`}
        descripcion="La venta queda anulada y el stock vuelve al inventario. No se puede deshacer."
        confirmar="Anular venta"
        focoFinal={() => document.getElementById("detalle-estado")}
        accion={() => anularVenta({ ventaId, motivo })}
      />
    </form>
  );
}
