"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAccion, type Resultado } from "./use-accion";

type Props = {
  titulo: string;
  descripcion: string;
  confirmar: string;
  accion: () => Promise<Resultado<null>>;
  destructiva?: boolean;
  // Solo con botón propio: deshabilita el disparador (p. ej. mientras corre otra acción de la misma fila).
  deshabilitado?: boolean;
  // Tras una acción exitosa el foco va aquí (p. ej. al título cuando la fila desaparece); por defecto vuelve al botón.
  focoFinal?: () => HTMLElement | null;
} &
  // Con botón propio...
  (
    | { etiqueta: string; abierto?: undefined; alCambiarAbierto?: undefined }
    // ...o controlado por quien lo usa (p. ej. al cambiar un select).
    | { etiqueta?: undefined; abierto: boolean; alCambiarAbierto: (abierto: boolean) => void }
  );

// Confirmación que nombra a la persona. Si la acción falla, el diálogo sigue abierto con el error.
export function ConfirmarAccion({
  etiqueta,
  titulo,
  descripcion,
  confirmar,
  accion,
  destructiva = true,
  deshabilitado,
  focoFinal,
  abierto,
  alCambiarAbierto,
}: Props) {
  const [propio, setPropio] = useState(false);
  const { pendiente, error, ejecutar, limpiar } = useAccion();
  const exito = useRef(false);
  const estaAbierto = abierto ?? propio;
  const cambiarAbierto = (valor: boolean) => {
    setPropio(valor);
    alCambiarAbierto?.(valor);
  };

  return (
    <AlertDialog
      open={estaAbierto}
      onOpenChange={(valor) => {
        // Esc, Cancelar o cierre externo no valen mientras corre la acción: el resultado no se pierde.
        if (!valor && pendiente) return;
        cambiarAbierto(valor);
        if (!valor) limpiar();
      }}
    >
      {etiqueta !== undefined && (
        <AlertDialogTrigger
          render={
            <Button
              variant="outline"
              disabled={deshabilitado}
              className={cn(destructiva && "text-destructive")}
            />
          }
        >
          {etiqueta}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        finalFocus={() => (exito.current ? (focoFinal?.() ?? true) : true)}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <p role="alert" className="text-destructive min-h-5 text-sm">
          {error}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={destructiva ? "destructive" : "default"}
            disabled={pendiente}
            onClick={() =>
              ejecutar(accion, () => {
                exito.current = true;
                cambiarAbierto(false);
              })
            }
          >
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            {confirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
