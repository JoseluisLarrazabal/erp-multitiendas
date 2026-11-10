"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import { useOperacion } from "@/modules/inventario/panel-cliente";
import type { Resultado } from "@/modules/usuarios";

// Diálogo de un reverso: pide el motivo (1 a 200 caracteres) y confirma. Si la acción falla, queda abierto con el
// error. El id de la operación nace con el diálogo y se conserva en los reintentos (idempotencia de la RPC).
export function DialogoMotivo({
  abierto,
  alCambiarAbierto,
  titulo,
  descripcion,
  confirmar,
  id,
  accion,
  sinConfirmar = false,
  children,
}: {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  titulo: string;
  descripcion: string;
  confirmar: string;
  id: string;
  accion: (operacionId: string, motivo: string) => Promise<Resultado<null>>;
  // Sin nada que confirmar (p. ej. el pago no se puede anular): solo Cerrar.
  sinConfirmar?: boolean;
  children?: ReactNode;
}) {
  const { pendiente, error, enviar, limpiar } = useOperacion();
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);

  function cambiarAbierto(valor: boolean) {
    // Esc, Cancelar o cierre externo no valen mientras corre la acción: el resultado no se pierde.
    if (!valor && pendiente) return;
    alCambiarAbierto(valor);
    if (!valor) {
      setErrorMotivo(null);
      limpiar();
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const texto = motivo.trim();
    if (!texto) {
      setErrorMotivo("Escribe el motivo (hasta 200 caracteres).");
      return document.getElementById(`${id}-motivo`)?.focus();
    }
    setErrorMotivo(null);
    enviar(
      (operacionId) => accion(operacionId, texto),
      () => {
        setMotivo("");
        alCambiarAbierto(false);
      },
    );
  }

  const errores: Errores = errorMotivo ? { [`${id}-motivo`]: errorMotivo } : {};

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {sinConfirmar ? (
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        ) : (
          <form onSubmit={alEnviar} noValidate className="flex flex-col gap-4">
            <Campo id={`${id}-motivo`} etiqueta="Motivo" error={errores[`${id}-motivo`]}>
              <Input
                id={`${id}-motivo`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={200}
                autoComplete="off"
                className="h-10"
                {...propsCampo(`${id}-motivo`, errores)}
              />
            </Campo>
            <p role="alert" className="text-destructive min-h-5 text-sm">
              {error}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={pendiente}>
                {pendiente && <Loader2 className="animate-spin" aria-hidden />}
                {confirmar}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
