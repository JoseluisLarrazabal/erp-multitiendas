"use client";

import { useEffect, useState } from "react";
import { useSinRed } from "@/lib/offline/red";
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
// recargar los parámetros). Mientras la respuesta no corresponde a lo que hay en pantalla, el cobro no se habilita. Solo se
// guarda lo que el servidor respondió (un plan o un error de reglas); un fallo de red o ilegible NO se guarda: se muestra con
// "Reintentar" y se vuelve a pedir solo cuando la conexión vuelve.
export function useSimulacionCredito(o: {
  negocioId: string;
  form: FormCredito;
  totalCentavos: number;
  hayCliente: boolean;
  version: number;
}): { resultado: ResultadoCredito | null; reintentar: () => void } {
  const { negocioId, form, totalCentavos, hayCliente, version } = o;
  const sinRed = useSinRed();
  const [intento, setIntento] = useState(0);
  const pedido = form.activo ? pedirSimulacion(form, totalCentavos) : null;
  const clave =
    pedido?.ok && !sinRed
      ? `${negocioId}|${pedido.total}|${pedido.inicial}|${pedido.cuotas}|${version}|${intento}`
      : null;
  const [respuesta, setRespuesta] = useState<{
    clave: string;
    r: ResultadoCredito | { falla: string };
  } | null>(null);

  useEffect(() => {
    if (!clave || !pedido?.ok) return;
    let cancelado = false;
    const espera = setTimeout(() => {
      void simularCredito(createClient(), negocioId, pedido).then((s) => {
        if (cancelado) return;
        setRespuesta({ clave, r: s.ok ? leerPlan(s.data) : { falla: s.error } });
      });
    }, ESPERA_MS);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
    // `pedido` se deriva de `clave`: depender de ella basta y evita un efecto por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, negocioId]);

  const reintentar = () => setIntento((n) => n + 1);
  if (!pedido) return { resultado: null, reintentar };
  if (!hayCliente)
    return { resultado: { ok: false, motivo: "El crédito necesita un cliente." }, reintentar };
  if (!pedido.ok) return { resultado: pedido, reintentar };
  if (sinRed)
    return {
      resultado: { ok: false, motivo: "Sin conexión: el plan se calcula al volver la red." },
      reintentar,
    };
  const r = respuesta?.clave === clave ? respuesta.r : null;
  if (!r) return { resultado: { ok: false, motivo: "Calculando el plan…" }, reintentar };
  if ("falla" in r)
    return {
      resultado: {
        ok: false,
        motivo: `No se pudo calcular el plan: ${r.falla}`,
        reintentable: true,
      },
      reintentar,
    };
  return { resultado: r, reintentar };
}
