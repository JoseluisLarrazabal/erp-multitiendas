import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { errorRpc, MENSAJE_RED } from "@/lib/erp-errores";
import type { Database } from "@/lib/supabase/database.types";
import { TIEMPO_ENVIO_MS } from "@/lib/supabase/sesion";
import { falla, type Resultado } from "@/modules/usuarios";
import { llamar } from "./queries-ordenes";
import type { ReservaActiva } from "./reservas";
import { reservaActivaSchema, type ReservaPayload } from "./schemas-reservas";

type Cliente = SupabaseClient<Database>;

// Online-only: las reservas leen y escriben directo contra el servidor, nunca pasan por la cola offline.
export async function cargarReservasActivas(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<ReservaActiva[]>> {
  try {
    const { data, error } = await supabase
      .rpc("reservas_activas", { p_negocio_id: negocioId })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
    if (error) return errorRpc(error);
    const r = z.array(reservaActivaSchema).safeParse(data);
    if (!r.success) return falla("La respuesta del servidor no se entendió.");
    return {
      ok: true,
      data: r.data.map((f) => ({
        id: f.id,
        clienteId: f.cliente_id,
        clienteNombre: f.cliente_nombre,
        productoId: f.producto_id,
        productoNombre: f.producto_nombre,
        ubicacionId: f.ubicacion_id,
        cantidad: f.cantidad,
        precioAcordado: f.precio_acordado,
        anticipo: f.anticipo,
        medio: f.medio,
        creadaEn: f.created_at,
      })),
    };
  } catch {
    return falla(MENSAJE_RED, true);
  }
}

export async function crearReserva(supabase: Cliente, payload: ReservaPayload) {
  return llamar(
    supabase
      .rpc("crear_reserva", { p_reserva: payload })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS)),
  );
}

// Libera el stock y devuelve el anticipo por la caja abierta `sesionId`.
// `operacionId` identifica el intento: repetirlo devuelve el resultado original en vez de ERP_RESERVA_NO_ACTIVA.
export async function cancelarReserva(
  supabase: Cliente,
  operacionId: string,
  reservaId: string,
  sesionId: string,
  dispositivoId: string,
) {
  return llamar(
    supabase
      .rpc("cancelar_reserva", {
        p_operacion_id: operacionId,
        p_reserva_id: reservaId,
        p_sesion_id: sesionId,
        p_dispositivo_id: dispositivoId,
      })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS)),
  );
}
