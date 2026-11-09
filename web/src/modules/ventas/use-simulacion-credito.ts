"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { simularCredito } from "@/modules/creditos";
import {
  leerPlan,
  pedirSimulacion,
  type FormCredito,
  type ResultadoCredito,
} from "./credito-venta";

const ESPERA_MS = 300;

// Plan de la venta a crédito según el servidor (simular_credito), con debounce. `version` fuerza un nuevo cálculo (p. ej. tras
// recargar los parámetros). Mientras la respuesta no corresponde a lo que hay en pantalla, el cobro no se habilita.
export function useSimulacionCredito(o: {
  negocioId: string;
  form: FormCredito;
  totalCentavos: number;
  hayCliente: boolean;
  version: number;
}): ResultadoCredito | null {
  const { negocioId, form, totalCentavos, hayCliente, version } = o;
  const pedido = form.activo ? pedirSimulacion(form, totalCentavos) : null;
  const clave = pedido?.ok
    ? `${negocioId}|${pedido.total}|${pedido.inicial}|${pedido.cuotas}|${version}`
    : null;
  const [respuesta, setRespuesta] = useState<{ clave: string; r: ResultadoCredito } | null>(null);

  useEffect(() => {
    if (!clave || !pedido?.ok) return;
    let cancelado = false;
    const espera = setTimeout(() => {
      void simularCredito(createClient(), negocioId, pedido).then((s) => {
        if (cancelado) return;
        setRespuesta({ clave, r: s.ok ? leerPlan(s.data) : { ok: false, motivo: s.error } });
      });
    }, ESPERA_MS);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
    // `pedido` se deriva de `clave`: depender de ella basta y evita un efecto por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, negocioId]);

  if (!pedido) return null;
  if (!hayCliente) return { ok: false, motivo: "El crédito necesita un cliente." };
  if (!pedido.ok) return pedido;
  return respuesta?.clave === clave ? respuesta.r : { ok: false, motivo: "Calculando el plan…" };
}
