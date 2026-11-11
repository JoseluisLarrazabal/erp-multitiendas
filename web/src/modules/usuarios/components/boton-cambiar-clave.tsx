"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { ERROR_CONEXION, esSinRedAuth } from "@/lib/supabase/errores";
import { createClient } from "@/lib/supabase/browser";
import { claveSchema } from "../schemas";

const MSG_ACTUAL = "La contraseña actual no es correcta.";
const MSG_DEBIL = "La contraseña nueva necesita al menos 8 caracteres, con letras y números.";
const MSG_IGUAL = "La contraseña nueva debe ser distinta de la actual.";

const CAMPOS = [
  ["actual", "Contraseña actual", "current-password"],
  ["nueva", "Contraseña nueva", "new-password"],
  ["repetir", "Repite la contraseña nueva", "new-password"],
] as const;

function mensajeNueva(code: string | undefined) {
  if (code === "weak_password") return MSG_DEBIL;
  if (code === "same_password") return MSG_IGUAL;
  return ERROR_CONEXION;
}

// Cambia la contraseña propia desde el navegador (sin server actions: el POS no las admite). Verifica la actual con un
// login aparte antes de cambiar; un login fallido no toca la sesión en curso.
export function BotonCambiarClave({ deshabilitado = false }: { deshabilitado?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [hecho, setHecho] = useState(false);

  function cambiarAbierto(valor: boolean) {
    if (!valor && pendiente) return;
    setAbierto(valor);
    if (!valor) {
      setError(null);
      setHecho(false);
    }
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const actual = String(datos.get("actual") ?? "");
    const nueva = String(datos.get("nueva") ?? "");
    if (!actual) return setError(MSG_ACTUAL);
    if (!claveSchema.safeParse(nueva).success) return setError(MSG_DEBIL);
    if (nueva !== datos.get("repetir")) return setError("Las contraseñas nuevas no coinciden.");
    setError(null);
    setPendiente(true);
    try {
      const supabase = createClient();
      const { data: sesion } = await supabase.auth.getUser();
      const correo = sesion.user?.email;
      if (!correo) return setError("Tu sesión terminó. Vuelve a ingresar.");
      const { error: errorActual } = await supabase.auth.signInWithPassword({
        email: correo,
        password: actual,
      });
      if (errorActual) {
        // Solo un 400 de Auth es "credenciales inválidas"; red caída, límite de tasa o 5xx no dicen nada de la clave.
        return setError(
          !esSinRedAuth(errorActual) && errorActual.status === 400 ? MSG_ACTUAL : ERROR_CONEXION,
        );
      }
      const { error: errorNueva } = await supabase.auth.updateUser({ password: nueva });
      if (errorNueva) return setError(mensajeNueva(errorNueva.code));
      setHecho(true);
    } catch {
      setError(ERROR_CONEXION);
    } finally {
      setPendiente(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={deshabilitado}
            title={deshabilitado ? "Necesitas conexión para cambiar la contraseña" : undefined}
          />
        }
      >
        <KeyRound aria-hidden />
        Cambiar contraseña
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Cambiar contraseña</AlertDialogTitle>
          <AlertDialogDescription>
            {hecho ? "Contraseña cambiada." : "8 caracteres o más, con letras y números."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hecho ? (
          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        ) : (
          <form onSubmit={(e) => void enviar(e)} noValidate className="flex flex-col gap-4">
            {CAMPOS.map(([nombre, etiqueta, auto]) => (
              <div key={nombre} className="flex flex-col gap-1.5">
                <Label htmlFor={`clave-${nombre}`}>{etiqueta}</Label>
                <Input
                  id={`clave-${nombre}`}
                  name={nombre}
                  type="password"
                  autoComplete={auto}
                  required
                  className="h-12"
                />
              </div>
            ))}
            <p role="alert" className="text-destructive min-h-5 text-sm font-medium">
              {error}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel size="lg" disabled={pendiente}>
                Cancelar
              </AlertDialogCancel>
              <Button type="submit" size="lg" disabled={pendiente}>
                {pendiente && <Loader2 className="animate-spin" aria-hidden />}
                Cambiar contraseña
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
