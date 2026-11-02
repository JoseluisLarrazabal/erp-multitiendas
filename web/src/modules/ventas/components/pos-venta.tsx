"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AperturaCaja } from "@/modules/caja";
import { useEffect } from "react";
import { leerCatalogoDesde } from "../contexto-ventas";
import { usePosCaja } from "../use-pos-caja";
import { useColaPos } from "../use-cola";
import type { GuardaVenta } from "../use-venta";
import { AvisoCola } from "./aviso-cola";
import { SelectorEquipo } from "./selector-equipo";
import { VentaEnCurso } from "./venta-en-curso";

// Pantalla de venta de /pos: equipo -> caja -> venta. Todo en el cliente (sin server actions).
export function PosVenta({
  negocioId,
  negociosIds,
  tipoNegocio,
  permisos,
  usuarioId,
  recargarPermisos,
  registrarGuarda,
  atajosBloqueados,
  sesionCaducada,
  alCambiarCatalogo,
}: {
  negocioId: string;
  negociosIds: readonly string[];
  tipoNegocio: string;
  permisos: readonly string[];
  usuarioId: string;
  recargarPermisos: () => Promise<void>;
  registrarGuarda: (g: GuardaVenta) => void;
  atajosBloqueados: boolean;
  sesionCaducada: boolean;
  alCambiarCatalogo: (desde: number | null) => void;
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
  } = usePosCaja(negocioId, permisos, usuarioId);
  // Motor y aviso por encima de las fases: con el equipo sin elegir o la carga fallida la cola se envía y se ve igual.
  const cola = useColaPos(
    negociosIds,
    fase.t === "abrir" || fase.t === "lista" ? fase.equipo.id : "",
    usuarioId,
    sesionCaducada,
  );

  // Con la caja cerrada aún no hay venta montada que cargue el catálogo: la barra lee su edad de lo guardado.
  const ubicacionPendiente = fase.t === "abrir" ? fase.equipo.ubicacionId : null;
  useEffect(() => {
    if (!ubicacionPendiente) return;
    let cancelado = false;
    void leerCatalogoDesde(usuarioId, negocioId, ubicacionPendiente).then(
      (d) => !cancelado && alCambiarCatalogo(d),
    );
    return () => {
      cancelado = true;
    };
  }, [ubicacionPendiente, usuarioId, negocioId, alCambiarCatalogo]);

  const aviso = (
    <AvisoCola
      cola={cola}
      sesionCaducada={sesionCaducada}
      puedeDescartar={permisos.includes("devolver_fuera_plazo")}
    />
  );
  return (
    <div className="flex flex-col gap-3">
      {aviso}
      {pantalla()}
    </div>
  );

  function pantalla() {
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
            usuarioId={usuarioId}
            nombreEquipo={fase.equipo.nombre}
            alAbrir={alAbrirCaja}
            alEncolar={() => cola.disparar()}
          />
        );
      case "lista":
        return negocio ? (
          <>
            {fase.cajaId === null && (
              <AperturaCaja
                negocioId={negocioId}
                dispositivoId={fase.equipo.id}
                usuarioId={usuarioId}
                nombreEquipo={fase.equipo.nombre}
                alAbrir={alAbrirCaja}
                alEncolar={() => cola.disparar()}
              />
            )}
            {/* Sin cajaId la venta sigue montada (carrito intacto) pero no cobra hasta abrir la caja. */}
            <VentaEnCurso
              key={fase.equipo.id}
              negocioId={negocioId}
              cola={cola}
              sesionCaducada={sesionCaducada}
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
              alCambiarCatalogo={alCambiarCatalogo}
            />
          </>
        ) : null;
    }
  }
}
