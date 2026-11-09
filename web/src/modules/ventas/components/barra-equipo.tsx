"use client";

import { BookmarkCheck, HandCoins, Landmark, ScanBarcode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSinRed } from "@/lib/offline/red";
import type { Equipo } from "../queries";

export type ModoPos = "vender" | "consulta" | "caja" | "reservas" | "creditos";

// Equipo en uso y modo (vender, consulta rápida o caja). Con una venta pendiente no se cambia de equipo.
export function BarraEquipo({
  equipo,
  cajaAbierta,
  pendiente,
  alCambiarEquipo,
  modo,
  alCambiarModo,
  conReservas = false,
  conCreditos = false,
}: {
  equipo: Equipo;
  cajaAbierta: boolean;
  pendiente: boolean;
  alCambiarEquipo: () => void;
  modo: ModoPos;
  alCambiarModo: (modo: ModoPos) => void;
  // Quien tiene gestionar_reservas ve el modo Reservas (no existe en lavandería).
  conReservas?: boolean;
  // Quien tiene `caja` cobra cuotas (no hay créditos en lavandería).
  conCreditos?: boolean;
}) {
  const sinRed = useSinRed();
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
        disabled={pendiente || sinRed}
        title={
          sinRed
            ? "Cambiar de equipo necesita conexión"
            : pendiente
              ? "Hay operaciones sin enviar en este equipo"
              : undefined
        }
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
        {conReservas && (
          <Button
            type="button"
            variant={modo === "reservas" ? "secondary" : "outline"}
            className="h-10"
            aria-pressed={modo === "reservas"}
            onClick={() => alCambiarModo("reservas")}
          >
            <BookmarkCheck /> Reservas
          </Button>
        )}
        {conCreditos && (
          <Button
            type="button"
            variant={modo === "creditos" ? "secondary" : "outline"}
            className="h-10"
            aria-pressed={modo === "creditos"}
            onClick={() => alCambiarModo("creditos")}
          >
            <HandCoins /> Cuotas
          </Button>
        )}
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
