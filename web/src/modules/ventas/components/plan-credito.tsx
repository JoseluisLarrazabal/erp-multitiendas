"use client";

import { ArrowLeft, Loader2, Plus, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { cargarDetalle, PlanCuotasImprimible, type DetalleCredito } from "@/modules/creditos";

// Plan de cuotas imprimible (RF-CRE-02), hermano de NotaVentaVista: A4, con el CSS de impresión de globals.css. Lo
// que se imprime es lo que fijó el servidor al crear el crédito, no el cálculo de la pantalla.
export function PlanCreditoVista({
  ventaId,
  negocio,
  numeroVenta,
  alVolver,
  alNueva,
}: {
  ventaId: string;
  negocio: { nombre: string; nit: string | null; datosNota: string | null };
  numeroVenta: string;
  alVolver: () => void;
  alNueva: () => void;
}) {
  const [estado, setEstado] = useState<
    { t: "cargando" } | { t: "error"; mensaje: string } | { t: "listo"; d: DetalleCredito }
  >({ t: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void cargarDetalle(createClient(), { ventaId }).then((r) => {
      if (!cancelado)
        setEstado(r.ok ? { t: "listo", d: r.data } : { t: "error", mensaje: r.error });
    });
    return () => {
      cancelado = true;
    };
  }, [ventaId, intento]);

  return (
    <div className="flex flex-col items-center gap-3 print:block">
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-2 print:hidden">
        <p role="status" className="mr-auto text-sm font-medium">
          Plan de cuotas de la venta {numeroVenta}
        </p>
        <Button type="button" variant="outline" className="h-10" onClick={alVolver}>
          <ArrowLeft /> Nota de venta
        </Button>
        <Button
          type="button"
          className="h-10"
          disabled={estado.t !== "listo"}
          onClick={() => window.print()}
        >
          <Printer /> Imprimir
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={alNueva}>
          <Plus /> Nueva venta
        </Button>
      </div>
      {estado.t === "cargando" && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm print:hidden">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando el plan…
        </p>
      )}
      {estado.t === "error" && (
        <div
          role="alert"
          className="border-destructive text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm print:hidden"
        >
          <span>{estado.mensaje}</span>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              setEstado({ t: "cargando" });
              setIntento(intento + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      {estado.t === "listo" && (
        <PlanCuotasImprimible d={estado.d} negocio={negocio} numeroVenta={numeroVenta} />
      )}
    </div>
  );
}
