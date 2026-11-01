"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Campo,
  propsCampo,
  validarCampos,
  type Campos,
  type Errores,
} from "@/components/panel/campo";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { useAccion } from "@/components/panel/use-accion";
import { registrarTipoCambio } from "../actions";
import { cambioBruscoDeTipoCambio, formatearTipoCambio, MENSAJE_DATOS } from "../domain";
import { tipoCambioSchema } from "../schemas";

const CAMPOS: Campos = {
  valor: {
    id: "tc-valor",
    mensaje: "Escribe un número mayor a 0, con hasta 4 decimales. Ej.: 6,96.",
  },
};

export function FormTipoCambio({
  negocioId,
  vigente,
}: {
  negocioId: string;
  vigente: number | null;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const { pendiente, error, ejecutar } = useAccion();
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  // Valor (texto crudo y número) que se aleja mucho del vigente y espera confirmación.
  const [porConfirmar, setPorConfirmar] = useState<{ texto: string; valor: number } | null>(null);

  const registrar = (texto: string) => registrarTipoCambio({ negocioId, valor: texto });
  const alRegistrado = () => {
    formulario.current?.reset();
    setHecho(true);
  };

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHecho(false);
    const entrada = { negocioId, valor: new FormData(e.currentTarget).get("valor") };
    const v = validarCampos(e.currentTarget, tipoCambioSchema, entrada, CAMPOS);
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    setGeneral(null);
    // Un dedazo (69,6 en vez de 6,96) cambia todos los Bs: se confirma antes de registrar.
    if (cambioBruscoDeTipoCambio(vigente, v.datos.valor)) {
      return setPorConfirmar({ texto: String(entrada.valor), valor: v.datos.valor });
    }
    ejecutar(() => registrar(String(entrada.valor)), alRegistrado);
  }

  const mensaje = general ?? error;
  return (
    <form
      ref={formulario}
      onSubmit={enviar}
      noValidate
      aria-label="Tipo de cambio nuevo"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 sm:max-w-64">
          <Campo
            id="tc-valor"
            etiqueta="Bs por 1 USD"
            ayuda="Rige desde que lo registras."
            error={errores["tc-valor"]}
          >
            <Input
              id="tc-valor"
              name="valor"
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="6,96"
              className="h-10"
              {...propsCampo("tc-valor", errores, true)}
            />
          </Campo>
        </div>
        <Button type="submit" disabled={pendiente} className="h-10 self-start sm:mt-[1.375rem]">
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          Registrar tipo de cambio
        </Button>
        <p className="text-muted-foreground self-start text-sm sm:mt-[1.375rem] sm:leading-10">
          {vigente === null ? (
            "Aún no hay tipo de cambio vigente."
          ) : (
            <>
              Vigente:{" "}
              <strong className="text-foreground">Bs {formatearTipoCambio(vigente)}</strong>
            </>
          )}
        </p>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {mensaje}
      </p>
      <p role="status" className="text-sm font-medium">
        {hecho && !mensaje ? "Tipo de cambio registrado." : ""}
      </p>
      <ConfirmarAccion
        abierto={porConfirmar !== null}
        alCambiarAbierto={(abierto) => !abierto && setPorConfirmar(null)}
        titulo={`¿Registrar Bs ${porConfirmar ? formatearTipoCambio(porConfirmar.valor) : ""} por 1 USD?`}
        descripcion={`El tipo de cambio vigente es Bs ${vigente === null ? "" : formatearTipoCambio(vigente)}. El nuevo valor cambia el equivalente en Bs de todos los precios en USD.`}
        confirmar="Registrar"
        destructiva={false}
        accion={async () => {
          const r = await registrar(porConfirmar?.texto ?? "");
          if (r.ok) alRegistrado();
          return r;
        }}
      />
    </form>
  );
}
