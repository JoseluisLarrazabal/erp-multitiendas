"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Campo } from "@/components/panel/campo";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { anularPagoCuota } from "../actions";

export type EquipoAbierto = { dispositivoId: string; nombre: string; sesionId: string };

// Anula el último pago de cuota con un contraasiento. El efectivo que se devuelve sale de la caja abierta que se elija (puede ser
// otra distinta de la del cobro); el servidor decide permiso, último pago y efectivo suficiente.
export function AnularPagoCuota({
  pagoOperacionId,
  descripcionPago,
  equipos,
}: {
  pagoOperacionId: string;
  descripcionPago: string;
  equipos: readonly EquipoAbierto[];
}) {
  const [motivo, setMotivo] = useState("");
  const [equipoId, setEquipoId] = useState(equipos[0]?.dispositivoId ?? "");
  // Un id por intento: repetir la confirmación tras un corte devuelve lo original; cambiar caja o motivo es otro intento.
  const intento = useRef<{ clave: string; id: string } | null>(null);
  const equipo = equipos.find((e) => e.dispositivoId === equipoId) ?? equipos[0];

  if (!equipo) {
    return (
      <section aria-label="Anular último pago" className="bg-card rounded-xl border p-4 text-sm">
        <p className="text-muted-foreground">
          Para anular el último pago hace falta una caja abierta: el efectivo sale de ella. Abre una
          en el punto de venta.
        </p>
      </section>
    );
  }
  const accion = () => {
    const clave = `${pagoOperacionId}|${equipo.sesionId}|${motivo.trim()}`;
    if (intento.current?.clave !== clave) intento.current = { clave, id: crypto.randomUUID() };
    return anularPagoCuota({
      operacionId: intento.current.id,
      pagoOperacionId,
      sesionId: equipo.sesionId,
      dispositivoId: equipo.dispositivoId,
      motivo,
    });
  };
  return (
    <section
      aria-label="Anular último pago"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <p className="text-sm">
        Último pago: <strong>{descripcionPago}</strong>. Anularlo deja un contraasiento (el pago
        queda marcado como anulado, no se borra) y devuelve el saldo al crédito.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="anular-pago-equipo"
          etiqueta="Caja que devuelve el efectivo"
          ayuda="Debe ser una caja abierta con efectivo suficiente."
        >
          <SelectNativo
            id="anular-pago-equipo"
            value={equipo.dispositivoId}
            onChange={(e) => setEquipoId(e.target.value)}
          >
            {equipos.map((e) => (
              <option key={e.dispositivoId} value={e.dispositivoId}>
                {e.nombre}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo id="anular-pago-motivo" etiqueta="Motivo de la anulación">
          <Input
            id="anular-pago-motivo"
            autoComplete="off"
            maxLength={200}
            className="h-10"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>
      </div>
      <ConfirmarAccion
        etiqueta="Anular último pago"
        titulo="¿Anular el último pago?"
        descripcion={`Se anula ${descripcionPago}. El saldo del crédito sube en ese monto. No se puede deshacer.`}
        confirmar="Anular pago"
        destructiva
        deshabilitado={motivo.trim() === ""}
        accion={accion}
      />
    </section>
  );
}
