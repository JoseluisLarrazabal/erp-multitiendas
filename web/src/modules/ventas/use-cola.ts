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
import { createClient } from "@/lib/supabase/browser";
import { enviarVentaDeCola, revisarDescarte, TIPO_VENTA, type Descarte } from "./cola-ventas";
import { payloadColaVentaSchema } from "./schemas";

export type VentaRechazada = { id: string; numero: string; total: number | null; error: string };

export type EstadoCola = {
  // Ventas de los negocios de la cuenta activa que esperan enviarse.
  pendientes: number;
  rechazadas: VentaRechazada[];
  // Filas de otros negocios: no se envían con esta cuenta, se cuentan aparte.
  ajenas: number;
  ilegibles: number;
  ordenesIlegibles: number[];
  // El equipo tiene algo en la cola, o no se sabe: no se cierra su caja ni se cambia de negocio (RN-07).
  bloqueaEquipo: boolean;
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
): EstadoCola {
  const { filas, ilegibles, ordenesIlegibles } = lectura && lectura !== "error" ? lectura : VACIA;
  const propias = filas.filter((f) => negociosIds.includes(f.negocioId));
  return {
    pendientes: propias.filter(
      (f) => f.tipo === TIPO_VENTA && f.estado === "pendiente" && f.id !== enCursoId,
    ).length,
    rechazadas: propias
      .filter((f) => f.tipo === TIPO_VENTA && f.estado === "rechazada")
      .map((f) => {
        const p = payloadColaVentaSchema.safeParse(f.payload);
        return {
          id: f.id,
          numero: f.numeroImpreso ?? (p.success ? p.data.venta.numero : "sin número"),
          total: p.success ? p.data.venta.total : null,
          error: f.error ?? "La venta fue rechazada.",
        };
      }),
    ajenas: filas.length - propias.length,
    ilegibles,
    ordenesIlegibles,
    bloqueaEquipo:
      !lectura ||
      lectura === "error" ||
      ilegibles > 0 ||
      filas.some((f) => f.dispositivoId === equipoId),
    lecturaFallida: lectura === "error",
  };
}

export type ColaPos = {
  estado: EstadoCola;
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
): ColaPos {
  const [lectura, setLectura] = useState<EstadoLectura>(null);
  const [enCursoId, setEnCursoId] = useState<string | null>(null);
  useEffect(() => observarFilas(setLectura, () => setLectura("error")), []);
  const estado = useMemo(
    () => resumirCola(lectura, negociosIds, equipoId, enCursoId),
    [lectura, negociosIds, equipoId, enCursoId],
  );

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
      },
      elegible: (fila) => negocios.current.includes(fila.negocioId),
    });
    return () => {
      motor.current?.detener();
      motor.current = null;
    };
  }, []);

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
