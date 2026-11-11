"use client";

import { useEffect, useRef } from "react";
import { registrarError } from "@/lib/registro-errores";
import { Button } from "@/components/ui/button";

// retry() vuelve a pedir al servidor y re-renderiza el segmento; reset() solo limpiaría el estado (Next 16.3+).
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);
  useEffect(() => {
    const e = error as { digest?: string; message?: string } | null;
    registrarError(
      "js",
      e?.digest,
      typeof e?.message === "string" && e.message ? e.message : "error de render",
    );
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <h1 ref={titulo} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
        Algo salió mal
      </h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        No pudimos cargar esta pantalla. Revisa tu conexión e inténtalo de nuevo.
      </p>
      <Button size="xl" onClick={() => retry()}>
        Reintentar
      </Button>
    </main>
  );
}
