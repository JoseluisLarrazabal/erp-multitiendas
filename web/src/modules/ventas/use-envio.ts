"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { leerSinRed } from "@/lib/offline/red";
import { hayAperturaEnCola } from "@/modules/caja";
import { createClient } from "@/lib/supabase/browser";
import type { ResumenCarrito } from "./carrito";
import {
  cobrarEnCola,
  comprobarCuenta,
  MENSAJE_AGOTADA,
  MENSAJE_CUENTA,
  protegerCobro,
  secuenciaDe,
  TIPO_VENTA,
  mayorSecuenciaEnCola,
} from "./cola-ventas";
import { cobrarEnLinea, MENSAJE_SIN_CONFIRMAR } from "./cobro-en-linea";
import { hayCuotasSinConfirmar } from "./cobro-cuota";
import { formatearNumero, siguienteSecuencia } from "./domain";
import { leerContador, subirContador } from "./equipo-local";
import { existeVenta, type Equipo } from "./queries";
import type { OrdenPayload, VentaPayload } from "./schemas";

// Cobro online-only (reserva o crédito) sin confirmar: lo que se envió y la nota armada con esos datos.
export type PendienteEnLinea = { payload: VentaPayload; nota: NotaVenta };
import { equipoTieneCola, type ColaPos } from "./use-cola";
import {
  construirNota,
  construirPayload,
  type DatosCredito,
  type DatosEnvio,
  type NotaVenta,
} from "./venta";

export type EstadoEnvio =
  | { t: "libre" }
  | { t: "enviando" }
  // Venta de reserva sin respuesta aún: se reintenta en memoria y el cobro no se puede cerrar ni repetir.
  | { t: "verificando" }
  | { t: "rechazada"; mensaje: string };

const CODIGOS_PRECIO = ["ERP_SIN_PERMISO", "ERP_DESCUENTO_TOPE", "ERP_PRODUCTO_SIN_PRECIO"];
const MENSAJE_EN_LINEA_RED =
  "Esta venta necesita conexión (reserva o crédito): no se cobró. Vuelve a intentar con red.";
// Clave del cobro a crédito sin confirmar en `pendientes` (hay una sola venta en curso a la vez).
export const CLAVE_CREDITO = "credito";
const MENSAJE_ARMAR = "No se pudo armar la venta. Recarga la página e intenta de nuevo.";
const MENSAJE_COLA =
  "No se pudo guardar la venta en este equipo, así que no se cobró. Revisa el espacio y los permisos del navegador, o recarga la página.";

export type ContextoCobro = {
  clienteId: string | null;
  descuentoVentaTexto: string;
  efectivo: number;
  qr: number;
  // El cajero confirmó que el QR llegó. Sin conexión no se pide: el pago queda pendiente de verificar.
  qrConfirmado: boolean;
  recibido: number;
  // Completar una reserva: su id y el anticipo recibido (centavos). Nunca se encola sin conexión.
  reservaId?: string;
  anticipo?: number;
  // Venta a crédito: efectivo y qr son la inicial. Tampoco se encola jamás.
  credito?: DatosCredito;
  // Lavandería: la ficha viaja con la venta (crear_orden) y la nota se imprime como boleta.
  orden?: OrdenPayload;
  nota: Pick<NotaVenta, "negocio" | "vendedor" | "cliente" | "orden">;
};

// Envío de la venta sobre la cola persistente (lib/offline). Toda venta entra primero a la cola, con su UUID, número
// (asignado bajo el cerrojo del equipo) y fecha fijados al confirmar el cobro. El primer intento va en línea (sin p_offline) con el cartel "Enviando":
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
  alExito: (nota: NotaVenta, items: VentaPayload["items"], enviada: boolean) => void;
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
  // Cobros online-only sin confirmar, por reserva (o CLAVE_CREDITO): el payload se reenvía idéntico (mismo id y número) hasta saber qué pasó
  // en el servidor. El mapa vive en estado (la pantalla lo muestra) y en un ref (hayPendiente lo lee sin render).
  const [pendientes, setPendientes] = useState<ReadonlyMap<string, PendienteEnLinea>>(new Map());
  const pendRef = useRef(pendientes);
  const fijarPendiente = useCallback((clave: string, p: PendienteEnLinea | null) => {
    const m = new Map(pendRef.current);
    if (p) m.set(clave, p);
    else m.delete(clave);
    pendRef.current = m;
    setPendientes(m);
  }, []);

  // Una reserva o un crédito nunca pasan por la cola ni por IndexedDB: sin conexión no se cobra.
  const confirmarEnLinea = useCallback(
    async (resumen: ResumenCarrito, c: ContextoCobro, clave: string) => {
      if (leerSinRed() || (await hayAperturaEnCola(equipo.id)))
        return setEstado({ t: "rechazada", mensaje: MENSAJE_EN_LINEA_RED });
      const cuenta = caducada.current
        ? "rechazar"
        : await comprobarCuenta(createClient(), usuarioId);
      if (cuenta === "rechazar") return setEstado({ t: "rechazada", mensaje: MENSAJE_CUENTA });
      if (cuenta === "red") return setEstado({ t: "rechazada", mensaje: MENSAJE_EN_LINEA_RED });
      const previo = pendRef.current.get(clave) ?? null;
      const armada: { nota?: NotaVenta } = { nota: previo?.nota };
      const ventaId = crypto.randomUUID();
      // Igual que en la venta normal: un QR sin confirmar no viaja en línea.
      const qrVerificado = !(c.qr > 0 && !c.qrConfirmado);
      const primerNumero = previo
        ? secuenciaDe(previo.payload.numero)
        : siguienteSecuencia(
            contador.current,
            leerContador(equipo.id),
            await mayorSecuenciaEnCola(equipo.id),
          );
      const salida = await cobrarEnLinea(createClient(), {
        previo: previo?.payload,
        primerNumero,
        alVerificar: () => setEstado({ t: "verificando" }),
        armar: (seq) => {
          const datos: DatosEnvio = {
            ventaId,
            dispositivoId: equipo.id,
            cajaId: cajaId!,
            numero: formatearNumero(equipo.prefijo, seq),
            clienteId: c.clienteId,
            creadaEnCliente: new Date().toISOString(),
            descuentoVentaTexto: c.descuentoVentaTexto,
            efectivo: c.efectivo,
            qr: c.qr,
            qrVerificado,
            reservaId: c.reservaId,
            anticipo: c.anticipo,
            credito: c.credito,
          };
          const payload = construirPayload(resumen, datos);
          const nota = construirNota(resumen, datos, { ...c.nota, recibido: c.recibido });
          if (!payload || !nota) return null;
          armada.nota = nota;
          return payload;
        },
      });
      if (salida.t === "no-armada" || !armada.nota)
        return setEstado({ t: "rechazada", mensaje: MENSAJE_ARMAR });
      if (salida.t === "sin-confirmar") {
        fijarPendiente(clave, { payload: salida.payload, nota: armada.nota });
        return setEstado({ t: "rechazada", mensaje: MENSAJE_SIN_CONFIRMAR });
      }
      if (salida.t === "rechazada") {
        fijarPendiente(clave, null);
        setEstado({ t: "rechazada", mensaje: salida.error });
        if (salida.codigo === "ERP_CAJA_CERRADA") await alCajaCerrada();
        else if (salida.codigo && CODIGOS_PRECIO.includes(salida.codigo)) await alErrorPrecios();
        return;
      }
      fijarPendiente(clave, null);
      contador.current = Math.max(contador.current, secuenciaDe(salida.numero));
      subirContador(equipo.id, secuenciaDe(salida.numero));
      setEstado({ t: "libre" });
      alExito({ ...armada.nota, numero: salida.numero }, salida.payload.items, true);
    },
    [equipo, cajaId, usuarioId, alCajaCerrada, alErrorPrecios, alExito, fijarPendiente],
  );

  // "Descartar y verificar": pregunta al servidor si el cobro sin confirmar quedó registrado. Si existe, muestra la nota
  // con lo congelado; si no, lo limpia y avisa que el cobro no se hizo. Si no se puede saber, conserva la entrada.
  const descartarYVerificar = useCallback(
    async (clave: string) => {
      const p = pendRef.current.get(clave);
      if (!p || ocupado.current) return;
      ocupado.current = true;
      try {
        setEstado({ t: "verificando" });
        const r = await existeVenta(createClient(), p.payload.id);
        if (!r.ok)
          return setEstado({
            t: "rechazada",
            mensaje: `No se pudo verificar (${r.error}). No entregues el producto; intenta de nuevo.`,
          });
        fijarPendiente(clave, null);
        if (!r.data)
          return setEstado({
            t: "rechazada",
            mensaje: "No se registró: el cobro no se hizo. Puedes cobrar de nuevo.",
          });
        subirContador(equipo.id, secuenciaDe(p.payload.numero));
        setEstado({ t: "libre" });
        alExito({ ...p.nota, numero: p.payload.numero }, p.payload.items, true);
      } finally {
        ocupado.current = false;
      }
    },
    [equipo.id, alExito, fijarPendiente],
  );

  const confirmar = useCallback(
    async (resumen: ResumenCarrito, c: ContextoCobro) => {
      if (ocupado.current || !cajaId) return;
      ocupado.current = true;
      try {
        if (c.reservaId || c.credito) {
          const fallo = await protegerCobro(async () => {
            setEstado({ t: "enviando" });
            await confirmarEnLinea(resumen, c, c.reservaId ?? CLAVE_CREDITO);
          });
          if (fallo) setEstado({ t: "rechazada", mensaje: fallo });
          return;
        }
        const fallo = await protegerCobro(async () => {
          setEstado({ t: "enviando" });
          // Con red, la cuenta se comprueba antes de cobrar: una sesión caducada o de otra cuenta no cobra ni encola.
          // Si no se puede saber, cuenta como sin red y la venta entra a la cola.
          let enLinea = !leerSinRed();
          // Con la apertura de la caja aún en la cola el servidor no la conoce: la venta va por la cola, detrás de ella.
          if (enLinea && (await hayAperturaEnCola(equipo.id))) enLinea = false;
          if (enLinea) {
            const cuenta = caducada.current
              ? "rechazar"
              : await comprobarCuenta(createClient(), usuarioId);
            if (cuenta === "rechazar")
              return setEstado({ t: "rechazada", mensaje: MENSAJE_CUENTA });
            if (cuenta === "red") enLinea = false;
          }
          // Un QR sin confirmar (pendiente de verificar) nunca viaja en línea: el servidor solo lo acepta con p_offline.
          // Aunque el servidor responda (navigator.onLine miente), el primer intento se salta y va por la cola.
          const qrPendiente = c.qr > 0 && !c.qrConfirmado;
          if (qrPendiente) enLinea = false;
          // Una orden sin cliente (nombre escrito sin red) tampoco viaja en línea: el servidor la rechaza sin p_offline.
          if (c.orden && !c.clienteId) enLinea = false;
          const ventaId = crypto.randomUUID();
          const armada: { nota?: NotaVenta; items?: VentaPayload["items"] } = {};
          cola.enCurso(ventaId);
          const salida = await cobrarEnCola(
            {
              id: ventaId,
              dispositivoId: equipo.id,
              ultimo: contador.current,
              armar: (seq) => {
                const datos: DatosEnvio = {
                  ventaId,
                  dispositivoId: equipo.id,
                  cajaId,
                  numero: formatearNumero(equipo.prefijo, seq),
                  clienteId: c.clienteId,
                  creadaEnCliente: new Date().toISOString(),
                  descuentoVentaTexto: c.descuentoVentaTexto,
                  efectivo: c.efectivo,
                  qr: c.qr,
                  qrVerificado: !qrPendiente,
                };
                const payload = construirPayload(resumen, datos);
                const nota = construirNota(resumen, datos, { ...c.nota, recibido: c.recibido });
                if (!payload || !nota) return null;
                armada.nota = nota;
                armada.items = payload.items;
                return {
                  id: ventaId,
                  tipo: TIPO_VENTA,
                  negocioId,
                  dispositivoId: equipo.id,
                  usuarioId,
                  payload: {
                    venta: payload,
                    tipo_cambio: tipoCambio,
                    ...(c.orden ? { orden: c.orden } : {}),
                  },
                  nota,
                  numeroImpreso: payload.numero,
                };
              },
            },
            createClient(),
            enLinea,
          );
          if (salida.t === "agotada")
            return setEstado({ t: "rechazada", mensaje: MENSAJE_AGOTADA });
          if (salida.t === "no-armada") {
            // Sin detalle: el carrito tiene precios y nombres del negocio y datos del cliente.
            console.error("confirmar: no se pudo armar la venta");
            return setEstado({ t: "rechazada", mensaje: MENSAJE_ARMAR });
          }
          if (salida.t === "no-guardada")
            return setEstado({ t: "rechazada", mensaje: MENSAJE_COLA });
          if (salida.t === "rechazada") {
            setEstado({ t: "rechazada", mensaje: salida.error });
            if (salida.codigo === "ERP_CAJA_CERRADA") await alCajaCerrada();
            else if (salida.codigo && CODIGOS_PRECIO.includes(salida.codigo))
              await alErrorPrecios();
            return;
          }
          contador.current = Math.max(contador.current, secuenciaDe(salida.numero));
          subirContador(equipo.id, secuenciaDe(salida.numero));
          setEstado({ t: "libre" });
          if (armada.nota && armada.items)
            alExito({ ...armada.nota, numero: salida.numero }, armada.items, salida.enviada);
          cola.disparar();
        });
        if (fallo) setEstado({ t: "rechazada", mensaje: fallo });
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
      confirmarEnLinea,
    ],
  );

  // Cola persistente del equipo (pendientes y rechazadas) o un envío en curso.
  const equipoId = equipo.id;
  const hayPendiente = useCallback(
    async () =>
      ocupado.current ||
      pendRef.current.size > 0 ||
      hayCuotasSinConfirmar() ||
      (await equipoTieneCola(equipoId)),
    [equipoId],
  );
  const limpiarRechazo = useCallback(
    () => setEstado((e) => (e.t === "rechazada" ? { t: "libre" } : e)),
    [],
  );

  return { estado, confirmar, limpiarRechazo, hayPendiente, pendientes, descartarYVerificar };
}
