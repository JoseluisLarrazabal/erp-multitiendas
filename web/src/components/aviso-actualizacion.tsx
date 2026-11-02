"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useSerwist } from "@serwist/turbopack/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { observarFilas } from "@/lib/offline/motor";
import { ConfirmarDescarte } from "@/modules/ventas";

// Tiempo razonable para que el service worker quede activo tras abrir /pos.
const ESPERA_ACTIVO_MS = 15_000;

// Actualización del service worker (docs/stack.md): la versión nueva espera y nunca recarga sola. Con la cola vacía el
// usuario la aplica a pedido (SKIP_WAITING + recarga); con la cola llena se deshabilita, porque recargar con ventas sin
// enviar las dejaría sin su pestaña. También avisa si el SW no quedó activo: sin él el POS no abre sin red.
export function AvisoActualizacion({ lineasEnCurso }: { lineasEnCurso: () => number }) {
  const { serwist } = useSerwist();
  const [enEspera, setEnEspera] = useState(false);
  const [sinActivar, setSinActivar] = useState(false);
  // null: aún no se leyó. Mientras no se sepa, se trata como cola con contenido.
  const [colaVacia, setColaVacia] = useState<boolean | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // Otra pestaña aplicó la actualización: esta sigue con el código viejo hasta recargar.
  const [otraPestana, setOtraPestana] = useState(false);
  const inicioAqui = useRef(false);

  useEffect(
    () =>
      observarFilas(
        (l) => setColaVacia(l.filas.length === 0 && l.ilegibles === 0),
        () => setColaVacia(false),
      ),
    [],
  );

  useEffect(() => {
    if (!serwist || !("serviceWorker" in navigator)) return;
    let cancelado = false;
    const alEsperar = () => setEnEspera(true);
    const alActivar = () => setSinActivar(false);
    serwist.addEventListener("waiting", alEsperar);
    serwist.addEventListener("activated", alActivar);
    // El evento `waiting` no llega si el SW ya esperaba antes de montar este componente.
    void navigator.serviceWorker.getRegistration("/pos").then((r) => {
      if (!cancelado && r?.waiting) setEnEspera(true);
    });
    const t =
      process.env.NODE_ENV === "production"
        ? setTimeout(() => {
            void navigator.serviceWorker.getRegistration("/pos").then((r) => {
              if (!cancelado && !r?.active) setSinActivar(true);
            });
          }, ESPERA_ACTIVO_MS)
        : undefined;
    return () => {
      cancelado = true;
      clearTimeout(t);
      serwist.removeEventListener("waiting", alEsperar);
      serwist.removeEventListener("activated", alActivar);
    };
  }, [serwist]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Sin controlador previo el cambio es la primera instalación (clients.claim), no una actualización.
    const habiaControlador = !!navigator.serviceWorker.controller;
    const alCambiar = () => {
      if (!habiaControlador) return;
      // Recarga una sola vez, cuando la versión nueva ya controla la página y la pidió esta pestaña.
      if (inicioAqui.current) return location.reload();
      setOtraPestana(true);
      setAplicando(false);
    };
    navigator.serviceWorker.addEventListener("controllerchange", alCambiar);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", alCambiar);
  }, []);

  function aplicar() {
    if (!serwist || colaVacia !== true) return;
    setConfirmando(false);
    setAplicando(true);
    inicioAqui.current = true;
    serwist.messageSkipWaiting();
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div role="status" aria-live="polite" className="empty:hidden">
        {otraPestana && (
          <div className="bg-secondary text-secondary-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
            <RefreshCw className="size-4 shrink-0" aria-hidden />
            <span>
              <strong>La aplicación se actualizó en otra pestaña.</strong> Recarga la página.
            </span>
          </div>
        )}
        {enEspera && !otraPestana && (
          <div className="bg-secondary text-secondary-foreground flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2 text-sm">
            <RefreshCw className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 basis-56">
              <strong>Actualización disponible.</strong>{" "}
              {colaVacia === true
                ? "Aplícala cuando no estés vendiendo: se recarga la página."
                : "Hay operaciones sin enviar en este equipo: se podrá aplicar cuando se envíen."}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={colaVacia !== true || aplicando}
              onClick={() => (lineasEnCurso() > 0 ? setConfirmando(true) : aplicar())}
            >
              Actualizar ahora
            </Button>
          </div>
        )}
      </div>
      <ConfirmarDescarte
        abierto={confirmando}
        titulo="¿Actualizar ahora?"
        descripcion="La venta en curso se descartará: el carrito se vacía al recargar la página."
        confirmar="Descartar y actualizar"
        alConfirmar={aplicar}
        alCancelar={() => setConfirmando(false)}
      />
      {sinActivar && (
        <p
          role="alert"
          className="border-destructive text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span>
            La aplicación no quedó instalada para trabajar sin conexión. Recarga la página con red;
            si sigue igual, avisa al encargado.
          </span>
        </p>
      )}
    </div>
  );
}
