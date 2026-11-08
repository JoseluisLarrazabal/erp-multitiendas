"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Campo, propsCampo } from "@/components/panel/campo";
import { formatearBs, parsearMonto } from "@/lib/format/moneda";
import { useOperacion } from "@/modules/inventario/panel-cliente";
import { pagarProveedor } from "../actions";
import { ETIQUETA_MEDIO, MEDIOS_PAGO, type MedioPago } from "../domain";
import type { FilaProveedor } from "../queries";

// Pago a un proveedor: no pasa por la caja del POS (plan fase 7, decisión 4).
export function FormPago({
  negocioId,
  proveedor,
  alTerminar,
}: {
  negocioId: string;
  proveedor: FilaProveedor;
  alTerminar: () => void;
}) {
  const { operacionId, pendiente, error, enviar } = useOperacion();
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [errorMonto, setErrorMonto] = useState<string | null>(null);
  const id = `pago-${proveedor.id}`;

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const centavos = parsearMonto(monto);
    if (!centavos) return setErrorMonto("Escribe un monto mayor a 0, con hasta 2 decimales.");
    if (centavos > Math.round(proveedor.deuda * 100))
      return setErrorMonto(`El monto supera la deuda (${formatearBs(proveedor.deuda)}).`);
    setErrorMonto(null);
    enviar(
      (op) =>
        pagarProveedor({ operacionId: op, negocioId, proveedorId: proveedor.id, monto, medio }),
      alTerminar,
    );
  }

  return (
    <form
      onSubmit={alEnviar}
      noValidate
      aria-label={`Registrar pago a ${proveedor.nombre}`}
      data-operacion={operacionId}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Campo
        id={`${id}-monto`}
        etiqueta="Monto en Bs"
        ayuda={`Deuda actual: ${formatearBs(proveedor.deuda)}.`}
        error={errorMonto ?? undefined}
      >
        <Input
          id={`${id}-monto`}
          inputMode="decimal"
          autoComplete="off"
          className="h-10"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          {...propsCampo(`${id}-monto`, errorMonto ? { [`${id}-monto`]: errorMonto } : {}, true)}
        />
      </Campo>
      <Campo id={`${id}-medio`} etiqueta="Medio">
        <SelectNativo
          id={`${id}-medio`}
          value={medio}
          onChange={(e) => setMedio(e.target.value as MedioPago)}
        >
          {MEDIOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {ETIQUETA_MEDIO[m]}
            </option>
          ))}
        </SelectNativo>
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {error}
        </p>
        <div className="flex gap-2">
          <Button type="submit" disabled={pendiente} className="h-10">
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            Registrar pago
          </Button>
          <Button type="button" variant="outline" className="h-10" onClick={alTerminar}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}
