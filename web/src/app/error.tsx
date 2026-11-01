"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Algo salió mal</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        No pudimos cargar esta pantalla. Revisa tu conexión e inténtalo de nuevo.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
