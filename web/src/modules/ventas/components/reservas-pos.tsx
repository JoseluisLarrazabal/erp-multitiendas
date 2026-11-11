"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { formatearBs } from "@/lib/format/moneda";
import { useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import { ETIQUETA_MEDIO, bs, formatearCantidad, aMilesimas, type Indice } from "../domain";
import { cancelarReserva, cargarReservasActivas } from "../queries-reservas";
import {
  MENSAJE_CANCELACION_REPETIDA,
  MENSAJE_SIN_PERMISO_CANCELAR,
  mensajeSiRepetida,
  saldoReserva,
  totalReserva,
  type ReservaActiva,
} from "../reservas";
import { FormReserva } from "./form-reserva";

// Modo "Reservas" del POS: reservas activas del negocio, alta con anticipo, cancelar y completar (carga la venta).
// Necesita conexión: lee y escribe directo contra el servidor, nunca por la cola offline.
export function ReservasPos({
  negocioId,
  equipoId,
  ubicacionId,
  ubicaciones,
  cajaId,
  indice,
  hayCarrito,
  puedeCancelar,
  alCompletar,
}: {
  negocioId: string;
  equipoId: string;
  // Ubicación del equipo y nombres de las del negocio: solo se completa una reserva de esta ubicación.
  ubicacionId: string;
  ubicaciones: readonly { id: string; nombre: string }[];
  cajaId: string | null;
  indice: Indice | null;
  hayCarrito: boolean;
  // Cancelar devuelve el anticipo por caja: exige el permiso `anular`.
  puedeCancelar: boolean;
  alCompletar: (r: ReservaActiva) => void;
}) {
  const sinRed = useSinRed();
  const [reservas, setReservas] = useState<ReservaActiva[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Una operación por reserva y sesión de caja a cancelar: repetir la confirmación tras un corte de red devuelve lo original.
  const operaciones = useRef(new Map<string, string>());

  const cargar = useCallback(async () => {
    const r = await cargarReservasActivas(createClient(), negocioId);
    if (r.ok) {
      setReservas(r.data);
      setError(null);
    } else setError(r.error);
  }, [negocioId]);
  useEffect(() => {
    if (sinRed) return;
    let cancelado = false;
    void cargarReservasActivas(createClient(), negocioId).then((r) => {
      if (cancelado) return;
      if (r.ok) setReservas(r.data);
      else setError(r.error);
    });
    return () => {
      cancelado = true;
    };
  }, [sinRed, negocioId]);

  if (sinRed)
    return (
      <p
        role="status"
        className="bg-secondary text-secondary-foreground rounded-lg p-3 text-[15px]"
      >
        Las reservas necesitan conexión: no se pueden crear, cancelar ni completar sin red.
      </p>
    );

  return (
    <section aria-label="Reservas" className="flex flex-col gap-3">
      <FormReserva
        negocioId={negocioId}
        equipoId={equipoId}
        cajaId={cajaId}
        indice={indice}
        alCrear={() => {
          setAviso("Reserva creada: stock apartado y anticipo en caja.");
          void cargar();
        }}
        alRepetida={() => void cargar()}
      />
      <div role="status" className="flex flex-col gap-3 empty:hidden">
        {aviso && (
          <p className="bg-secondary text-secondary-foreground rounded-lg p-3 text-[15px] font-medium">
            {aviso}
          </p>
        )}
        {reservas === null && !error && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando reservas…
          </p>
        )}
        {reservas?.length === 0 && <EstadoVacio>No hay reservas activas.</EstadoVacio>}
      </div>
      {error && (
        <div
          role="alert"
          className="border-destructive bg-destructive-soft text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm font-medium"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" className="h-11" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}
      <ul
        aria-label="Reservas activas"
        className="divide-border bg-card shadow-card divide-y rounded-xl border empty:hidden"
      >
        {reservas?.map((r) => {
          const aqui = r.ubicacionId === ubicacionId;
          const donde = ubicaciones.find((u) => u.id === r.ubicacionId)?.nombre ?? "otra ubicación";
          return (
            <li
              key={r.id}
              aria-label={`Reserva de ${r.clienteNombre}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3"
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-[15px] font-semibold break-words">{r.clienteNombre}</p>
                <p className="text-[15px] break-words">
                  {r.productoNombre} × {formatearCantidad(aMilesimas(r.cantidad))}
                </p>
                <p className="text-muted-foreground text-[13px] tabular-nums">
                  Total {bs(totalReserva(r))} · anticipo {formatearBs(r.anticipo)} (
                  {ETIQUETA_MEDIO[r.medio]}) · saldo {bs(saldoReserva(r))}
                </p>
                {!aqui && <p className="text-muted-foreground text-[13px]">Reservada en {donde}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={hayCarrito || !cajaId || !aqui}
                  title={
                    !aqui
                      ? `Se completa en ${donde}`
                      : hayCarrito
                        ? "Termina o vacía la venta en curso"
                        : undefined
                  }
                  aria-label={`Completar reserva de ${r.clienteNombre}`}
                  onClick={() => alCompletar(r)}
                >
                  Completar venta
                </Button>
                {puedeCancelar ? (
                  <ConfirmarAccion
                    etiqueta="Cancelar"
                    titulo={`¿Cancelar la reserva de ${r.clienteNombre}?`}
                    descripcion={`Se libera el stock y se devuelve el anticipo de ${formatearBs(r.anticipo)} por ${ETIQUETA_MEDIO[r.medio].toLowerCase()} desde la caja abierta.`}
                    confirmar="Cancelar reserva"
                    deshabilitado={!cajaId}
                    accion={async () => {
                      if (!cajaId)
                        return { ok: false, error: "Abre la caja para devolver el anticipo." };
                      const clave = `${r.id}:${cajaId}`; // otra sesión de caja = otra operación
                      const operacion = operaciones.current.get(clave) ?? crypto.randomUUID();
                      operaciones.current.set(clave, operacion);
                      const res = await cancelarReserva(
                        createClient(),
                        operacion,
                        r.id,
                        cajaId,
                        equipoId,
                      );
                      if (!res.ok) {
                        // Ya se completó o canceló en otro equipo: se recarga la lista y se descarta la operación.
                        if (
                          res.codigo === "ERP_RESERVA_NO_ACTIVA" ||
                          res.codigo === "ERP_OPERACION_REPETIDA"
                        ) {
                          operaciones.current.delete(clave);
                          void cargar();
                        }
                        return {
                          ...res,
                          error: mensajeSiRepetida(
                            res.codigo,
                            MENSAJE_CANCELACION_REPETIDA,
                            res.error,
                          ),
                        };
                      }
                      operaciones.current.delete(clave);
                      setAviso(`Reserva de ${r.clienteNombre} cancelada: anticipo devuelto.`);
                      void cargar();
                      return { ok: true, data: null };
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground self-center text-[13px]">
                    {MENSAJE_SIN_PERMISO_CANCELAR}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
