import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { textoEnviadaPor } from "@/lib/format/enviada-por";
import { falla, type Resultado } from "@/modules/usuarios";
import type { Movimiento } from "./domain";
import { listarMovimientos } from "./queries";
import { resumenCajaSchema, type ResumenCaja } from "./schemas";

// Lecturas de /panel/cajas. Solo columnas listadas. Los totales del arqueo salen de resumen_caja (SQL), nunca de sumar
// listas en la web: las listas se truncan.
type Cliente = SupabaseClient<Database>;

export type FilaSesion = {
  id: string;
  equipo: string;
  abiertaEn: string;
  cerradaEn: string | null;
  montoInicial: number;
  montoContado: number | null;
  montoEsperado: number | null;
  diferencia: number | null;
};

const num = (n: number | string | null) => (n === null ? null : Number(n));

export async function listarSesiones(
  supabase: Cliente,
  negocioId: string,
  pagina: number,
  porPagina: number,
): Promise<Resultado<{ filas: FilaSesion[]; total: number; pagina: number }>> {
  const { count, error: errorConteo } = await supabase
    .from("caja_sesiones")
    .select("id", { count: "exact", head: true })
    .eq("negocio_id", negocioId);
  if (errorConteo) return falla("No se pudieron leer las cajas.");
  const total = count ?? 0;
  const efectiva = Math.min(Math.max(1, pagina), Math.max(1, Math.ceil(total / porPagina)));
  if (total === 0) return { ok: true, data: { filas: [], total, pagina: efectiva } };
  const desde = (efectiva - 1) * porPagina;
  const [sesiones, equipos] = await Promise.all([
    supabase
      .from("caja_sesiones")
      .select(
        "id, dispositivo_id, abierta_en, cerrada_en, monto_inicial, monto_contado, monto_esperado, diferencia",
      )
      .eq("negocio_id", negocioId)
      .order("abierta_en", { ascending: false })
      .order("id")
      .range(desde, desde + porPagina - 1),
    supabase.from("dispositivos").select("id, nombre, prefijo").eq("negocio_id", negocioId),
  ]);
  if (sesiones.error || equipos.error) return falla("No se pudieron leer las cajas.");
  const nombre = new Map(equipos.data.map((e) => [e.id, `${e.nombre} (${e.prefijo})`]));
  return {
    ok: true,
    data: {
      total,
      pagina: efectiva,
      filas: sesiones.data.map((s) => ({
        id: s.id,
        equipo: nombre.get(s.dispositivo_id) ?? "—",
        abiertaEn: s.abierta_en,
        cerradaEn: s.cerrada_en,
        montoInicial: Number(s.monto_inicial),
        montoContado: num(s.monto_contado),
        montoEsperado: num(s.monto_esperado),
        diferencia: num(s.diferencia),
      })),
    },
  };
}

export type VentaDeSesion = { id: string; numero: string; total: number; estado: string };

export const LIMITE_VENTAS = 200;

export type DetalleSesion = {
  sesion: FilaSesion;
  abiertaPor: string | null;
  cerradaPor: string | null;
  movimientos: Movimiento[];
  totalMovimientos: number;
  ventas: VentaDeSesion[];
  totalVentas: number;
  resumen: ResumenCaja;
  // Rastro de lo enviado sin conexión (RN-04). `enviadaPor` solo si difiere de quien lo registró.
  aperturaOffline: { enviadaPor: string | null } | null;
  movimientosOffline: Record<string, { enviadaPor: string | null }>;
};

async function resumenCaja(supabase: Cliente, sesionId: string): Promise<ResumenCaja | null> {
  const { data, error } = await supabase.rpc("resumen_caja", { p_sesion_id: sesionId });
  if (error) return null;
  const r = resumenCajaSchema.safeParse(data);
  return r.success ? r.data : null;
}

export async function detalleSesion(
  supabase: Cliente,
  negocioId: string,
  sesionId: string,
): Promise<Resultado<DetalleSesion | null>> {
  const { data: s, error } = await supabase
    .from("caja_sesiones")
    .select(
      "id, dispositivo_id, usuario_apertura, usuario_cierre, origen, enviada_por, abierta_en, cerrada_en, monto_inicial, monto_contado, monto_esperado, diferencia",
    )
    .eq("negocio_id", negocioId)
    .eq("id", sesionId)
    .maybeSingle();
  if (error) return falla("No se pudo leer la caja.");
  if (!s) return { ok: true, data: null };

  const [equipo, movs, ventas, resumen] = await Promise.all([
    supabase
      .from("dispositivos")
      .select("nombre, prefijo")
      .eq("id", s.dispositivo_id)
      .maybeSingle(),
    listarMovimientos(supabase, sesionId),
    supabase
      .from("ventas")
      .select("id, numero, total, estado", { count: "exact" })
      .eq("caja_sesion_id", sesionId)
      .order("recibida_en", { ascending: false })
      .order("id")
      .limit(LIMITE_VENTAS),
    resumenCaja(supabase, sesionId),
  ]);
  if (equipo.error || !movs.ok || ventas.error || !resumen)
    return falla("No se pudo leer la caja.");

  const personas = [
    s.usuario_apertura,
    s.usuario_cierre,
    s.enviada_por,
    ...movs.data.offline.map((m) => m.enviadaPor),
  ].filter((x): x is string => !!x);
  const perfiles = await supabase
    .from("perfiles")
    .select("id, nombre")
    .in("id", [...new Set(personas)]);
  if (perfiles.error) return falla("No se pudo leer la caja.");

  const nombre = new Map(perfiles.data.map((p) => [p.id, p.nombre]));
  return {
    ok: true,
    data: {
      sesion: {
        id: s.id,
        equipo: equipo.data ? `${equipo.data.nombre} (${equipo.data.prefijo})` : "—",
        abiertaEn: s.abierta_en,
        cerradaEn: s.cerrada_en,
        montoInicial: Number(s.monto_inicial),
        montoContado: num(s.monto_contado),
        montoEsperado: num(s.monto_esperado),
        diferencia: num(s.diferencia),
      },
      abiertaPor: nombre.get(s.usuario_apertura) ?? null,
      cerradaPor: s.usuario_cierre ? (nombre.get(s.usuario_cierre) ?? null) : null,
      movimientos: movs.data.movimientos,
      totalMovimientos: movs.data.total,
      ventas: ventas.data.map((v) => ({
        id: v.id,
        numero: v.numero,
        total: Number(v.total),
        estado: v.estado,
      })),
      totalVentas: ventas.count ?? ventas.data.length,
      resumen,
      aperturaOffline:
        s.origen === "offline"
          ? {
              enviadaPor: textoEnviadaPor(
                s.usuario_apertura,
                s.enviada_por,
                nombre.get(s.enviada_por ?? "") ?? null,
              ),
            }
          : null,
      movimientosOffline: Object.fromEntries(
        movs.data.offline.map((m) => [
          m.id,
          {
            enviadaPor: textoEnviadaPor(
              m.usuarioId,
              m.enviadaPor,
              nombre.get(m.enviadaPor ?? "") ?? null,
            ),
          },
        ]),
      ),
    },
  };
}
