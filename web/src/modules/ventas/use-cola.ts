"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  leerFilas,
  quitarIlegibles,
  quitarSiRechazada,
  reabrir,
  type FilaCola,
  type LecturaCola,
} from "@/lib/offline/cola";
import { iniciarMotor, observarFilas, type Motor } from "@/lib/offline/motor";
import {
  describirOperacionCaja,
  enviarAperturaDeCola,
  enviarMovimientoDeCola,
  movimientosDeSesion,
  TIPO_APERTURA,
  TIPO_MOVIMIENTO,
} from "@/modules/caja";
import { createClient } from "@/lib/supabase/browser";
import { enviarVentaDeCola, revisarDescarte, TIPO_VENTA, type Descarte } from "./cola-ventas";
import { payloadColaVentaSchema } from "./schemas";

// Lo rechazado al enviar, de cualquier tipo: la venta, la apertura o el movimiento de caja.
export type OperacionRechazada = {
  id: string;
  tipo: string;
  // Número de nota (ventas) o descripción corta (caja).
  titulo: string;
  total: number | null;
  error: string;
};
export type Pendientes = { ventas: number; aperturas: number; movimientos: number };

export type EstadoCola = {
  // Operaciones de los negocios de la cuenta activa que esperan enviarse, por tipo.
  pendientes: Pendientes;
  rechazadas: OperacionRechazada[];
  // Filas de otros negocios: no se envían con esta cuenta, se cuentan aparte.
  ajenas: number;
  ilegibles: number;
  ordenesIlegibles: number[];
  // El equipo tiene algo en la cola, o no se sabe: no se cierra su caja ni se cambia de negocio (RN-07).
  bloqueaEquipo: boolean;
  // Como bloqueaEquipo, pero las ventas y movimientos rechazados no bloquean el cierre de caja (M-11): se avisan.
  bloqueaCierre: boolean;
  // Ventas y movimientos rechazados de este equipo en la caja actual (y, de las ventas, su total en Bs); `anteriores`
  // cuenta los de otras cajas: su efectivo no está en el esperado de hoy.
  rechazadasEquipo: { cantidad: number; totalVentas: number; anteriores: number };
  // IndexedDB no respondió al leer la cola (distinto de la espera de la primera lectura).
  lecturaFallida: boolean;
};

// null: aún no se leyó. "error": la lectura falló. En ambos casos el equipo queda bloqueado.
export type EstadoLectura = LecturaCola | "error" | null;
const VACIA: LecturaCola = { filas: [], ilegibles: 0, ordenesIlegibles: [] };

// `enCursoId`: la venta cuyo primer intento sigue en curso todavía no es "sin enviar".
export function resumirCola(
  lectura: EstadoLectura,
  negociosIds: readonly string[],
  equipoId: string,
  enCursoId: string | null = null,
  sesionId: string | null = null,
): EstadoCola {
  const { filas, ilegibles, ordenesIlegibles } = lectura && lectura !== "error" ? lectura : VACIA;
  const propias = filas.filter((f) => negociosIds.includes(f.negocioId));
  const delEquipo = filas.filter((f) => f.dispositivoId === equipoId);
  const rechazadasCaja = delEquipo.filter(
    (f) => f.estado === "rechazada" && (f.tipo === TIPO_VENTA || f.tipo === TIPO_MOVIMIENTO),
  );
  // Una fila sin sesión legible no se puede atribuir a esta caja: cuenta como anterior.
  const deEstaCaja = (f: FilaCola) => {
    if (!sesionId) return false;
    if (f.tipo !== TIPO_VENTA) return movimientosDeSesion([f], sesionId).length > 0;
    const p = payloadColaVentaSchema.safeParse(f.payload);
    return p.success && p.data.venta.caja_sesion_id === sesionId;
  };
  const rechazadasAqui = rechazadasCaja.filter(deEstaCaja);
  const totalVentasRechazadas = rechazadasAqui.reduce((suma, f) => {
    if (f.tipo !== TIPO_VENTA) return suma;
    const p = payloadColaVentaSchema.safeParse(f.payload);
    return suma + (p.success ? p.data.venta.total : 0);
  }, 0);
  const pendientesDe = (tipo: string) =>
    propias.filter((f) => f.tipo === tipo && f.estado === "pendiente" && f.id !== enCursoId).length;
  return {
    pendientes: {
      ventas: pendientesDe(TIPO_VENTA),
      aperturas: pendientesDe(TIPO_APERTURA),
      movimientos: pendientesDe(TIPO_MOVIMIENTO),
    },
    rechazadas: propias
      .filter((f) => f.estado === "rechazada")
      .flatMap((f): OperacionRechazada[] => {
        const error = f.error ?? "La operación fue rechazada.";
        if (f.tipo === TIPO_VENTA) {
          const p = payloadColaVentaSchema.safeParse(f.payload);
          return [
            {
              id: f.id,
              tipo: f.tipo,
              titulo: f.numeroImpreso ?? (p.success ? p.data.venta.numero : "sin número"),
              total: p.success ? p.data.venta.total : null,
              error,
            },
          ];
        }
        const d = describirOperacionCaja(f);
        return d ? [{ id: f.id, tipo: f.tipo, ...d, error }] : [];
      }),
    ajenas: filas.length - propias.length,
    ilegibles,
    ordenesIlegibles,
    bloqueaEquipo: !lectura || lectura === "error" || ilegibles > 0 || delEquipo.length > 0,
    bloqueaCierre:
      !lectura || lectura === "error" || ilegibles > 0 || delEquipo.length > rechazadasCaja.length,
    rechazadasEquipo: {
      cantidad: rechazadasAqui.length,
      totalVentas: totalVentasRechazadas,
      anteriores: rechazadasCaja.length - rechazadasAqui.length,
    },
    lecturaFallida: lectura === "error",
  };
}

export type ColaPos = {
  estado: EstadoCola;
  // Contenido de la cola tal como se leyó (vacío mientras se lee o si falló).
  filas: readonly FilaCola[];
  // El envío marca la venta cuyo primer intento está en curso (y la suelta con null).
  enCurso: (ventaId: string | null) => void;
  disparar: (forzar?: boolean) => void;
  reintentar: (id: string) => Promise<void>;
  revisarDescarte: (id: string) => Promise<Descarte>;
  // false: la venta ya no estaba rechazada y no se borró.
  descartar: (id: string) => Promise<boolean>;
  descartarIlegibles: (ordenes: readonly number[]) => Promise<void>;
};

// Motor de envío y estado de la cola, montados una sola vez para todas las fases de /pos: el aviso y el envío no
// dependen de que el equipo ya esté elegido (RF-VEN-10). La cola es la verdad del equipo: sobrevive a recargas y la
// comparten las pestañas.
export function useColaPos(
  negociosIds: readonly string[],
  equipoId: string,
  usuarioId: string,
  sesionCaducada: boolean,
  sesionId: string | null = null,
): ColaPos {
  const [lectura, setLectura] = useState<EstadoLectura>(null);
  const [enCursoId, setEnCursoId] = useState<string | null>(null);
  useEffect(() => observarFilas(setLectura, () => setLectura("error")), []);
  const estado = useMemo(
    () => resumirCola(lectura, negociosIds, equipoId, enCursoId, sesionId),
    [lectura, negociosIds, equipoId, enCursoId, sesionId],
  );

  const filas = useMemo(() => (lectura && lectura !== "error" ? lectura.filas : []), [lectura]);

  const negocios = useRef(negociosIds);
  const sesion = useRef({ usuarioId, sesionCaducada });
  useEffect(() => {
    negocios.current = negociosIds;
    sesion.current = { usuarioId, sesionCaducada };
  }, [negociosIds, usuarioId, sesionCaducada]);
  const motor = useRef<Motor | null>(null);
  useEffect(() => {
    motor.current = iniciarMotor({
      enviadores: {
        [TIPO_VENTA]: async (fila) =>
          (await enviarVentaDeCola(fila, createClient(), false)).resultado,
        [TIPO_APERTURA]: (fila) => enviarAperturaDeCola(fila, createClient()),
        [TIPO_MOVIMIENTO]: (fila) => enviarMovimientoDeCola(fila, createClient()),
      },
      elegible: (fila) => negocios.current.includes(fila.negocioId),
    });
    return () => {
      motor.current?.detener();
      motor.current = null;
    };
  }, []);

  // Al volver a entrar con la misma cuenta la cola retoma sin esperar el temporizador.
  const estabaCaducada = useRef(sesionCaducada);
  useEffect(() => {
    if (estabaCaducada.current && !sesionCaducada) motor.current?.disparar(true);
    estabaCaducada.current = sesionCaducada;
  }, [sesionCaducada]);

  const disparar = useCallback((forzar?: boolean) => motor.current?.disparar(forzar), []);
  const reintentar = useCallback(async (id: string) => {
    await reabrir(id);
    motor.current?.disparar(true);
  }, []);
  const revisar = useCallback(
    (id: string) =>
      revisarDescarte(createClient(), id, sesion.current.usuarioId, sesion.current.sesionCaducada),
    [],
  );

  return {
    estado,
    filas,
    enCurso: setEnCursoId,
    disparar,
    reintentar,
    revisarDescarte: revisar,
    descartar: quitarSiRechazada,
    descartarIlegibles: quitarIlegibles,
  };
}

// Lectura puntual para decidir (cambio de negocio): no se fía de un estado de pantalla que pudo quedar atrás.
// Si IndexedDB no responde no se puede saber qué hay en la cola: bloquea, igual que el estado de pantalla.
export async function equipoTieneCola(equipoId: string): Promise<boolean> {
  try {
    const l = await leerFilas();
    return resumirCola(
      l,
      l.filas.map((f: FilaCola) => f.negocioId),
      equipoId,
    ).bloqueaEquipo;
  } catch {
    return true;
  }
}
