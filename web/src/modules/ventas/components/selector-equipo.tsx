"use client";

import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Equipo } from "../queries";

export function SelectorEquipo({
  equipos,
  alElegir,
}: {
  equipos: readonly Equipo[];
  alElegir: (id: string) => void;
}) {
  return (
    <section
      className="bg-card mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border p-4"
      aria-label="Elegir equipo"
    >
      <h2 className="text-base font-semibold">¿En qué equipo estás?</h2>
      <p className="text-muted-foreground text-sm">
        El equipo fija la ubicación, la numeración de notas y la caja. Queda guardado en este
        navegador.
      </p>
      <ul className="flex flex-col gap-2">
        {equipos.map((e) => (
          <li key={e.id}>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start"
              onClick={() => alElegir(e.id)}
            >
              <Monitor /> {e.nombre} <span className="text-muted-foreground">({e.prefijo})</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
