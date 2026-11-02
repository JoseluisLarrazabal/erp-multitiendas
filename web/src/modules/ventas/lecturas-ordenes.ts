import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { falla, type Resultado } from "@/modules/usuarios";
import {
  ACTIVAS,
  cursorOrden,
  limpiarBusqueda,
  partirCursor,
  umbralSinRecoger,
  type FiltrosOrdenes,
} from "./schemas-ordenes";

// Lecturas de /panel/ordenes. Columnas explícitas: `huella` de ordenes no tiene grant (un select * falla).
type Cliente = SupabaseClient<Database>;

export type FilaOrden = {
  id: string;
  numero: string;
  cliente: string;
  prendas: number;
  casillero: string | null;
  express: boolean;
  estado: string;
  estadoEn: string;
  fechaPrometida: string;
  total: number;
};

const COLUMNAS_LISTA =
  "id, estado, estado_en, cliente_nombre, prendas, casillero, express, fecha_prometida";
const ERROR_LISTA = "No se pudieron leer las órdenes.";

export async function listarOrdenes(
  supabase: Cliente,
  negocioId: string,
  f: FiltrosOrdenes,
  porPagina: number,
): Promise<Resultado<{ filas: FilaOrden[]; siguiente: string | null }>> {
  let c = supabase.from("ordenes").select(COLUMNAS_LISTA).eq("negocio_id", negocioId);
  if (f.estado === "sin_recoger")
    c = c.eq("estado", "lista").lt("estado_en", umbralSinRecoger(Date.now()));
  else if (f.estado) c = c.eq("estado", f.estado);
  else c = c.in("estado", ACTIVAS);

  const q = limpiarBusqueda(f.q);
  if (q) {
    // El número vive en la venta (misma id que la orden): se buscan sus ids por prefijo y se suman a la búsqueda por nombre.
    const numero = q.replace(/[^A-Za-z0-9-]/g, "");
    const ids = numero
      ? await supabase
          .from("ventas")
          .select("id")
          .eq("negocio_id", negocioId)
          .ilike("numero", `${numero}%`)
          .limit(50)
      : { data: [], error: null };
    if (ids.error) return falla(ERROR_LISTA);
    const porId = ids.data.length ? `,id.in.(${ids.data.map((v) => v.id).join(",")})` : "";
    c = c.or(`cliente_nombre.ilike."*${q}*"${porId}`);
  }

  const cursor = f.desde ? partirCursor(f.desde) : null;
  if (cursor)
    c = c.or(
      `estado_en.lt."${cursor.estadoEn}",and(estado_en.eq."${cursor.estadoEn}",id.lt.${cursor.id})`,
    );

  // Pide una de más para saber si hay otra página.
  const { data, error } = await c
    .order("estado_en", { ascending: false })
    .order("id", { ascending: false })
    .limit(porPagina + 1);
  if (error) return falla(ERROR_LISTA);
  const pagina = data.slice(0, porPagina);
  if (pagina.length === 0) return { ok: true, data: { filas: [], siguiente: null } };

  const ventas = await supabase
    .from("ventas")
    .select("id, numero, total")
    .in(
      "id",
      pagina.map((o) => o.id),
    );
  if (ventas.error) return falla(ERROR_LISTA);
  const porId = new Map(ventas.data.map((v) => [v.id, v]));
  const filas = pagina.map((o) => ({
    id: o.id,
    numero: porId.get(o.id)?.numero ?? "—",
    cliente: o.cliente_nombre,
    prendas: o.prendas,
    casillero: o.casillero,
    express: o.express,
    estado: o.estado,
    estadoEn: o.estado_en,
    fechaPrometida: o.fecha_prometida,
    total: Number(porId.get(o.id)?.total ?? 0),
  }));
  const ultima = pagina.at(-1)!;
  return {
    ok: true,
    data: {
      filas,
      siguiente: data.length > porPagina ? cursorOrden(ultima.estado_en, ultima.id) : null,
    },
  };
}

export type DetalleOrden = {
  id: string;
  estado: string;
  estadoEn: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  express: boolean;
  prendas: number;
  casillero: string | null;
  fechaPrometida: string;
  nota: string | null;
  recibidaPor: string | null;
  retiradaPor: string | null;
  retiroCon: string | null;
  documentoRetiro: string | null;
  entregadaPor: string | null;
  entregadaEn: string | null;
  motivoAnulacion: string | null;
  anuladaPor: string | null;
  eventos: {
    id: string;
    estado: string;
    usuario: string | null;
    motivo: string | null;
    creadoEn: string;
  }[];
};

export async function detalleOrden(
  supabase: Cliente,
  negocioId: string,
  ordenId: string,
): Promise<Resultado<DetalleOrden | null>> {
  const error = "No se pudo leer la orden.";
  const { data: o, error: e1 } = await supabase
    .from("ordenes")
    .select(
      "id, estado, estado_en, recibida_por, cliente_nombre, cliente_telefono, express, prendas, casillero, fecha_prometida, nota, retirada_por, retiro_con, documento_retiro, entregada_por, entregada_en, motivo_anulacion, anulada_por",
    )
    .eq("negocio_id", negocioId)
    .eq("id", ordenId)
    .maybeSingle();
  if (e1) return falla(error);
  if (!o) return { ok: true, data: null };
  const ev = await supabase
    .from("orden_eventos")
    .select("id, estado, usuario_id, motivo, created_at")
    .eq("negocio_id", negocioId)
    .eq("orden_id", ordenId)
    .order("created_at")
    .order("id");
  if (ev.error) return falla(error);
  const personas = [
    ...new Set(
      [o.recibida_por, o.entregada_por, o.anulada_por, ...ev.data.map((e) => e.usuario_id)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const perfiles = await supabase.from("perfiles").select("id, nombre").in("id", personas);
  if (perfiles.error) return falla(error);
  const nombre = (id: string | null) =>
    id ? (perfiles.data.find((p) => p.id === id)?.nombre ?? null) : null;
  return {
    ok: true,
    data: {
      id: o.id,
      estado: o.estado,
      estadoEn: o.estado_en,
      clienteNombre: o.cliente_nombre,
      clienteTelefono: o.cliente_telefono,
      express: o.express,
      prendas: o.prendas,
      casillero: o.casillero,
      fechaPrometida: o.fecha_prometida,
      nota: o.nota,
      recibidaPor: nombre(o.recibida_por),
      retiradaPor: o.retirada_por,
      retiroCon: o.retiro_con,
      documentoRetiro: o.documento_retiro,
      entregadaPor: nombre(o.entregada_por),
      entregadaEn: o.entregada_en,
      motivoAnulacion: o.motivo_anulacion,
      anuladaPor: nombre(o.anulada_por),
      eventos: ev.data.map((e) => ({
        id: e.id,
        estado: e.estado,
        usuario: nombre(e.usuario_id),
        motivo: e.motivo,
        creadoEn: e.created_at,
      })),
    },
  };
}
