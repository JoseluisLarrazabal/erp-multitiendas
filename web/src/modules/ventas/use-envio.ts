"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { ResumenCarrito } from "./carrito";
import { contadorInicial, formatearNumero, secuenciaAgotada, siguienteSecuencia } from "./domain";
import { guardarContador, leerContador } from "./equipo-local";
import { enviarVenta, existeVenta, type Equipo } from "./queries";
import type { VentaPayload } from "./schemas";
import { construirNota, construirPayload, type DatosEnvio, type NotaVenta } from "./venta";

export type EstadoEnvio =
  | { t: "libre" }
  | { t: "enviando" }
  | { t: "red"; mensaje: string }
  | { t: "rechazada"; mensaje: string };

type Pendiente = {
  ventaId: string;
  seq: number;
  creada: string;
  // Algún intento terminó sin respuesta: la base pudo guardar la venta.
  enDuda: boolean;
  armar: (seq: number) => { payload: VentaPayload; nota: NotaVenta } | null;
  payload: VentaPayload;
  nota: NotaVenta;
};

const CODIGOS_PRECIO = ["ERP_SIN_PERMISO", "ERP_DESCUENTO_TOPE", "ERP_PRODUCTO_SIN_PRECIO"];
const MAX_NUMERO_DUPLICADO = 25;
const MENSAJE_CUENTA =
  "La sesión caducó o es de otra cuenta. Vuelve a entrar con la misma cuenta que hizo esta venta; no la cobres de nuevo hasta comprobarla.";
const MENSAJE_AGOTADA = "Numeración del equipo agotada, avisa al encargado.";
const MENSAJE_ARMAR = "No se pudo armar la venta. Recarga la página e intenta de nuevo.";
const MENSAJE_DUPLICADOS =
  "No se pudo asignar un número de nota: otro equipo o pestaña los está usando. Recarga la página e intenta de nuevo.";

export type ContextoCobro = {
  clienteId: string | null;
  descuentoVentaTexto: string;
  efectivo: number;
  qr: number;
  recibido: number;
  nota: Pick<NotaVenta, "negocio" | "vendedor" | "cliente">;
};

// Envío de la venta. El UUID, el número y la fecha se fijan al confirmar el cobro; doble clic y reintento por red
// reenvían el mismo payload. Solo ERP_NUMERO_DUPLICADO cambia el número (la base no guardó nada) y conserva el UUID.
// Regla: `pendiente` se borra solo con resultado cierto (éxito, o rechazo con código de una venta que nunca estuvo
// en duda). Un intento sin respuesta o con respuesta ilegible la deja `enDuda`; si después llega un rechazo, antes de
// borrar se comprueba con existeVenta, porque el intento anterior pudo guardarla.
export function useEnvio(opts: {
  equipo: Equipo;
  cajaId: string | null;
  alErrorPrecios: () => Promise<void>;
  alCajaCerrada: () => Promise<void>;
  alExito: (nota: NotaVenta, items: VentaPayload["items"]) => void;
  usuarioId: string;
  sesionCaducada: boolean;
}) {
  const { equipo, cajaId, alErrorPrecios, alCajaCerrada, alExito, usuarioId } = opts;
  const caducada = useRef(opts.sesionCaducada);
  useEffect(() => {
    caducada.current = opts.sesionCaducada;
  }, [opts.sesionCaducada]);
  const contador = useRef(0);
  // Último número usado: el mayor entre el contador local y el del servidor (borrar el navegador no repite números).
  useEffect(() => {
    contador.current = contadorInicial(leerContador(equipo.id), equipo.ultimoNumero);
  }, [equipo.id, equipo.ultimoNumero]);
  const [estado, setEstado] = useState<EstadoEnvio>({ t: "libre" });
  const pendiente = useRef<Pendiente | null>(null);
  const ocupado = useRef(false);

  const cerrarEnExito = useCallback(
    (p: Pendiente) => {
      guardarContador(equipo.id, p.seq);
      contador.current = Math.max(contador.current, p.seq);
      pendiente.current = null;
      setEstado({ t: "libre" });
      alExito(p.nota, p.payload.items);
    },
    [equipo.id, alExito],
  );

  // Con la sesión caducada, o con otra cuenta en el navegador, la RLS ocultaría una venta ya guardada: ni enviar, ni
  // comprobar, ni descartar. Devuelve el motivo, o null si la cuenta es la que abrió la venta.
  const bloqueoDeCuenta = useCallback(async (): Promise<string | null> => {
    if (caducada.current) return MENSAJE_CUENTA;
    try {
      const { data } = await createClient().auth.getSession();
      return data.session?.user.id === usuarioId ? null : MENSAJE_CUENTA;
    } catch {
      return MENSAJE_CUENTA;
    }
  }, [usuarioId]);

  const enviar = useCallback(async () => {
    const p = pendiente.current;
    if (!p || ocupado.current) return;
    ocupado.current = true;
    setEstado({ t: "enviando" });
    try {
      const bloqueo = await bloqueoDeCuenta();
      if (bloqueo) {
        // Sin intento previo no hay nada que comprobar: se descarta. En duda se conserva para la cuenta correcta.
        if (p.enDuda) return setEstado({ t: "red", mensaje: bloqueo });
        pendiente.current = null;
        return setEstado({ t: "rechazada", mensaje: bloqueo });
      }
      for (let duplicados = 0; ; duplicados++) {
        const r = await enviarVenta(createClient(), p.payload);
        if (r.ok) return cerrarEnExito(p);
        if (r.codigo === "ERP_NUMERO_DUPLICADO" && duplicados < MAX_NUMERO_DUPLICADO) {
          guardarContador(equipo.id, p.seq); // ese número ya es de otra venta
          contador.current = Math.max(contador.current, p.seq); // una pestaña atrasada no se queda atascada
          const seq = siguienteSecuencia(p.seq, contador.current, leerContador(equipo.id));
          const siguiente = secuenciaAgotada(seq) ? null : p.armar(seq);
          if (!siguiente) {
            pendiente.current = null;
            return setEstado({
              t: "rechazada",
              mensaje: secuenciaAgotada(seq) ? MENSAJE_AGOTADA : MENSAJE_ARMAR,
            });
          }
          Object.assign(p, { seq, ...siguiente });
          continue;
        }
        if (r.red) {
          p.enDuda = true;
          return setEstado({ t: "red", mensaje: r.error });
        }
        if (p.enDuda) {
          const existe = await existeVenta(createClient(), p.ventaId);
          if (!existe.ok) return setEstado({ t: "red", mensaje: existe.error });
          if (existe.data) return cerrarEnExito(p);
        }
        pendiente.current = null;
        if (r.codigo === "ERP_CAJA_CERRADA") await alCajaCerrada();
        else if (r.codigo && CODIGOS_PRECIO.includes(r.codigo)) await alErrorPrecios();
        return setEstado({ t: "rechazada", mensaje: r.error });
      }
      pendiente.current = null;
      setEstado({ t: "rechazada", mensaje: MENSAJE_DUPLICADOS });
    } finally {
      ocupado.current = false;
    }
  }, [equipo.id, cerrarEnExito, alErrorPrecios, alCajaCerrada, bloqueoDeCuenta]);

  const confirmar = useCallback(
    (resumen: ResumenCarrito, c: ContextoCobro) => {
      if (pendiente.current || ocupado.current || !cajaId) return;
      const ventaId = crypto.randomUUID();
      const creada = new Date().toISOString();
      const armar = (seq: number) => {
        const numero = formatearNumero(equipo.prefijo, seq);
        const datos: DatosEnvio = {
          ventaId,
          dispositivoId: equipo.id,
          cajaId,
          numero,
          clienteId: c.clienteId,
          creadaEnCliente: creada,
          descuentoVentaTexto: c.descuentoVentaTexto,
          efectivo: c.efectivo,
          qr: c.qr,
        };
        const payload = construirPayload(resumen, datos);
        const nota = construirNota(resumen, datos, { ...c.nota, recibido: c.recibido });
        return payload && nota ? { payload, nota } : null;
      };
      // Otra pestaña del equipo pudo avanzar el contador local desde el montaje.
      const seq = siguienteSecuencia(contador.current, leerContador(equipo.id));
      if (secuenciaAgotada(seq)) return setEstado({ t: "rechazada", mensaje: MENSAJE_AGOTADA });
      const armado = armar(seq);
      if (!armado) {
        // Sin detalle: el carrito tiene precios y nombres del negocio y datos del cliente.
        console.error("confirmar: no se pudo armar la venta");
        return setEstado({ t: "rechazada", mensaje: MENSAJE_ARMAR });
      }
      pendiente.current = { ventaId, seq, creada, enDuda: false, armar, ...armado };
      void enviar();
    },
    [equipo, cajaId, enviar],
  );

  // Descarta una venta en duda: antes comprueba que no haya llegado al servidor. Comparte `ocupado` con el envío:
  // no corren a la vez, y si la comprobación falla el estado sigue `red` con su pendiente.
  const descartar = useCallback(async (): Promise<string | null> => {
    const p = pendiente.current;
    if (!p) return null;
    if (ocupado.current) return "Hay un envío en curso. Espera a que termine.";
    ocupado.current = true;
    try {
      const bloqueo = await bloqueoDeCuenta();
      if (bloqueo) return bloqueo;
      const r = await existeVenta(createClient(), p.ventaId);
      if (!r.ok) return r.error;
      if (r.data) {
        cerrarEnExito(p);
        return null;
      }
      pendiente.current = null;
      setEstado({ t: "libre" });
      return null;
    } finally {
      ocupado.current = false;
    }
  }, [cerrarEnExito, bloqueoDeCuenta]);

  const limpiarRechazo = useCallback(
    () => setEstado((e) => (e.t === "rechazada" ? { t: "libre" } : e)),
    [],
  );

  return {
    estado,
    confirmar,
    reintentar: enviar,
    descartar,
    limpiarRechazo,
    hayPendiente: () => pendiente.current !== null,
  };
}
