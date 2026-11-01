"use client";

import { useState } from "react";
import { ChevronDown, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { etiquetaRol, type NegocioUsuario } from "../domain";
import { guardarNegocio } from "../negocio-cliente";

type Props = {
  negocios: readonly NegocioUsuario[];
  activoId: string;
  // Corre antes de guardar la preferencia; devuelve un error para abortar el cambio, o `false` si el usuario lo
  // canceló (se aborta sin mensaje).
  // Sin él se guarda y se recarga: el servidor vuelve a decidir qué ve el usuario en el negocio nuevo.
  alCambiar?: (negocioId: string) => Promise<string | null | false>;
  className?: string;
};

export function SelectorNegocio({ negocios, activoId, alCambiar, className }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const activo = negocios.find((n) => n.negocioId === activoId) ?? negocios[0];
  if (!activo) return null;

  async function cambiar(id: string) {
    setError(null);
    setPendiente(true);
    const fallo = alCambiar ? await alCambiar(id) : null;
    setPendiente(false);
    if (fallo === false) return;
    if (fallo) return setError(fallo);
    guardarNegocio(id);
    if (!alCambiar) window.location.reload();
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="bg-card focus-within:ring-ring relative flex items-center gap-2.5 rounded-[10px] border p-2.5 focus-within:ring-3">
        <span className="bg-secondary text-secondary-foreground grid size-[30px] shrink-0 place-items-center rounded-lg">
          <Store className="size-[17px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold">{activo.nombre}</span>
          <span className="text-muted-foreground block text-[11px]">{etiquetaRol(activo.rol)}</span>
        </span>
        {negocios.length > 1 && (
          <>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <select
              aria-label="Negocio activo"
              value={activo.negocioId}
              disabled={pendiente}
              onChange={(e) => void cambiar(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
            >
              {negocios.map((n) => (
                <option key={n.negocioId} value={n.negocioId}>
                  {n.nombre}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
