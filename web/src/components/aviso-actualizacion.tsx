"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useSerwist } from "@serwist/turbopack/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { observarFilas } from "@/lib/offline/motor";
import { alCambiarControlador } from "@/lib/sw-controlador";
import { ConfirmarDescarte, debeAplicarSola, hayCobrosGuardados } from "@/modules/ventas";

// Tiempo razonable para que el service worker quede activo tras abrir /pos.
const ESPERA_ACTIVO_MS = 15_000;

// Evita un bucle de recargas si la actualización automática no llegara a dejar un SW nuevo activo.
const CLAVE_AUTO = "erp:actualizacion-automatica";
const ESPERA_AUTO_MS = 60_000;
const yaSeAplicoSola = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(CLAVE_AUTO) ?? 0) < ESPERA_AUTO_MS;
  } catch {
    return true;
  }
};

// Actualización del service worker (docs/stack.md): la versión nueva espera. Si queda esperando antes de que nadie toque
// el POS y no hay nada que perder, se aplica sola una vez (SKIP_WAITING + recarga). Después de interactuar la aplica el
// usuario a pedido; con la cola, un cobro o una cuota sin confirmar se bloquea, porque recargar los dejaría sin su
// pestaña. También avisa si el SW no quedó activo: sin él el POS no abre sin red.
export function AvisoActualizacion({
  lineasEnCurso,
  hayPendiente,
}: {
  lineasEnCurso: () => number;
  // Envío en curso, cola del equipo, cobros en memoria y cuotas (la guarda del POS).
  hayPendiente: () => Promise<boolean>;
}) {
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
  const interactuo = useRef(false);
  // El padre pasa una función nueva en cada render: la ref evita reiniciar la comprobación automática por eso.
  const hayPendienteRef = useRef(hayPendiente);
  useEffect(() => {
    hayPendienteRef.current = hayPendiente;
  }, [hayPendiente]);
  const [cobroSinConfirmar, setCobroSinConfirmar] = useState(false);

  useEffect(() => {
    const marcar = () => {
      interactuo.current = true;
    };
    window.addEventListener("pointerdown", marcar, true);
    window.addEventListener("keydown", marcar, true);
    return () => {
      window.removeEventListener("pointerdown", marcar, true);
      window.removeEventListener("keydown", marcar, true);
    };
  }, []);

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
    return alCambiarControlador(
      navigator.serviceWorker,
      () => {
        // Recarga una sola vez, cuando la versión nueva ya controla la página y la pidió esta pestaña.
        if (inicioAqui.current) return location.reload();
        setOtraPestana(true);
        setAplicando(false);
      },
      () => inicioAqui.current,
    );
  }, []);

  function aplicar() {
    if (!serwist || colaVacia !== true) return;
    setConfirmando(false);
    setAplicando(true);
    inicioAqui.current = true;
    serwist.messageSkipWaiting();
  }

  // Antes de la primera interacción y sin nada que perder, la versión nueva se aplica sola, una vez.
  useEffect(() => {
    if (!serwist || !enEspera || otraPestana || colaVacia !== true || yaSeAplicoSola()) return;
    let cancelado = false;
    hayPendienteRef
      .current()
      .then((pendiente) => {
        if (
          cancelado ||
          !debeAplicarSola({
            interactuo: interactuo.current,
            colaVacia,
            cobrosGuardados: hayCobrosGuardados(),
            pendiente,
            lineas: lineasEnCurso(),
          })
        )
          return;
        try {
          sessionStorage.setItem(CLAVE_AUTO, String(Date.now()));
        } catch {
          return;
        }
        aplicar();
      })
      // Sin saber si hay algo pendiente no se aplica sola.
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aplicar solo lee refs y estado ya comprobado aquí
  }, [serwist, enEspera, otraPestana, colaVacia]);

  async function alPulsar() {
    // Si la comprobación falla no se sabe: se trata como pendiente.
    if (hayCobrosGuardados() || (await hayPendiente().catch(() => true))) {
      setCobroSinConfirmar(true);
      return;
    }
    setCobroSinConfirmar(false);
    if (lineasEnCurso() > 0) setConfirmando(true);
    else aplicar();
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div role="status" aria-live="polite" className="empty:hidden">
        {otraPestana && (
          <div className="border-warning-line bg-warning-soft text-warning flex items-center gap-3 rounded-lg border px-3 py-3 text-[15px]">
            <RefreshCw className="size-4 shrink-0" aria-hidden />
            <span>
              <strong>La aplicación se actualizó en otra pestaña.</strong> Recarga la página.
            </span>
          </div>
        )}
        {enEspera && !otraPestana && (
          <div className="border-warning-line bg-warning-soft text-warning flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-3 text-[15px]">
            <RefreshCw className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 basis-56">
              <strong>Actualización disponible.</strong>{" "}
              {colaVacia === true
                ? "Aplícala cuando no estés vendiendo: se recarga la página."
                : "Hay operaciones sin enviar o rechazadas en este equipo: se podrá aplicar cuando se resuelvan."}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={colaVacia !== true || aplicando}
              onClick={() => void alPulsar()}
            >
              Actualizar ahora
            </Button>
          </div>
        )}
      </div>
      {cobroSinConfirmar && (
        <p
          role="alert"
          className="border-warning-line bg-warning-soft text-warning flex items-start gap-2 rounded-lg border px-3 py-2 text-[15px] font-medium"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Hay un cobro o una cuota sin confirmar en este navegador. Verifícalo antes de
            actualizar.
          </span>
        </p>
      )}
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
          className="border-destructive bg-destructive-soft text-destructive flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium"
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
