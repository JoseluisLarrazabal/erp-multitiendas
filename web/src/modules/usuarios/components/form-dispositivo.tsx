"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { registrarDispositivo } from "../actions";
import { mensajeDeError, type Ubicacion } from "../domain";
import { registrarDispositivoSchema } from "../schemas";
import { Campo, propsCampo, validarCampos, type Campos, type Errores } from "./campo";
import { useAccion } from "./use-accion";

type Props = { negocioId: string; ubicaciones: readonly Ubicacion[] };

const CAMPOS: Campos = {
  nombre: { id: "disp-nombre", mensaje: "Escribe un nombre de hasta 60 caracteres." },
  prefijo: { id: "disp-prefijo", mensaje: "Usa una letra y 1 o 2 dígitos, como C2." },
  ubicacionId: { id: "disp-ubicacion", mensaje: "Elige una ubicación." },
};

export function FormDispositivo({ negocioId, ubicaciones }: Props) {
  const formulario = useRef<HTMLFormElement>(null);
  const { pendiente, error, ejecutar } = useAccion();
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setHecho(false);
    const v = validarCampos(
      e.currentTarget,
      registrarDispositivoSchema,
      {
        negocioId,
        ubicacionId: datos.get("ubicacion"),
        nombre: datos.get("nombre"),
        prefijo: datos.get("prefijo"),
      },
      CAMPOS,
    );
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(
        Object.keys(v.errores).length ? null : mensajeDeError("ERP_DATOS_INVALIDOS"),
      );
    }
    setErrores({});
    setGeneral(null);
    ejecutar(
      () => registrarDispositivo(v.datos),
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
      className="grid gap-4 sm:grid-cols-3"
      aria-label="Dispositivo nuevo"
    >
      <Campo id="disp-nombre" etiqueta="Nombre" error={errores["disp-nombre"]}>
        <Input
          id="disp-nombre"
          name="nombre"
          required
          autoComplete="off"
          className="h-10"
          {...propsCampo("disp-nombre", errores)}
        />
      </Campo>
      <Campo
        id="disp-prefijo"
        etiqueta="Prefijo"
        ayuda="Una letra y 1 o 2 dígitos. Ej.: C2."
        error={errores["disp-prefijo"]}
      >
        <Input
          id="disp-prefijo"
          name="prefijo"
          required
          autoComplete="off"
          maxLength={3}
          className="h-10 uppercase"
          {...propsCampo("disp-prefijo", errores, true)}
        />
      </Campo>
      <Campo id="disp-ubicacion" etiqueta="Ubicación" error={errores["disp-ubicacion"]}>
        <SelectNativo
          id="disp-ubicacion"
          name="ubicacion"
          required
          {...propsCampo("disp-ubicacion", errores)}
        >
          {ubicaciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </SelectNativo>
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-3">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {mensaje}
        </p>
        <p role="status" className="text-sm font-medium">
          {hecho && !mensaje ? "Dispositivo registrado." : ""}
        </p>
        <Button type="submit" disabled={pendiente} className="h-10 self-start">
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          Registrar dispositivo
        </Button>
      </div>
    </form>
  );
}
