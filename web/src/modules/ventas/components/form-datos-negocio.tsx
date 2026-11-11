"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo, validarCampos, type Campos } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { guardarDatosNegocio } from "../actions";
import { datosNegocioSchema } from "../schemas-panel";

const CAMPOS: Campos = {
  nit: { id: "neg-nit", mensaje: "El NIT admite hasta 20 caracteres, en una sola línea." },
  datosNota: {
    id: "neg-nota",
    mensaje: "La nota admite hasta 300 caracteres y 6 líneas.",
  },
};

export function FormDatosNegocio({
  negocioId,
  nit,
  datosNota,
}: {
  negocioId: string;
  nit: string | null;
  datosNota: string | null;
}) {
  const { pendiente, error, ejecutar } = useAccion();
  const [textoNit, setTextoNit] = useState(nit ?? "");
  const [textoNota, setTextoNota] = useState(datosNota ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [hecho, setHecho] = useState(false);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHecho(false);
    const r = validarCampos(
      e.currentTarget,
      datosNegocioSchema,
      { negocioId, nit: textoNit, datosNota: textoNota },
      CAMPOS,
    );
    if ("errores" in r) return setErrores(r.errores);
    setErrores({});
    ejecutar(
      () => guardarDatosNegocio({ negocioId, nit: textoNit, datosNota: textoNota }),
      () => setHecho(true),
    );
  }
  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Datos del negocio"
      className="flex flex-col gap-4"
    >
      <Campo id="neg-nit" etiqueta="NIT" error={errores["neg-nit"]}>
        <Input
          id="neg-nit"
          autoComplete="off"
          className="sm:max-w-64"
          value={textoNit}
          onChange={(e) => setTextoNit(e.target.value)}
          {...propsCampo("neg-nit", errores)}
        />
      </Campo>
      <Campo
        id="neg-nota"
        etiqueta="Datos para la nota"
        ayuda="Dirección y teléfono. Sale impreso en la nota de venta y en la boleta."
        error={errores["neg-nota"]}
      >
        <textarea
          id="neg-nota"
          value={textoNota}
          onChange={(e) => setTextoNota(e.target.value)}
          rows={4}
          autoComplete="off"
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring aria-invalid:border-destructive w-full rounded-lg border px-3 py-2 text-base outline-none focus-visible:ring-3 md:text-sm"
          {...propsCampo("neg-nota", errores, true)}
        />
      </Campo>
      <div>
        <Button type="submit" disabled={pendiente}>
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          Guardar datos
        </Button>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {error}
      </p>
      <p role="status" className="text-sm font-medium">
        {hecho && !error ? "Datos guardados." : ""}
      </p>
    </form>
  );
}
