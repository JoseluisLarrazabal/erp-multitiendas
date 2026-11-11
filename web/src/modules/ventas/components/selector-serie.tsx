"use client";

import { useEffect, useState } from "react";
import { SelectNativo } from "@/components/ui/select-nativo";
import { createClient } from "@/lib/supabase/browser";
import { seriesDisponibles, type SerieDisponible } from "../queries";

export function SelectorSerie({
  productoId,
  ubicacionId,
  valor,
  usadas,
  alElegir,
}: {
  productoId: string;
  ubicacionId: string;
  valor: string | null;
  usadas: ReadonlySet<string>;
  alElegir: (id: string | null, texto: string | null) => void;
}) {
  const [series, setSeries] = useState<SerieDisponible[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    seriesDisponibles(createClient(), productoId, ubicacionId).then((r) => {
      if (cancelado) return;
      if (r.ok) setSeries(r.data);
      else setError(r.error);
    });
    return () => {
      cancelado = true;
    };
  }, [productoId, ubicacionId]);
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  const opciones = (series ?? []).filter((s) => s.id === valor || !usadas.has(s.id));
  return (
    <SelectNativo
      aria-label="Serie"
      className="h-11"
      value={valor ?? ""}
      onChange={(e) =>
        alElegir(
          e.target.value || null,
          opciones.find((s) => s.id === e.target.value)?.serie ?? null,
        )
      }
    >
      <option value="">
        {series === null
          ? "Cargando series…"
          : opciones.length === 0
            ? "Sin series disponibles"
            : "Elegir serie"}
      </option>
      {opciones.map((s) => (
        <option key={s.id} value={s.id}>
          {s.serie}
        </option>
      ))}
    </SelectNativo>
  );
}
