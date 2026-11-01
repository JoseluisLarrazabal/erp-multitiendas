"use client";

import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotonCerrarSesion } from "./boton-cerrar-sesion";
import { SelectorNegocio } from "./selector-negocio";
import { tieneAccesoPanel } from "../domain";
import type { SesionPos } from "../use-pos-sesion";

// Barra del POS: presentacional. La sesión la lee quien la monta (una sola vez por pantalla).
export function PosBarra({
  sesion,
  cambiarActivo,
  reintentar,
  titulo,
}: {
  sesion: SesionPos;
  cambiarActivo: (id: string) => Promise<string | null | false>;
  reintentar: () => void;
  titulo: React.ReactNode;
}) {
  const sinConexion = sesion.fase === "sin-conexion";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      {titulo}
      {sesion.fase === "verificando" && (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Verificando sesión…
        </p>
      )}
      {sinConexion && (
        <p role="status" className="bg-secondary flex items-center gap-2 rounded-lg p-3 text-sm">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          Sin conexión. Puedes seguir trabajando; lo registrado se enviará al volver la red. Cerrar
          sesión necesita conexión.
        </p>
      )}
      {sesion.fase === "error" && (
        <div
          role="alert"
          className="border-destructive text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm"
        >
          <span>{sesion.mensaje}</span>
          <Button type="button" variant="outline" className="h-10" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}
      {sesion.fase === "lista" && sesion.caducada && (
        <p
          role="alert"
          className="border-destructive text-destructive rounded-lg border p-3 text-sm"
        >
          Tu sesión caducó. La venta en pantalla no se pierde: inicia sesión en{" "}
          <a href="/login" target="_blank" rel="noopener" className="underline">
            otra pestaña
          </a>{" "}
          con la misma cuenta y vuelve aquí.
          <Button type="button" variant="outline" className="ml-2 h-10" onClick={reintentar}>
            Ya inicié sesión
          </Button>
        </p>
      )}
      {sesion.fase === "lista" && (
        <div className="contents">
          <SelectorNegocio
            className="w-52 sm:w-64"
            negocios={sesion.negocios}
            activoId={sesion.activoId}
            alCambiar={cambiarActivo}
          />
          {tieneAccesoPanel(sesion.permisos) && (
            // <a> y no next/link: una navegación suave conservaría el controlador del service worker.
            <a
              href="/panel"
              className="bg-card hover:bg-muted inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium"
            >
              Ir al panel
            </a>
          )}
        </div>
      )}
      {sesion.fase !== "verificando" && (
        <div className="sm:ml-auto">
          <BotonCerrarSesion deshabilitado={sinConexion} />
        </div>
      )}
    </div>
  );
}
