"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { ResumenCarrito } from "./carrito";
import {
  cobrarEnCola,
  comprobarCuenta,
  mayorSecuenciaEnCola,
  MENSAJE_AGOTADA,
  MENSAJE_CUENTA,
  secuenciaDe,
  TIPO_VENTA,
} from "./cola-ventas";
import { formatearNumero, secuenciaAgotada, siguienteSecuencia } from "./domain";
import { leerContador, subirContador } from "./equipo-local";
import type { Equipo } from "./queries";
import type { VentaPayload } from "./schemas";
import { equipoTieneCola, type ColaPos } from "./use-cola";
import { construirNota, construirPayload, type DatosEnvio, type NotaVenta } from "./venta";

export type EstadoEnvio = { t: "libre" } | { t: "enviando" } | { t: "rechazada"; mensaje: string };

const CODIGOS_PRECIO = ["ERP_SIN_PERMISO", "ERP_DESCUENTO_TOPE", "ERP_PRODUCTO_SIN_PRECIO"];
const MENSAJE_ARMAR = "No se pudo armar la venta. Recarga la página e intenta de nuevo.";
const MENSAJE_COLA =
  "No se pudo guardar la venta en este equipo, así que no se cobró. Revisa el espacio y los permisos del navegador, o recarga la página.";
const MENSAJE_QR_SIN_RED =
  "El pago por QR necesita conexión para verificarse. Cobra en efectivo o espera a tener conexión.";

export type ContextoCobro = {
  clienteId: string | null;
  descuentoVentaTexto: string;
  efectivo: number;
  qr: number;
  recibido: number;
  nota: Pick<NotaVenta, "negocio" | "vendedor" | "cliente">;
};

// Envío de la venta sobre la cola persistente (lib/offline). Toda venta entra primero a la cola, con su UUID, número y
// fecha fijados al confirmar el cobro. El primer intento va en línea (sin p_offline) con el cartel "Enviando":
//  - éxito: sale de la cola y se muestra la nota;
//  - rechazo con código: sale de la cola y vuelve al carrito con el error (la base no guardó nada);
//  - red o 8 s sin respuesta: la venta ya se entregó al cliente, queda en la cola, se muestra la nota y el motor la
//    reenvía con p_offline hasta que llegue.
// El primer intento tiene el cerrojo de su fila: el motor y las otras pestañas no la tocan hasta que termina.
// La base no duplica: el UUID es la clave de idempotencia y p_offline no entra en la huella.
export function useEnvio(opts: {
  negocioId: string;
  cola: ColaPos;
  equipo: Equipo;
  cajaId: string | null;
  tipoCambio: number | null;
  alErrorPrecios: () => Promise<void>;
  alCajaCerrada: () => Promise<void>;
  alExito: (nota: NotaVenta, items: VentaPayload["items"]) => void;
  usuarioId: string;
  sesionCaducada: boolean;
}) {
  const { negocioId, equipo, cajaId, tipoCambio, alErrorPrecios, alCajaCerrada, alExito } = opts;
  const { usuarioId, cola } = opts;
  const caducada = useRef(opts.sesionCaducada);
  useEffect(() => {
    caducada.current = opts.sesionCaducada;
  }, [opts.sesionCaducada]);
  const contador = useRef(0);
  // Último número usado: el mayor entre el contador local y el del servidor (borrar el navegador no repite números).
  useEffect(() => {
    contador.current = Math.max(leerContador(equipo.id), equipo.ultimoNumero);
  }, [equipo.id, equipo.ultimoNumero]);
  const [estado, setEstado] = useState<EstadoEnvio>({ t: "libre" });
  const ocupado = useRef(false);

  const confirmar = useCallback(
    async (resumen: ResumenCarrito, c: ContextoCobro) => {
      if (ocupado.current || !cajaId) return;
      ocupado.current = true;
      try {
        setEstado({ t: "enviando" });
        // Con red, la cuenta se comprueba antes de cobrar: una sesión caducada o de otra cuenta no cobra ni encola. Si
        // no se puede saber, cuenta como sin red y la venta entra a la cola.
        let enLinea = navigator.onLine;
        if (enLinea) {
          const cuenta = caducada.current
            ? "rechazar"
            : await comprobarCuenta(createClient(), usuarioId);
          if (cuenta === "rechazar") return setEstado({ t: "rechazada", mensaje: MENSAJE_CUENTA });
          if (cuenta === "red") enLinea = false;
        }
        // El QR se verifica contra el banco; sin conexión se ofrece como "pendiente" (fase 3, PR 3).
        if (c.qr > 0 && !enLinea) {
          return setEstado({ t: "rechazada", mensaje: MENSAJE_QR_SIN_RED });
        }
        let enCola: number;
        try {
          enCola = await mayorSecuenciaEnCola(equipo.id);
        } catch {
          return setEstado({ t: "rechazada", mensaje: MENSAJE_COLA });
        }
        // Otra pestaña del equipo pudo avanzar el contador local desde el montaje.
        const seq = siguienteSecuencia(contador.current, leerContador(equipo.id), enCola);
        if (secuenciaAgotada(seq)) return setEstado({ t: "rechazada", mensaje: MENSAJE_AGOTADA });
        const datos: DatosEnvio = {
          ventaId: crypto.randomUUID(),
          dispositivoId: equipo.id,
          cajaId,
          numero: formatearNumero(equipo.prefijo, seq),
          clienteId: c.clienteId,
          creadaEnCliente: new Date().toISOString(),
          descuentoVentaTexto: c.descuentoVentaTexto,
          efectivo: c.efectivo,
          qr: c.qr,
        };
        const payload = construirPayload(resumen, datos);
        const nota = construirNota(resumen, datos, { ...c.nota, recibido: c.recibido });
        if (!payload || !nota) {
          // Sin detalle: el carrito tiene precios y nombres del negocio y datos del cliente.
          console.error("confirmar: no se pudo armar la venta");
          return setEstado({ t: "rechazada", mensaje: MENSAJE_ARMAR });
        }
        cola.enCurso(datos.ventaId);
        const salida = await cobrarEnCola(
          {
            id: datos.ventaId,
            tipo: TIPO_VENTA,
            negocioId,
            dispositivoId: equipo.id,
            usuarioId,
            payload: { venta: payload, tipo_cambio: tipoCambio },
            nota,
            numeroImpreso: payload.numero,
          },
          createClient(),
          enLinea,
        );
        if (salida.t === "no-guardada") return setEstado({ t: "rechazada", mensaje: MENSAJE_COLA });
        if (salida.t === "rechazada") {
          setEstado({ t: "rechazada", mensaje: salida.error });
          if (salida.codigo === "ERP_CAJA_CERRADA") await alCajaCerrada();
          else if (salida.codigo && CODIGOS_PRECIO.includes(salida.codigo)) await alErrorPrecios();
          return;
        }
        contador.current = Math.max(contador.current, secuenciaDe(salida.numero));
        subirContador(equipo.id, secuenciaDe(salida.numero));
        setEstado({ t: "libre" });
        alExito({ ...nota, numero: salida.numero }, payload.items);
        cola.disparar();
      } finally {
        cola.enCurso(null);
        ocupado.current = false;
      }
    },
    [
      equipo,
      negocioId,
      cajaId,
      tipoCambio,
      usuarioId,
      cola,
      alErrorPrecios,
      alCajaCerrada,
      alExito,
    ],
  );

  // Cola persistente del equipo (pendientes y rechazadas) o un envío en curso.
  const equipoId = equipo.id;
  const hayPendiente = useCallback(
    async () => ocupado.current || (await equipoTieneCola(equipoId)),
    [equipoId],
  );
  const limpiarRechazo = useCallback(
    () => setEstado((e) => (e.t === "rechazada" ? { t: "libre" } : e)),
    [],
  );

  return { estado, confirmar, limpiarRechazo, hayPendiente };
}
