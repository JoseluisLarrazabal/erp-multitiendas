"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Resultado } from "@/modules/usuarios";
import { descargarExcel } from "../excel";
import type { TablaDatos } from "../tabla";

const MENSAJE_FALLA = "No se pudo generar el archivo. Intenta de nuevo.";

// El archivo se genera aquí. Con `tabla`, las filas ya llegaron a la página; con `cargar`, se piden al pulsar.
export function BotonExcel({
  tabla,
  cargar,
  archivo,
}: {
  tabla?: TablaDatos;
  cargar?: () => Promise<Resultado<TablaDatos>>;
  archivo: string;
}) {
  const [estaGenerando, setEstaGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function descargar() {
    if (estaGenerando) return;
    setEstaGenerando(true);
    setError(null);
    try {
      const resultado = cargar ? await cargar() : { ok: true as const, data: tabla! };
      if (resultado.ok) await descargarExcel(resultado.data, archivo);
      else setError(resultado.error);
    } catch {
      setError(MENSAJE_FALLA);
    } finally {
      setEstaGenerando(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {/* aria-disabled y no disabled: el botón conserva el foco mientras genera. */}
      <Button
        type="button"
        variant="outline"
        aria-disabled={estaGenerando}
        aria-busy={estaGenerando}
        onClick={descargar}
      >
        <Download aria-hidden /> {estaGenerando ? "Generando…" : "Descargar Excel"}
      </Button>
      <div aria-live="polite">{error && <p className="text-destructive text-sm">{error}</p>}</div>
    </div>
  );
}
