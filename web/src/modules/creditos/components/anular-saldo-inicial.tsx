"use client";

import { useState } from "react";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { anularCreditoInicial } from "../actions";

// Anula un saldo inicial cargado por error: solo si no tiene pagos. El motivo queda en el crédito.
export function AnularSaldoInicial({ creditoId }: { creditoId: string }) {
  const [motivo, setMotivo] = useState("");
  // Un id por intento: repetir la confirmación tras un corte devuelve lo original.
  const [operacionId] = useState(() => crypto.randomUUID());
  return (
    <section
      aria-label="Anular saldo inicial"
      className="bg-card shadow-card flex flex-wrap items-end gap-3 rounded-xl border p-5"
    >
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="anular-motivo">Motivo de la anulación</Label>
        <Input
          id="anular-motivo"
          autoComplete="off"
          maxLength={200}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </div>
      <ConfirmarAccion
        etiqueta="Anular saldo inicial"
        titulo="¿Anular este saldo inicial?"
        descripcion="El crédito sale de las cuentas por cobrar. Solo se puede mientras no tenga pagos. No se puede deshacer."
        confirmar="Anular saldo inicial"
        destructiva
        deshabilitado={motivo.trim() === ""}
        accion={() => anularCreditoInicial({ operacionId, creditoId, motivo })}
      />
    </section>
  );
}
