"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectNativo } from "@/components/ui/select-nativo";
import { asignarUsuario } from "../actions";
import { etiquetaRol, mensajeDeError, type PersonaExterna } from "../domain";
import { asignarUsuarioSchema } from "../schemas";
import { Campo, propsCampo, validarCampos, type Campos, type Errores } from "./campo";
import { useAccion } from "./use-accion";

type Props = { negocioId: string; roles: readonly string[]; personas: readonly PersonaExterna[] };

const CAMPOS: Campos = {
  usuarioId: { id: "existente-persona", mensaje: "Elige una persona." },
  rol: { id: "existente-rol", mensaje: "Elige un rol." },
};

// P-15: el personal se comparte entre negocios; aquí se suma a alguien que ya tiene cuenta.
export function FormPersonaExistente({ negocioId, roles, personas }: Props) {
  const { pendiente, error, ejecutar } = useAccion();
  const [hecho, setHecho] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setHecho(false);
    const v = validarCampos(
      e.currentTarget,
      asignarUsuarioSchema,
      {
        negocioId,
        usuarioId: datos.get("persona"),
        rol: datos.get("rol"),
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
      () => asignarUsuario(v.datos),
      () => setHecho(true),
    );
  }

  const mensaje = general ?? error;
  return (
    <div className="flex flex-col gap-2">
      {personas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay personas de tus otros negocios por agregar.
        </p>
      ) : (
        <form
          onSubmit={enviar}
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          aria-label="Persona de otro negocio"
        >
          <Campo id="existente-persona" etiqueta="Persona" error={errores["existente-persona"]}>
            <SelectNativo
              id="existente-persona"
              name="persona"
              required
              {...propsCampo("existente-persona", errores)}
            >
              {personas.map((p) => (
                <option key={p.usuarioId} value={p.usuarioId}>
                  {p.nombre}
                </option>
              ))}
            </SelectNativo>
          </Campo>
          <Campo id="existente-rol" etiqueta="Rol en este negocio" error={errores["existente-rol"]}>
            <SelectNativo
              id="existente-rol"
              name="rol"
              defaultValue={roles.at(-1)}
              {...propsCampo("existente-rol", errores)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {etiquetaRol(r)}
                </option>
              ))}
            </SelectNativo>
          </Campo>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <p role="alert" className="text-destructive text-sm empty:hidden">
              {mensaje}
            </p>
            <Button
              type="submit"
              variant="secondary"
              disabled={pendiente}
              className="h-10 self-start"
            >
              {pendiente && <Loader2 className="animate-spin" aria-hidden />}
              Agregar al negocio
            </Button>
          </div>
        </form>
      )}
      {/* Fuera del formulario: sigue ahí aunque la lista quede vacía al agregar a la última persona. */}
      <p role="status" className="text-sm font-medium">
        {hecho && !mensaje ? "Persona agregada al negocio." : ""}
      </p>
    </div>
  );
}
