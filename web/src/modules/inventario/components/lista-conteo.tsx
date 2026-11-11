"use client";

import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatearCantidad } from "../domain";
import type { FilaConteo } from "../queries";

export type Borrador = { producto: FilaConteo; texto: string };

// Productos de la página del conteo, cada uno con su campo de cantidad contada.
export function ListaConteo({
  filas,
  borradores,
  malos,
  alEscribir,
}: {
  filas: readonly FilaConteo[];
  borradores: Record<string, Borrador>;
  malos: ReadonlySet<string>;
  alEscribir: (producto: FilaConteo, texto: string) => void;
}) {
  return (
    <ListaFilas etiqueta="Productos a contar" columnas="">
      {filas.map((p) => {
        const b = borradores[p.id];
        return (
          <Fila key={p.id} columnas="grid-cols-[1fr_auto] gap-x-4">
            <span className="min-w-0">
              <span className="font-semibold">
                {p.nombre}
                {p.activo ? "" : " (inactivo)"}
              </span>
              <span className="text-muted-foreground block font-mono text-xs">{p.codigo}</span>
            </span>
            <Input
              id={`cont-cant-${p.id}`}
              aria-label={`Contado de ${p.nombre}`}
              aria-invalid={malos.has(p.id) ? true : undefined}
              aria-describedby={malos.has(p.id) ? `cont-ayuda-${p.id}` : undefined}
              value={b?.texto ?? ""}
              onChange={(e) => alEscribir(p, e.target.value)}
              inputMode={p.unidad === "kg" ? "decimal" : "numeric"}
              autoComplete="off"
              className={cn("cifra w-28 text-right", malos.has(p.id) && "border-destructive")}
            />
            <span className="text-muted-foreground text-[13px]">
              Sistema: {formatearCantidad(p.sistema, p.unidad)}
              {p.reservado > 0 && ` (${formatearCantidad(p.reservado, p.unidad)} reservadas)`}
            </span>
            {malos.has(p.id) && (
              <span id={`cont-ayuda-${p.id}`} className="text-destructive text-right text-[13px]">
                Entero, o con coma si es kg
              </span>
            )}
          </Fila>
        );
      })}
    </ListaFilas>
  );
}
