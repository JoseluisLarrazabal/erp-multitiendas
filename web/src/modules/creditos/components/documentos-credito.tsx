"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccion } from "@/components/panel/use-accion";
import { marcarDocumentosCredito } from "../actions";

const DOCS = [
  { clave: "ci", etiqueta: "CI" },
  { clave: "domicilio", etiqueta: "Comprobante de domicilio" },
  { clave: "pagare", etiqueta: "Pagaré" },
] as const;

type Docs = { ci: boolean; domicilio: boolean; pagare: boolean };

// Marca o desmarca los documentos entregados después de vender. Cada cambio queda en la auditoría.
export function DocumentosCredito({ creditoId, inicial }: { creditoId: string; inicial: Docs }) {
  const [docs, setDocs] = useState(inicial);
  const [hecho, setHecho] = useState(false);
  const { pendiente, error, ejecutar } = useAccion();
  const cambio = DOCS.some((x) => docs[x.clave] !== inicial[x.clave]);
  return (
    <section
      aria-label="Documentos del crédito"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 className="text-[15px] font-semibold">Documentos entregados</h2>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {DOCS.map((x) => (
          <label key={x.clave} className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={docs[x.clave]}
              onChange={(e) => {
                setHecho(false);
                setDocs({ ...docs, [x.clave]: e.target.checked });
              }}
            />
            {x.etiqueta}
          </label>
        ))}
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {error}
      </p>
      <p role="status" className="text-sm font-medium">
        {hecho && !error ? "Documentos guardados." : ""}
      </p>
      <Button
        type="button"
        className="h-10 self-start"
        disabled={!cambio || pendiente}
        onClick={() =>
          ejecutar(
            () => marcarDocumentosCredito({ creditoId, ...docs }),
            () => setHecho(true),
          )
        }
      >
        Guardar documentos
      </Button>
    </section>
  );
}
