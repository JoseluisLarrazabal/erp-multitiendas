"use client";

import { HandCoins } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearDia } from "@/lib/format/fecha";
import type { Parametros } from "@/modules/creditos";
import type { FormCredito, PlanVenta } from "../credito-venta";
import { bs, textoMonto } from "../domain";

// Condiciones de una venta a crédito (RF-CRE-01 a 03): inicial, cuotas, los tres documentos y el plan antes de cobrar.
// Solo en línea. Al cobrar se cobra la inicial; el resto queda en las cuotas.
export function FormCreditoVenta({
  form,
  alCambiar,
  alAlternar,
  parametros,
  plan,
  alReintentar,
  bloqueado,
  sinRed,
  hayLineas,
}: {
  form: FormCredito;
  alCambiar: (cambios: Partial<FormCredito>) => void;
  alAlternar: (activo: boolean) => void;
  parametros: Parametros | null;
  plan: PlanVenta | null;
  alReintentar: (() => void) | null;
  bloqueado: boolean;
  sinRed: boolean;
  hayLineas: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="bg-surface flex flex-col gap-2 rounded-lg border p-3" disabled={bloqueado}>
      <legend className="sr-only">Venta a crédito</legend>
      <label className="flex min-h-11 items-center gap-2 text-base font-semibold">
        <input
          type="checkbox"
          className="size-6"
          checked={form.activo}
          disabled={sinRed}
          onChange={(e) => alAlternar(e.target.checked)}
        />
        <HandCoins className="size-4" aria-hidden /> Vender a crédito
      </label>
      {sinRed && <p className="text-muted-foreground text-sm">El crédito necesita conexión.</p>}
      {form.activo && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={`${id}-inicial`} className="text-sm">
                Inicial (Bs)
              </Label>
              <Input
                id={`${id}-inicial`}
                inputMode="decimal"
                autoComplete="off"
                className="cifra h-11 text-right"
                placeholder={plan ? textoMonto(plan.minimo) : "Mínima"}
                value={form.inicialTexto}
                onChange={(e) => alCambiar({ inicialTexto: e.target.value })}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={`${id}-cuotas`} className="text-sm">
                Cuotas{parametros ? ` (1 a ${parametros.maxCuotas})` : ""}
              </Label>
              <Input
                id={`${id}-cuotas`}
                inputMode="numeric"
                autoComplete="off"
                className="cifra h-11 text-right"
                placeholder={parametros ? String(parametros.plazoCuotas) : ""}
                value={form.cuotasTexto}
                onChange={(e) => alCambiar({ cuotasTexto: e.target.value })}
              />
            </div>
          </div>
          <div
            className="flex flex-col gap-1 text-[15px]"
            role="group"
            aria-label="Documentos del crédito"
          >
            <p className="text-muted-foreground text-sm font-medium">Documentos recibidos</p>
            {(
              [
                ["docsCi", "Cédula de identidad"],
                ["docsDomicilio", "Comprobante de domicilio"],
                ["docsPagare", "Pagaré firmado"],
              ] as const
            ).map(([clave, etiqueta]) => (
              <label key={clave} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-6"
                  checked={form[clave]}
                  onChange={(e) => alCambiar({ [clave]: e.target.checked })}
                />
                {etiqueta}
              </label>
            ))}
          </div>
          {alReintentar && hayLineas && (
            <Button
              type="button"
              variant="outline"
              className="h-11 self-start"
              onClick={alReintentar}
            >
              Reintentar el cálculo del plan
            </Button>
          )}
          {plan && hayLineas && (
            <div
              className="bg-muted rounded-lg p-2.5 text-sm tabular-nums"
              aria-label="Plan de cuotas"
            >
              <p>
                Inicial {bs(plan.inicial)} · a financiar {bs(plan.financiado)}
              </p>
              <ul className="text-muted-foreground mt-1 text-sm">
                {plan.plan.slice(0, 4).map((p) => (
                  <li key={p.fila.numero}>
                    Cuota {p.fila.numero}: {bs(p.fila.monto)} · vence {formatearDia(p.vence)}
                  </li>
                ))}
                {plan.plan.length > 4 && <li>… {plan.plan.length - 4} cuotas más</li>}
              </ul>
              <p className="text-muted-foreground mt-1 text-sm">Plan calculado por el servidor.</p>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
