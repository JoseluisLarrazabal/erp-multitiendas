"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { revertirConsumo } from "../actions";
import { useOperacion } from "./use-operacion";

// Revierte un consumo con un contra-movimiento (el kardex no se edita). El motivo es obligatorio.
export function BotonRevertirConsumo({ movimientoId }: { movimientoId: string }) {
  const [motivo, setMotivo] = useState("");
  // Mismo id en los reintentos de una confirmación fallida: la RPC es idempotente.
  const { operacionId } = useOperacion();
  const id = `rev-motivo-${movimientoId}`;
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label htmlFor={id} className="text-xs">
          Motivo de la reversión
        </Label>
        <Input
          id={id}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <ConfirmarAccion
        etiqueta="Revertir"
        titulo="¿Revertir este consumo?"
        descripcion="Se agrega un movimiento que devuelve la cantidad al stock y resta el gasto. El consumo original queda en el kardex."
        confirmar="Revertir consumo"
        accion={async () => {
          if (!motivo.trim()) return { ok: false, error: "El motivo es obligatorio." };
          return revertirConsumo({ operacionId, movimientoId, motivo });
        }}
      />
    </div>
  );
}
