"use client";

import { Landmark, ScanBarcode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Equipo } from "../queries";

export type ModoPos = "vender" | "consulta" | "caja";

// Equipo en uso y modo (vender, consulta rápida o caja). Con una venta pendiente no se cambia de equipo.
export function BarraEquipo({
  equipo,
  cajaAbierta,
  pendiente,
  alCambiarEquipo,
  modo,
  alCambiarModo,
}: {
  equipo: Equipo;
  cajaAbierta: boolean;
  pendiente: boolean;
  alCambiarEquipo: () => void;
  modo: ModoPos;
  alCambiarModo: (modo: ModoPos) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <p className="text-muted-foreground">
        Equipo{" "}
        <span className="text-foreground font-medium">
          {equipo.nombre} ({equipo.prefijo})
        </span>{" "}
        · {cajaAbierta ? "caja abierta" : "caja cerrada"}
      </p>
      <Button
        type="button"
        variant="ghost"
        className="h-10"
        disabled={pendiente}
        title={pendiente ? "Hay ventas sin enviar en este equipo" : undefined}
        onClick={alCambiarEquipo}
      >
        Cambiar equipo
      </Button>
      <div className="ml-auto flex gap-1" role="group" aria-label="Modo">
        <Button
          type="button"
          variant={modo === "vender" ? "secondary" : "outline"}
          className="h-10"
          aria-pressed={modo === "vender"}
          onClick={() => alCambiarModo("vender")}
        >
          <ScanBarcode /> Vender
        </Button>
        <Button
          type="button"
          variant={modo === "consulta" ? "secondary" : "outline"}
          className="h-10"
          aria-pressed={modo === "consulta"}
          onClick={() => alCambiarModo("consulta")}
        >
          <Search /> Consulta rápida
        </Button>
        <Button
          type="button"
          variant={modo === "caja" ? "secondary" : "outline"}
          className="h-10"
          aria-pressed={modo === "caja"}
          onClick={() => alCambiarModo("caja")}
        >
          <Landmark /> Caja
        </Button>
      </div>
    </div>
  );
}
