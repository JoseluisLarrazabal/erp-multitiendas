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
import { guardarCategoria } from "../actions";
import { MENSAJE_DATOS } from "../domain";
import { categoriaSchema } from "../schemas";

type Props = {
  negocioId: string;
  // Con `id` renombra esa categoría; sin él, crea una.
  categoria?: { id: string; nombre: string };
  alTerminar?: () => void;
};

const CAMPOS: Campos = {
  nombre: { id: "categoria-nombre", mensaje: "Escribe un nombre de hasta 80 caracteres." },
};

export function FormCategoria({ negocioId, categoria, alTerminar }: Props) {
  const formulario = useRef<HTMLFormElement>(null);
  const { pendiente, error, ejecutar } = useAccion();
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const idCampo = categoria ? `categoria-nombre-${categoria.id}` : "categoria-nombre";

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHecho(false);
    const entrada = {
      negocioId,
      id: categoria?.id ?? null,
      nombre: new FormData(e.currentTarget).get("nombre"),
    };
    const v = validarCampos(e.currentTarget, categoriaSchema, entrada, {
      nombre: { ...CAMPOS.nombre!, id: idCampo },
    });
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    setGeneral(null);
    ejecutar(
      () => guardarCategoria(entrada),
      () => {
        if (!categoria) formulario.current?.reset();
        setHecho(true);
        alTerminar?.();
      },
    );
  }

  const mensaje = general ?? error;
  return (
    <form
      ref={formulario}
      onSubmit={enviar}
      noValidate
      className="flex flex-col gap-2"
      aria-label={categoria ? `Renombrar ${categoria.nombre}` : "Categoría nueva"}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Campo
            id={idCampo}
            etiqueta={categoria ? "Nombre" : "Nombre de la categoría"}
            error={errores[idCampo]}
          >
            <Input
              id={idCampo}
              name="nombre"
              required
              defaultValue={categoria?.nombre}
              autoComplete="off"
              className="h-10"
              {...propsCampo(idCampo, errores)}
            />
          </Campo>
        </div>
        <Button
          type="submit"
          disabled={pendiente}
          className="h-10"
          variant={categoria ? "outline" : "default"}
        >
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          {categoria ? "Renombrar" : "Crear categoría"}
        </Button>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {mensaje}
      </p>
      <p role="status" className="text-sm font-medium">
        {hecho && !mensaje ? (categoria ? "Categoría renombrada." : "Categoría creada.") : ""}
      </p>
    </form>
  );
}
