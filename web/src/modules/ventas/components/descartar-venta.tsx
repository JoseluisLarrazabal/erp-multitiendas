"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const PALABRA_DESCARTAR = "DESCARTAR";

// Descartar es irreversible y el cliente ya pagó: se exige escribir la palabra.
export function DescartarVenta({
  titulo,
  descripcion,
  accion,
  alConfirmar,
  alCancelar,
}: {
  titulo: string;
  descripcion: string;
  accion: string;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <AlertDialog open onOpenChange={(abierto) => !abierto && alCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descartar-palabra">Escribe {PALABRA_DESCARTAR} para confirmar</Label>
          <Input
            id="descartar-palabra"
            autoComplete="off"
            className="h-11"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Conservar</AlertDialogCancel>
          <AlertDialogAction
            className="h-11"
            variant="destructive"
            disabled={texto.trim() !== PALABRA_DESCARTAR}
            onClick={alConfirmar}
          >
            {accion}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
