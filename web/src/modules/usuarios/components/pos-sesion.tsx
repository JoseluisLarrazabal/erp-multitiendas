"use client";

import { Loader2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatearHace } from "@/lib/format/fecha";
import { useSinRed } from "@/lib/offline/red";
import { BotonCambiarClave } from "./boton-cambiar-clave";
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
  catalogoDesde,
}: {
  sesion: SesionPos;
  cambiarActivo: (id: string) => Promise<string | null | false>;
  reintentar: () => void;
  titulo: React.ReactNode;
  // Cuándo se bajó el catálogo que se está usando (ms), o null si todavía no hay.
  catalogoDesde: number | null;
}) {
  const sinRed = useSinRed();
  const sinConexion = sesion.fase === "sin-conexion" || (sesion.fase === "lista" && sinRed);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      {titulo}
      {sesion.fase === "verificando" && (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-[15px]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Verificando sesión…
        </p>
      )}
      {sesion.fase === "sin-conexion" && sesion.contextoVencido && (
        <p
          role="alert"
          className="border-destructive bg-destructive-soft text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm font-medium"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          {navigator.onLine
            ? "No se pudo verificar la sesión con el servidor. Inicia sesión cuando vuelva la conexión. Las ventas pendientes no se pierden."
            : "Hace más de 72 horas que este equipo no se conecta. Conéctalo a internet e inicia sesión para vender. Las ventas pendientes no se pierden."}
        </p>
      )}
      {sesion.fase === "sin-conexion" && !sesion.contextoVencido && (
        <p
          role="status"
          className="bg-secondary text-secondary-foreground flex items-center gap-2 rounded-lg p-3 text-[15px]"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          Sin conexión. Puedes seguir trabajando; lo registrado se enviará al volver la red. Cerrar
          sesión necesita conexión.
        </p>
      )}
      {sesion.fase === "lista" && sinRed && <AvisoSinRed catalogoDesde={catalogoDesde} />}
      {sesion.fase === "error" && (
        <div
          role="alert"
          className="border-destructive bg-destructive-soft text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm font-medium"
        >
          <span>{sesion.mensaje}</span>
          <Button type="button" variant="outline" className="h-11" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}
      {sesion.fase === "lista" && sesion.caducada && (
        <p
          role="alert"
          className="border-destructive bg-destructive-soft text-destructive rounded-lg border p-3 text-sm font-medium"
        >
          Tu sesión caducó. La venta en pantalla no se pierde: inicia sesión en{" "}
          <a href="/login" target="_blank" rel="noopener" className="underline">
            otra pestaña
          </a>{" "}
          con la misma cuenta y vuelve aquí.
          <Button type="button" variant="outline" className="ml-2 h-11" onClick={reintentar}>
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
              className="bg-card border-input hover:bg-muted inline-flex h-11 items-center rounded-lg border px-4 text-sm font-semibold"
            >
              Ir al panel
            </a>
          )}
        </div>
      )}
      {sesion.fase !== "verificando" && (
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <BotonCambiarClave deshabilitado={sinConexion} />
          <BotonCerrarSesion deshabilitado={sinConexion} />
        </div>
      )}
    </div>
  );
}

// La edad del catálogo se refresca sola mientras la barra está a la vista.
function AvisoSinRed({ catalogoDesde }: { catalogoDesde: number | null }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <p
      role="status"
      className="bg-secondary text-secondary-foreground flex items-center gap-2 rounded-lg p-3 text-[15px]"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        Sin conexión.{" "}
        {catalogoDesde === null
          ? "Catálogo sin cargar."
          : `Catálogo de ${formatearHace(catalogoDesde, ahora)}.`}{" "}
        Lo registrado se enviará al volver la red. Cerrar sesión necesita conexión.
      </span>
    </p>
  );
}
