"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

// retry() vuelve a pedir al servidor y re-renderiza el segmento; reset() solo limpiaría el estado (Next 16.3+).
export default function ErrorPanel({ retry }: { error: unknown; retry: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);

  return (
    <section role="alert" className="bg-card flex flex-col items-start gap-3 rounded-xl border p-6">
      <h1 ref={titulo} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">
        No pudimos cargar esta pantalla
      </h1>
      <p className="text-muted-foreground text-sm">Revisa tu conexión e inténtalo de nuevo.</p>
      <Button onClick={() => retry()}>Reintentar</Button>
    </section>
  );
}
