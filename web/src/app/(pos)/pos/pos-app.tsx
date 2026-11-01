"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmarDescarte, PosVenta, type GuardaVenta } from "@/modules/ventas";
import { PosBarra, usePosSesion } from "@/modules/usuarios";

const MENSAJE_PENDIENTE =
  "Hay una venta pendiente de envío. Resuélvela antes de cambiar de negocio.";
const SIN_VENTA: GuardaVenta = { lineas: () => 0, hayPendiente: () => false };

// Una sola lectura de la sesión para la barra y para la venta.
export function PosApp({ titulo }: { titulo: React.ReactNode }) {
  const { sesion, cambiarActivo, reintentar, refrescarPermisos } = usePosSesion();
  const guarda = useRef(SIN_VENTA);
  const registrarGuarda = useCallback((g: GuardaVenta) => {
    guarda.current = g;
  }, []);
  const [cambio, setCambio] = useState<{
    id: string;
    resolver: (r: string | null | false) => void;
  } | null>(null);
  const activo =
    sesion.fase === "lista"
      ? sesion.negocios.find((n) => n.negocioId === sesion.activoId)
      : undefined;

  // Cambiar de negocio desmonta la venta: con una venta pendiente no se deja, y con carrito se pide confirmar.
  const cambiarConGuarda = (id: string): Promise<string | null | false> => {
    if (guarda.current.hayPendiente()) return Promise.resolve(MENSAJE_PENDIENTE);
    if (guarda.current.lineas() === 0) return cambiarActivo(id);
    return new Promise((resolver) => setCambio({ id, resolver }));
  };

  return (
    <>
      <PosBarra
        sesion={sesion}
        cambiarActivo={cambiarConGuarda}
        reintentar={reintentar}
        titulo={titulo}
      />
      {sesion.fase === "lista" && activo && (
        <PosVenta
          key={sesion.activoId}
          negocioId={sesion.activoId}
          tipoNegocio={activo.tipo}
          permisos={sesion.permisos}
          usuarioId={sesion.usuarioId}
          recargarPermisos={refrescarPermisos}
          registrarGuarda={registrarGuarda}
          atajosBloqueados={cambio !== null}
          sesionCaducada={!!sesion.caducada}
        />
      )}
      <ConfirmarDescarte
        abierto={cambio !== null}
        titulo="¿Cambiar de negocio?"
        descripcion="La venta en curso se descartará: el carrito se vacía."
        confirmar="Descartar y cambiar"
        alConfirmar={async () => {
          const c = cambio;
          setCambio(null);
          // Una venta pudo quedar pendiente con el diálogo abierto: se vuelve a comprobar antes de desmontar.
          c?.resolver(
            guarda.current.hayPendiente() ? MENSAJE_PENDIENTE : await cambiarActivo(c.id),
          );
        }}
        alCancelar={() => {
          cambio?.resolver(false);
          setCambio(null);
        }}
      />
    </>
  );
}
