"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Confirmación antes de tirar una venta en curso (cambiar de equipo o de negocio).
export function ConfirmarDescarte({
  abierto,
  titulo,
  descripcion,
  confirmar,
  alConfirmar,
  alCancelar,
}: {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  confirmar: string;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={(o) => !o && alCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Seguir vendiendo</AlertDialogCancel>
          <AlertDialogAction className="h-11" onClick={alConfirmar}>
            {confirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
