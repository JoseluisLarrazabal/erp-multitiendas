"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { seriesDisponiblesAccion } from "../actions";
import { casilla } from "./casilla";
import { useCarga } from "./use-carga";

// Series disponibles del producto en una ubicación, para elegir cuáles salen (salida, traslado, conteo con faltante).
// Controlado: `seleccion` son ids de serie. `necesarias` es cuántas hay que marcar.
export function SelectorSeries({
  negocioId,
  productoId,
  ubicacionId,
  necesarias,
  seleccion,
  alCambiar,
  error,
  id,
}: {
  negocioId: string;
  productoId: string;
  ubicacionId: string;
  necesarias: number;
  seleccion: readonly string[];
  alCambiar: (ids: string[]) => void;
  error?: string;
  id: string;
}) {
  const [filtro, setFiltro] = useState("");
  const series = useCarga(`${negocioId}|${productoId}|${ubicacionId}`, () =>
    seriesDisponiblesAccion({ negocioId, productoId, ubicacionId }),
  );
  const visibles = (series.datos ?? []).filter((s) =>
    s.serie.toLowerCase().includes(filtro.trim().toLowerCase()),
  );
  const marcadas = new Set(seleccion);

  function alternar(serieId: string) {
    alCambiar(
      marcadas.has(serieId) ? seleccion.filter((x) => x !== serieId) : [...seleccion, serieId],
    );
  }

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <legend className="px-1 text-sm font-medium">Series que salen</legend>
      <p className="text-muted-foreground text-xs" role="status">
        {series.cargando
          ? "Leyendo las series…"
          : `Marcadas ${seleccion.length} de ${necesarias}. Disponibles: ${series.datos?.length ?? 0}.`}
      </p>
      {series.error && (
        <p role="alert" className="text-destructive text-sm">
          {series.error}
        </p>
      )}
      {(series.datos?.length ?? 0) > 8 && (
        <Input
          type="search"
          aria-label="Buscar serie"
          placeholder="Buscar serie"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      )}
      <ul className="max-h-56 overflow-y-auto">
        {visibles.map((s) => (
          <li key={s.id}>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className={casilla}
                checked={marcadas.has(s.id)}
                onChange={() => alternar(s.id)}
              />
              <span className="font-mono">{s.serie}</span>
            </label>
          </li>
        ))}
      </ul>
      {series.datos?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay series disponibles en esta ubicación. Regístralas desde el kardex del producto.
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
