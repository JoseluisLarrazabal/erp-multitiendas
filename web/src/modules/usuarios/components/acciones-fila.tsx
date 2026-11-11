"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desactivarUsuario, quitarUsuario, reactivarUsuario } from "../actions";
import { DialogoRestablecerClave } from "./dialogo-restablecer-clave";
import { type AccionesFila, type FilaUsuario } from "../domain";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { useAccion } from "@/components/panel/use-accion";

type Props = {
  fila: FilaUsuario;
  negocioId: string;
  negocioNombre: string;
  acciones: AccionesFila;
};

export function AccionesFila({ fila, negocioId, negocioNombre, acciones }: Props) {
  const { pendiente, error, ejecutar } = useAccion();
  const { usuarioId, nombre } = fila;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {acciones.reactivar && (
          <Button
            variant="outline"
            className="min-h-10"
            disabled={pendiente}
            onClick={() => ejecutar(() => reactivarUsuario({ usuarioId }))}
          >
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            Reactivar
          </Button>
        )}
        {acciones.desactivar && (
          <ConfirmarAccion
            etiqueta="Desactivar"
            titulo={`¿Desactivar a ${nombre}?`}
            descripcion={`${nombre} no podrá ingresar y perderá el acceso a todos sus negocios de inmediato, no solo a ${negocioNombre}. Sus datos se conservan y puedes reactivar la cuenta cuando quieras.`}
            confirmar="Desactivar cuenta"
            accion={() => desactivarUsuario({ usuarioId })}
          />
        )}
        {acciones.restablecer && <DialogoRestablecerClave usuarioId={usuarioId} nombre={nombre} />}
        {acciones.quitar && (
          <ConfirmarAccion
            etiqueta="Quitar"
            titulo={`¿Quitar a ${nombre} de ${negocioNombre}?`}
            descripcion={`${nombre} dejará de tener acceso a ${negocioNombre}. Conserva su cuenta y sus otros negocios. Si este es su último negocio no se puede quitar: desactiva la cuenta.`}
            confirmar="Quitar del negocio"
            accion={() => quitarUsuario({ negocioId, usuarioId })}
            focoFinal={() => document.getElementById("titulo-pagina")}
          />
        )}
      </div>
      <p role="alert" className="text-destructive text-xs empty:hidden">
        {error}
      </p>
    </div>
  );
}
