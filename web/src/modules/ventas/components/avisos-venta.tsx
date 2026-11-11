"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EstadoCatalogo } from "../use-catalogo";

// Mensajes de la pantalla de venta. Los contenedores `status` están siempre montados: un lector de pantalla solo
// anuncia cambios de texto en una región que ya existía.
export function AvisosVenta({
  anuncio,
  aviso,
  alCerrarAviso,
  rechazo,
  catalogo,
  alReintentarCatalogo,
}: {
  anuncio: string;
  aviso: string | null;
  alCerrarAviso: () => void;
  rechazo: string | null;
  catalogo: EstadoCatalogo;
  alReintentarCatalogo: () => void;
}) {
  return (
    <>
      <p role="status" className="sr-only">
        {anuncio}
      </p>
      <div role="status" className="empty:hidden">
        {aviso && (
          <div className="bg-secondary text-secondary-foreground flex items-center gap-2 rounded-lg px-3 py-1 text-[15px]">
            <span className="flex-1 py-1">{aviso}</span>
            <button
              type="button"
              className="min-h-11 px-3 text-sm font-semibold underline"
              onClick={alCerrarAviso}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
      {rechazo && (
        <p
          role="alert"
          className="border-destructive bg-destructive-soft text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm font-medium"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {rechazo}
        </p>
      )}
      {catalogo.t === "cargando" && (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando catálogo…
        </p>
      )}
      {catalogo.t === "error" && (
        <p
          role="alert"
          className="border-destructive bg-destructive-soft text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm font-medium"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {catalogo.mensaje}
          <Button type="button" variant="outline" className="h-11" onClick={alReintentarCatalogo}>
            Reintentar
          </Button>
        </p>
      )}
    </>
  );
}
