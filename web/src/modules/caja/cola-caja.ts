import type { SupabaseClient } from "@supabase/supabase-js";
import { encolar, leerFilas, type FilaCola, type ResultadoEnvio } from "@/lib/offline/cola";
import { resultadoDeError } from "@/lib/offline/envio";
import { formatearBs } from "@/lib/format/moneda";
import type { Database } from "@/lib/supabase/database.types";
import { leerSesion, TIEMPO_ENVIO_MS } from "@/lib/supabase/sesion";
import { ETIQUETA_MOVIMIENTO } from "./domain";
import {
  payloadAperturaSchema,
  payloadMovimientoSchema,
  type PayloadApertura,
  type PayloadMovimiento,
  type SesionCaja,
} from "./schemas";

export const TIPO_APERTURA = "apertura";
export const TIPO_MOVIMIENTO = "movimiento";

const MENSAJE_ILEGIBLE = "La operación guardada no se pudo leer. Avisa al encargado.";
const MENSAJE_CAJA_ABIERTA =
  "El servidor ya tenía una caja abierta en este equipo. Las ventas hechas con esta apertura quedan rechazadas: resuélvelas una por una.";

type Cliente = SupabaseClient<Database>;
type Contexto = { negocioId: string; dispositivoId: string; usuarioId: string };

// La apertura entra a la cola con el UUID de la sesión como id de operación: el POS usa ese mismo UUID como `cajaId`
// local desde ya, y las ventas que la sigan en la cola apuntan a ella.
export async function encolarApertura(
  c: Contexto & { id: string; montoInicial: number },
): Promise<SesionCaja> {
  const creada = new Date().toISOString();
  const payload: PayloadApertura = {
    id: c.id,
    negocio_id: c.negocioId,
    dispositivo_id: c.dispositivoId,
    monto_inicial: c.montoInicial,
    creada_en: creada,
  };
  await encolar({
    id: c.id,
    tipo: TIPO_APERTURA,
    negocioId: c.negocioId,
    dispositivoId: c.dispositivoId,
    usuarioId: c.usuarioId,
    payload,
    nota: null,
    numeroImpreso: null,
  });
  return { id: c.id, monto_inicial: c.montoInicial, abierta_en: creada };
}

export async function encolarMovimiento(
  c: Contexto & Omit<PayloadMovimiento, "creada_en">,
): Promise<void> {
  const payload: PayloadMovimiento = {
    id: c.id,
    sesion_id: c.sesion_id,
    tipo: c.tipo,
    monto: c.monto,
    motivo: c.motivo,
    creada_en: new Date().toISOString(),
  };
  await encolar({
    id: c.id,
    tipo: TIPO_MOVIMIENTO,
    negocioId: c.negocioId,
    dispositivoId: c.dispositivoId,
    usuarioId: c.usuarioId,
    payload,
    nota: null,
    numeroImpreso: null,
  });
}

// Mismo criterio que las ventas: sin sesión no hay petición, es una pausa y no un fallo.
async function enviar(
  fila: FilaCola,
  supabase: Cliente,
  llamar: () => PromiseLike<{ error: { message?: string; code?: string } | null }>,
  traducir: (r: ResultadoEnvio) => ResultadoEnvio = (r) => r,
): Promise<ResultadoEnvio> {
  const sesion = await leerSesion(supabase);
  if (sesion === "red" || sesion === "ninguna") return { t: "pausa" };
  const { error } = await llamar();
  return error ? traducir(resultadoDeError(error, fila.intentos)) : { t: "ok" };
}

export function enviarAperturaDeCola(fila: FilaCola, supabase: Cliente): Promise<ResultadoEnvio> {
  const p = payloadAperturaSchema.safeParse(fila.payload);
  if (!p.success) return Promise.resolve({ t: "rechazo", error: MENSAJE_ILEGIBLE });
  return enviar(
    fila,
    supabase,
    () =>
      supabase
        .rpc("abrir_caja", {
          p_id: p.data.id,
          p_negocio_id: p.data.negocio_id,
          p_dispositivo_id: p.data.dispositivo_id,
          p_monto_inicial: p.data.monto_inicial,
          p_offline: { creada_en: p.data.creada_en, usuario_id: fila.usuarioId },
        })
        .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS)),
    (r) =>
      r.t === "rechazo" && r.codigo === "ERP_CAJA_ABIERTA"
        ? { ...r, error: MENSAJE_CAJA_ABIERTA }
        : r,
  );
}

export function enviarMovimientoDeCola(fila: FilaCola, supabase: Cliente): Promise<ResultadoEnvio> {
  const p = payloadMovimientoSchema.safeParse(fila.payload);
  if (!p.success) return Promise.resolve({ t: "rechazo", error: MENSAJE_ILEGIBLE });
  return enviar(fila, supabase, () =>
    supabase
      .rpc("registrar_movimiento_caja", {
        p_id: p.data.id,
        p_sesion_id: p.data.sesion_id,
        p_tipo: p.data.tipo,
        p_monto: p.data.monto,
        p_motivo: p.data.motivo,
        p_offline: { creada_en: p.data.creada_en, usuario_id: fila.usuarioId },
      })
      .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS)),
  );
}

// Para la lista de rechazadas del POS. null: la fila no es de caja.
export function describirOperacionCaja(
  fila: Pick<FilaCola, "tipo" | "payload">,
): { titulo: string; total: number | null } | null {
  if (fila.tipo === TIPO_APERTURA) {
    const p = payloadAperturaSchema.safeParse(fila.payload);
    return { titulo: "Apertura de caja", total: p.success ? p.data.monto_inicial : null };
  }
  if (fila.tipo === TIPO_MOVIMIENTO) {
    const p = payloadMovimientoSchema.safeParse(fila.payload);
    return p.success
      ? { titulo: `${ETIQUETA_MOVIMIENTO[p.data.tipo]}: ${p.data.motivo}`, total: p.data.monto }
      : { titulo: "Movimiento de caja", total: null };
  }
  return null;
}

// Apertura que el equipo hizo sin conexión y aún no llegó: manda la local sobre lo que diga el servidor.
export async function aperturaEnCola(dispositivoId: string): Promise<SesionCaja | null> {
  const { filas } = await leerFilas();
  for (const f of filas) {
    if (f.tipo !== TIPO_APERTURA || f.estado !== "pendiente" || f.dispositivoId !== dispositivoId)
      continue;
    const p = payloadAperturaSchema.safeParse(f.payload);
    if (p.success)
      return { id: p.data.id, monto_inicial: p.data.monto_inicial, abierta_en: p.data.creada_en };
  }
  return null;
}

// Con una apertura sin enviar, el servidor aún no conoce la caja: lo que dependa de ella (ventas, movimientos) va por
// la cola, detrás de la apertura. Si no se puede leer la cola, se asume que sí (la cola es la vía segura).
export const hayAperturaEnCola = (dispositivoId: string): Promise<boolean> =>
  aperturaEnCola(dispositivoId).then(
    (a) => a !== null,
    () => true,
  );

export type MovimientoEnCola = {
  id: string;
  tipo: PayloadMovimiento["tipo"];
  monto: number;
  motivo: string;
  creadaEn: string;
};

export function movimientosDeSesion(
  filas: readonly FilaCola[],
  sesionId: string,
): MovimientoEnCola[] {
  const r: MovimientoEnCola[] = [];
  for (const f of filas) {
    if (f.tipo !== TIPO_MOVIMIENTO) continue;
    const p = payloadMovimientoSchema.safeParse(f.payload);
    if (p.success && p.data.sesion_id === sesionId)
      r.push({
        id: p.data.id,
        tipo: p.data.tipo,
        monto: p.data.monto,
        motivo: p.data.motivo,
        creadaEn: p.data.creada_en,
      });
  }
  return r;
}

export const textoMontoCola = (m: MovimientoEnCola) =>
  `${m.tipo === "ingreso" ? "+" : "−"}${formatearBs(m.monto)}`;
