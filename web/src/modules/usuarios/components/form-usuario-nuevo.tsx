"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { crearUsuario } from "../actions";
import { etiquetaRol, mensajeDeError } from "../domain";
import { crearUsuarioSchema } from "../schemas";
import {
  Campo,
  propsCampo,
  validarCampos,
  type Campos,
  type Errores,
} from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";

type Props = { negocioId: string; roles: readonly string[] };

const CAMPOS: Campos = {
  nombre: { id: "nuevo-nombre", mensaje: "Escribe el nombre de la persona." },
  correo: { id: "nuevo-correo", mensaje: "Escribe un correo válido, como nombre@dominio.com." },
  rol: { id: "nuevo-rol", mensaje: "Elige un rol." },
  clave: { id: "nuevo-clave", mensaje: mensajeDeError("ERP_CLAVE_DEBIL") },
};

export function FormUsuarioNuevo({ negocioId, roles }: Props) {
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
      crearUsuarioSchema,
      {
        negocioId,
        rol: datos.get("rol"),
        correo: datos.get("correo"),
        nombre: datos.get("nombre"),
        clave: datos.get("clave"),
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
    // La clave inicial viaja una vez y no se vuelve a mostrar: el formulario se limpia al terminar.
    ejecutar(
      () => crearUsuario(v.datos),
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
      className="grid gap-4 sm:grid-cols-2"
      aria-label="Cuenta nueva"
    >
      <Campo id="nuevo-nombre" etiqueta="Nombre" error={errores["nuevo-nombre"]}>
        <Input
          id="nuevo-nombre"
          name="nombre"
          autoComplete="off"
          required
          {...propsCampo("nuevo-nombre", errores)}
        />
      </Campo>
      <Campo id="nuevo-correo" etiqueta="Correo" error={errores["nuevo-correo"]}>
        <Input
          id="nuevo-correo"
          name="correo"
          type="email"
          autoComplete="off"
          required
          {...propsCampo("nuevo-correo", errores)}
        />
      </Campo>
      <Campo id="nuevo-rol" etiqueta="Rol" error={errores["nuevo-rol"]}>
        <SelectNativo
          id="nuevo-rol"
          name="rol"
          defaultValue={roles.at(-1)}
          {...propsCampo("nuevo-rol", errores)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {etiquetaRol(r)}
            </option>
          ))}
        </SelectNativo>
      </Campo>
      <Campo
        id="nuevo-clave"
        etiqueta="Contraseña inicial"
        ayuda="8 o más caracteres, con letras y dígitos. Compártela por un canal seguro; no se vuelve a mostrar."
        error={errores["nuevo-clave"]}
      >
        <Input
          id="nuevo-clave"
          name="clave"
          type="password"
          autoComplete="new-password"
          required
          {...propsCampo("nuevo-clave", errores, true)}
        />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {mensaje}
        </p>
        <p role="status" className="text-sm font-medium">
          {hecho && !mensaje
            ? "Cuenta creada. Ya puede ingresar con su correo y la contraseña inicial."
            : ""}
        </p>
        <Button type="submit" disabled={pendiente} className="self-start">
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          Crear cuenta
        </Button>
      </div>
    </form>
  );
}
