"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AperturaCaja } from "@/modules/caja";
import { usePosCaja } from "../use-pos-caja";
import { SelectorEquipo } from "./selector-equipo";
import type { GuardaVenta } from "../use-venta";
import { VentaEnCurso } from "./venta-en-curso";

// Pantalla de venta de /pos: equipo -> caja -> venta. Todo en el cliente (sin server actions).
export function PosVenta({
  negocioId,
  tipoNegocio,
  permisos,
  usuarioId,
  recargarPermisos,
  registrarGuarda,
  atajosBloqueados,
  sesionCaducada,
}: {
  negocioId: string;
  tipoNegocio: string;
  permisos: readonly string[];
  usuarioId: string;
  recargarPermisos: () => Promise<void>;
  registrarGuarda: (g: GuardaVenta) => void;
  atajosBloqueados: boolean;
  sesionCaducada: boolean;
}) {
  const {
    fase,
    negocio,
    reintentar,
    elegir,
    cambiarEquipo,
    alAbrirCaja,
    verificarCaja,
    cajaCerrada,
    recargarNegocio,
  } = usePosCaja(negocioId, permisos);

  switch (fase.t) {
    case "cargando":
      return (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Preparando el punto de venta…
        </p>
      );
    case "error":
      return (
        <div
          role="alert"
          className="border-destructive text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm"
        >
          <span>{fase.mensaje}</span>
          <Button type="button" variant="outline" className="h-10" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      );
    case "sin-permiso":
      return (
        <p role="alert" className="bg-secondary rounded-lg p-3 text-sm">
          {fase.mensaje}
        </p>
      );
    case "sin-equipos":
      return (
        <p role="alert" className="bg-secondary rounded-lg p-3 text-sm">
          Este negocio no tiene equipos registrados. Pide a quien administra los usuarios que
          registre uno en el panel.
        </p>
      );
    case "elegir":
      return <SelectorEquipo equipos={fase.equipos} alElegir={(id) => void elegir(id)} />;
    case "abrir":
      return (
        <AperturaCaja
          negocioId={negocioId}
          dispositivoId={fase.equipo.id}
          nombreEquipo={fase.equipo.nombre}
          alAbrir={alAbrirCaja}
        />
      );
    case "lista":
      return negocio ? (
        <>
          {fase.cajaId === null && (
            <AperturaCaja
              negocioId={negocioId}
              dispositivoId={fase.equipo.id}
              nombreEquipo={fase.equipo.nombre}
              alAbrir={alAbrirCaja}
            />
          )}
          {/* Sin cajaId la venta sigue montada (carrito intacto) pero no cobra hasta abrir la caja. */}
          <VentaEnCurso
            key={fase.equipo.id}
            negocioId={negocioId}
            tipoNegocio={tipoNegocio}
            negocio={negocio}
            equipo={fase.equipo}
            cajaId={fase.cajaId}
            permisos={permisos}
            usuarioId={usuarioId}
            alCambiarEquipo={cambiarEquipo}
            recargarNegocio={recargarNegocio}
            recargarPermisos={recargarPermisos}
            verificarCaja={verificarCaja}
            cajaCerrada={cajaCerrada}
            registrarGuarda={registrarGuarda}
            atajosBloqueados={atajosBloqueados}
            sesionCaducada={sesionCaducada}
          />
        </>
      ) : null;
  }
}
