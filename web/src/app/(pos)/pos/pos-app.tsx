"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvisoActualizacion } from "@/components/aviso-actualizacion";
import { DolarParalelo } from "@/modules/catalogo";
import { pedirPersistencia } from "@/lib/offline/motor";
import { ConfirmarDescarte, PosVenta, type GuardaVenta } from "@/modules/ventas";
import { PosBarra, usePosSesion } from "@/modules/usuarios";

const MENSAJE_PENDIENTE =
  "Hay ventas sin enviar o rechazadas en este equipo. Resuélvelas antes de cambiar de negocio.";
const SIN_VENTA: GuardaVenta = { lineas: () => 0, hayPendiente: async () => false };

// Una sola lectura de la sesión para la barra y para la venta.
export function PosApp({ titulo }: { titulo: React.ReactNode }) {
  const { sesion, cambiarActivo, reintentar, refrescarPermisos } = usePosSesion();
  const guarda = useRef(SIN_VENTA);
  const registrarGuarda = useCallback((g: GuardaVenta) => {
    guarda.current = g;
  }, []);
  // Pide almacenamiento persistente al abrir el POS: reduce el riesgo de que el navegador borre la cola.
  useEffect(() => {
    void pedirPersistencia();
  }, []);
  // Edad del catálogo en uso, para la barra de sin conexión.
  const [catalogoDesde, setCatalogoDesde] = useState<number | null>(null);
  const [cambio, setCambio] = useState<{
    id: string;
    resolver: (r: string | null | false) => void;
  } | null>(null);
  const negociosIds = useMemo(
    () => (sesion.fase === "lista" ? sesion.negocios.map((n) => n.negocioId) : []),
    [sesion],
  );
  const activo =
    sesion.fase === "lista"
      ? sesion.negocios.find((n) => n.negocioId === sesion.activoId)
      : undefined;

  // Cambiar de negocio desmonta la venta: con una venta pendiente no se deja, y con carrito se pide confirmar.
  const cambiarConGuarda = async (id: string): Promise<string | null | false> => {
    if (await guarda.current.hayPendiente()) return MENSAJE_PENDIENTE;
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
        catalogoDesde={catalogoDesde}
      />
      <div className="flex justify-end print:hidden">
        <DolarParalelo />
      </div>
      <AvisoActualizacion lineasEnCurso={() => guarda.current.lineas()} />
      {sesion.fase === "lista" && activo && (
        <PosVenta
          key={sesion.activoId}
          negocioId={sesion.activoId}
          negociosIds={negociosIds}
          tipoNegocio={activo.tipo}
          permisos={sesion.permisos}
          usuarioId={sesion.usuarioId}
          recargarPermisos={refrescarPermisos}
          registrarGuarda={registrarGuarda}
          atajosBloqueados={cambio !== null}
          sesionCaducada={!!sesion.caducada}
          alCambiarCatalogo={setCatalogoDesde}
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
            (await guarda.current.hayPendiente()) ? MENSAJE_PENDIENTE : await cambiarActivo(c.id),
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
