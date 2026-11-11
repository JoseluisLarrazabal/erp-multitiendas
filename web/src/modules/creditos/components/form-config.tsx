"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Campo, propsCampo } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guardarCreditoConfig } from "../actions";
import { MAX_CUOTAS } from "../domain";
import type { Parametros } from "../schemas";
import { configSchema } from "../schemas";

const texto = (n: number) => String(n).replace(".", ",");

// Parámetros del crédito del negocio (RF-CRE-01). Rigen las ventas nuevas; los créditos ya creados conservan los suyos.
export function FormConfigCredito({
  negocioId,
  parametros,
}: {
  negocioId: string;
  parametros: Parametros;
}) {
  const { pendiente, error, ejecutar } = useAccion();
  const [inicialPct, setInicial] = useState(texto(parametros.inicialPct));
  const [interesPct, setInteres] = useState(texto(parametros.interesMensualPct));
  const [plazoCuotas, setPlazo] = useState(String(parametros.plazoCuotas));
  const [maxCuotas, setMax] = useState(String(parametros.maxCuotas));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [hecho, setHecho] = useState(false);

  function enviar(e: FormEvent) {
    e.preventDefault();
    setHecho(false);
    const datos = { negocioId, inicialPct, interesPct, plazoCuotas, maxCuotas };
    const r = configSchema.safeParse(datos);
    if (!r.success) {
      const rotos = new Set(r.error.issues.map((i) => String(i.path[0])));
      return setErrores({
        ...(rotos.has("inicialPct") && {
          inicial: "Un porcentaje mayor a 0 y hasta 99,99, con hasta 2 decimales.",
        }),
        ...(rotos.has("interesPct") && {
          interes: "Un porcentaje de 0 a 100 con hasta 2 decimales.",
        }),
        ...(rotos.has("maxCuotas") && { max: `Un entero de 1 a ${MAX_CUOTAS}.` }),
        ...(rotos.has("plazoCuotas") && {
          plazo: `Un entero de 1 hasta el máximo (${MAX_CUOTAS} como tope).`,
        }),
      });
    }
    setErrores({});
    ejecutar(
      () => guardarCreditoConfig(datos),
      () => setHecho(true),
    );
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Parámetros del crédito"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Campo id="cfg-inicial" etiqueta="Inicial mínima (%)" error={errores.inicial}>
        <Input
          id="cfg-inicial"
          inputMode="decimal"
          autoComplete="off"
          value={inicialPct}
          onChange={(e) => setInicial(e.target.value)}
          {...propsCampo("cfg-inicial", errores.inicial ? { "cfg-inicial": errores.inicial } : {})}
        />
      </Campo>
      <Campo id="cfg-interes" etiqueta="Interés mensual (%)" error={errores.interes}>
        <Input
          id="cfg-interes"
          inputMode="decimal"
          autoComplete="off"
          value={interesPct}
          onChange={(e) => setInteres(e.target.value)}
          {...propsCampo("cfg-interes", errores.interes ? { "cfg-interes": errores.interes } : {})}
        />
      </Campo>
      <Campo id="cfg-plazo" etiqueta="Cuotas por defecto" error={errores.plazo}>
        <Input
          id="cfg-plazo"
          inputMode="numeric"
          autoComplete="off"
          value={plazoCuotas}
          onChange={(e) => setPlazo(e.target.value)}
          {...propsCampo("cfg-plazo", errores.plazo ? { "cfg-plazo": errores.plazo } : {})}
        />
      </Campo>
      <Campo
        id="cfg-max"
        etiqueta="Máximo de cuotas"
        ayuda="Frecuencia mensual."
        error={errores.max}
      >
        <Input
          id="cfg-max"
          inputMode="numeric"
          autoComplete="off"
          value={maxCuotas}
          onChange={(e) => setMax(e.target.value)}
          {...propsCampo("cfg-max", errores.max ? { "cfg-max": errores.max } : {}, true)}
        />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {error}
        </p>
        <p role="status" className="text-sm font-medium empty:hidden">
          {hecho ? "Parámetros guardados." : ""}
        </p>
        <div>
          <Button type="submit" disabled={pendiente}>
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            Guardar parámetros
          </Button>
        </div>
      </div>
    </form>
  );
}
