"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { id: "nueva", texto: "Nueva orden" },
  { id: "ordenes", texto: "Órdenes" },
] as const;
type Id = (typeof PESTANAS)[number]["id"];

// POS de lavandería: recepción de órdenes y seguimiento de las activas. La recepción queda montada (oculta) al ir a
// Órdenes: el carrito y la ficha no se pierden.
export function PestanasPos({ nueva, ordenes }: { nueva: ReactNode; ordenes: ReactNode }) {
  const [activa, setActiva] = useState<Id>("nueva");

  function alTeclear(e: KeyboardEvent, i: number) {
    const destino =
      e.key === "Home"
        ? PESTANAS[0]
        : e.key === "End"
          ? PESTANAS[PESTANAS.length - 1]
          : e.key === "ArrowRight"
            ? PESTANAS[(i + 1) % PESTANAS.length]
            : e.key === "ArrowLeft"
              ? PESTANAS[(i - 1 + PESTANAS.length) % PESTANAS.length]
              : undefined;
    if (!destino) return;
    e.preventDefault();
    setActiva(destino.id);
    document.getElementById(`pestana-${destino.id}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Lavandería" className="flex gap-1 border-b print:hidden">
        {PESTANAS.map((p, i) => (
          <button
            key={p.id}
            id={`pestana-${p.id}`}
            type="button"
            role="tab"
            aria-selected={activa === p.id}
            aria-controls={activa === p.id ? `panel-${p.id}` : undefined}
            tabIndex={activa === p.id ? 0 : -1}
            className={cn(
              "focus-visible:ring-ring -mb-px min-h-12 rounded-t-lg border-b-2 px-5 text-base font-semibold outline-none focus-visible:ring-3",
              activa === p.id
                ? "border-primary bg-secondary text-secondary-foreground"
                : "text-foreground hover:bg-muted border-transparent",
            )}
            onClick={() => setActiva(p.id)}
            onKeyDown={(e) => alTeclear(e, i)}
          >
            {p.texto}
          </button>
        ))}
      </div>
      <div
        id="panel-nueva"
        role="tabpanel"
        aria-labelledby="pestana-nueva"
        tabIndex={0}
        hidden={activa !== "nueva"}
        className="[&[hidden]]:hidden"
      >
        {nueva}
      </div>
      {activa === "ordenes" && (
        <div id="panel-ordenes" role="tabpanel" tabIndex={0} aria-labelledby="pestana-ordenes">
          {ordenes}
        </div>
      )}
    </div>
  );
}
