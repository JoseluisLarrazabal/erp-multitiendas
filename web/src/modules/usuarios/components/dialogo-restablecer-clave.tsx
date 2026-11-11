"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { restablecerClave } from "../actions";
import { mensajeDeError } from "../domain";
import { restablecerClaveSchema } from "../schemas";

const CAMPOS: Campos = {
  clave: { id: "restablecer-clave", mensaje: mensajeDeError("ERP_CLAVE_DEBIL") },
};
const NO_COINCIDEN = "Las contraseñas no coinciden.";

// Quien administra usuarios fija una contraseña nueva a otra cuenta. La clave viaja una vez y no se muestra.
export function DialogoRestablecerClave({
  usuarioId,
  nombre,
}: {
  usuarioId: string;
  nombre: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [hecho, setHecho] = useState(false);
  const { pendiente, error, ejecutar, limpiar } = useAccion();

  function cambiarAbierto(valor: boolean) {
    // Esc, Cancelar o cierre externo no valen mientras corre la acción: el resultado no se pierde.
    if (!valor && pendiente) return;
    setAbierto(valor);
    if (!valor) {
      setErrores({});
      setHecho(false);
      limpiar();
    }
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const clave = datos.get("clave");
    const v = validarCampos(e.currentTarget, restablecerClaveSchema, { usuarioId, clave }, CAMPOS);
    if ("errores" in v) return setErrores(v.errores);
    if (clave !== datos.get("repetir")) {
      e.currentTarget.querySelector<HTMLElement>("#restablecer-repetir")?.focus();
      return setErrores({ "restablecer-repetir": NO_COINCIDEN });
    }
    setErrores({});
    ejecutar(
      () => restablecerClave(v.datos),
      () => setHecho(true),
    );
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        Restablecer contraseña
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{`Restablecer la contraseña de ${nombre}`}</AlertDialogTitle>
          <AlertDialogDescription>
            {hecho
              ? "Contraseña restablecida. Entrégasela a la persona y pídele que la cambie al entrar."
              : "Escribe una contraseña nueva. La anterior deja de servir."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hecho ? (
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        ) : (
          <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            <Campo
              id="restablecer-clave"
              etiqueta="Contraseña nueva"
              ayuda="8 caracteres o más, con letras y números"
              error={errores["restablecer-clave"]}
            >
              <Input
                id="restablecer-clave"
                name="clave"
                type="password"
                autoComplete="new-password"
                required
                {...propsCampo("restablecer-clave", errores, true)}
              />
            </Campo>
            <Campo
              id="restablecer-repetir"
              etiqueta="Repite la contraseña"
              error={errores["restablecer-repetir"]}
            >
              <Input
                id="restablecer-repetir"
                name="repetir"
                type="password"
                autoComplete="new-password"
                required
                {...propsCampo("restablecer-repetir", errores)}
              />
            </Campo>
            <p role="alert" className="text-destructive min-h-5 text-sm">
              {error}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
              <Button type="submit" disabled={pendiente}>
                {pendiente && <Loader2 className="animate-spin" aria-hidden />}
                Restablecer contraseña
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
