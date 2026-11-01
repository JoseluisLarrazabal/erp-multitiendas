"use client";

import { ScanBarcode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Equipo } from "../queries";

// Equipo en uso y modo (vender o consulta rápida). Con una venta pendiente no se cambia de equipo.
export function BarraEquipo({
  equipo,
  cajaAbierta,
  pendiente,
  alCambiarEquipo,
  consulta,
  alCambiarModo,
}: {
  equipo: Equipo;
  cajaAbierta: boolean;
  pendiente: boolean;
  alCambiarEquipo: () => void;
  consulta: boolean;
  alCambiarModo: (consulta: boolean) => void;
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
        title={pendiente ? "Hay una venta pendiente de envío" : undefined}
        onClick={alCambiarEquipo}
      >
        Cambiar equipo
      </Button>
      <div className="ml-auto flex gap-1" role="group" aria-label="Modo">
        <Button
          type="button"
          variant={consulta ? "outline" : "secondary"}
          className="h-10"
          aria-pressed={!consulta}
          onClick={() => alCambiarModo(false)}
        >
          <ScanBarcode /> Vender
        </Button>
        <Button
          type="button"
          variant={consulta ? "secondary" : "outline"}
          className="h-10"
          aria-pressed={consulta}
          onClick={() => alCambiarModo(true)}
        >
          <Search /> Consulta rápida
        </Button>
      </div>
    </div>
  );
}
