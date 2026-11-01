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
import { useAccion } from "@/components/panel/use-accion";
import { registrarTipoCambio } from "../actions";
import { MENSAJE_DATOS } from "../domain";
import { tipoCambioSchema } from "../schemas";

const CAMPOS: Campos = {
  valor: {
    id: "tc-valor",
    mensaje: "Escribe un número mayor a 0, con hasta 4 decimales. Ej.: 6,96.",
  },
};

export function FormTipoCambio({ negocioId }: { negocioId: string }) {
  const formulario = useRef<HTMLFormElement>(null);
  const { pendiente, error, ejecutar } = useAccion();
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

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
    ejecutar(
      () => registrarTipoCambio(entrada),
      () => {
        formulario.current?.reset();
        setHecho(true);
      },
    );
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
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {mensaje}
      </p>
      <p role="status" className="text-sm font-medium">
        {hecho && !mensaje ? "Tipo de cambio registrado." : ""}
      </p>
    </form>
  );
}
