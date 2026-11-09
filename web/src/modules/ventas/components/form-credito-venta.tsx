"use client";

import { HandCoins } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fechaCorta, type Parametros } from "@/modules/creditos";
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
  bloqueado,
  sinRed,
  hayLineas,
}: {
  form: FormCredito;
  alCambiar: (cambios: Partial<FormCredito>) => void;
  alAlternar: (activo: boolean) => void;
  parametros: Parametros | null;
  plan: PlanVenta | null;
  bloqueado: boolean;
  sinRed: boolean;
  hayLineas: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-2.5" disabled={bloqueado}>
      <legend className="sr-only">Venta a crédito</legend>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5"
          checked={form.activo}
          disabled={sinRed}
          onChange={(e) => alAlternar(e.target.checked)}
        />
        <HandCoins className="size-4" aria-hidden /> Vender a crédito
      </label>
      {sinRed && <p className="text-muted-foreground text-xs">El crédito necesita conexión.</p>}
      {form.activo && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-inicial`} className="text-xs">
                Inicial (Bs)
              </Label>
              <Input
                id={`${id}-inicial`}
                inputMode="decimal"
                autoComplete="off"
                className="h-10 text-right tabular-nums"
                placeholder={plan ? textoMonto(plan.minimo) : "Mínima"}
                value={form.inicialTexto}
                onChange={(e) => alCambiar({ inicialTexto: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-cuotas`} className="text-xs">
                Cuotas{parametros ? ` (1 a ${parametros.maxCuotas})` : ""}
              </Label>
              <Input
                id={`${id}-cuotas`}
                inputMode="numeric"
                autoComplete="off"
                className="h-10 text-right tabular-nums"
                placeholder={parametros ? String(parametros.plazoCuotas) : ""}
                value={form.cuotasTexto}
                onChange={(e) => alCambiar({ cuotasTexto: e.target.value })}
              />
            </div>
          </div>
          <div
            className="flex flex-col gap-1 text-sm"
            role="group"
            aria-label="Documentos del crédito"
          >
            <p className="text-muted-foreground text-xs">Documentos recibidos</p>
            {(
              [
                ["docsCi", "Cédula de identidad"],
                ["docsDomicilio", "Comprobante de domicilio"],
                ["docsPagare", "Pagaré firmado"],
              ] as const
            ).map(([clave, etiqueta]) => (
              <label key={clave} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={form[clave]}
                  onChange={(e) => alCambiar({ [clave]: e.target.checked })}
                />
                {etiqueta}
              </label>
            ))}
          </div>
          {plan && hayLineas && (
            <div
              className="bg-muted rounded-lg p-2.5 text-sm tabular-nums"
              aria-label="Plan de cuotas"
            >
              <p>
                Inicial {bs(plan.inicial)} · a financiar {bs(plan.financiado)}
              </p>
              <ul className="text-muted-foreground mt-1 text-xs">
                {plan.plan.slice(0, 4).map((p) => (
                  <li key={p.fila.numero}>
                    Cuota {p.fila.numero}: {bs(p.fila.monto)} · vence {fechaCorta(p.vence)}
                  </li>
                ))}
                {plan.plan.length > 4 && <li>… {plan.plan.length - 4} cuotas más</li>}
              </ul>
              <p className="text-muted-foreground mt-1 text-xs">
                Referencia: el plan definitivo lo fija el servidor al cobrar.
              </p>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
