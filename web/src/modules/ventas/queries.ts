import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { errorRpc, esFalloDeRed, MENSAJE_RED } from "@/lib/erp-errores";
import { TIEMPO_ENVIO_MS } from "@/lib/supabase/sesion";
import { falla, type Resultado } from "@/modules/usuarios";
import { leerCatalogo, respuestaVentaSchema, type Catalogo, type VentaPayload } from "./schemas";

// Reciben el cliente del navegador: /pos es cliente. Todo select lista columnas; nunca costos.
type Cliente = SupabaseClient<Database>;

export type Equipo = {
  id: string;
  nombre: string;
  prefijo: string;
  ubicacionId: string;
  ultimoNumero: number;
};

export type DatosNegocio = {
  nombre: string;
  nit: string | null;
  datosNota: string | null;
  topeDescuento: number;
};

export async function cargarNegocio(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<DatosNegocio>> {
  const { data, error } = await supabase
    .from("negocios")
    .select("nombre, nit, datos_nota, tope_descuento")
    .eq("id", negocioId)
    .maybeSingle();
  if (error) {
    const red = esFalloDeRed(error);
    return falla(red ? MENSAJE_RED : "No se pudieron leer los datos del negocio.", red);
  }
  if (!data) return falla("No se pudieron leer los datos del negocio.");
  return {
    ok: true,
    data: {
      nombre: data.nombre,
      nit: data.nit,
      datosNota: data.datos_nota,
      topeDescuento: Number(data.tope_descuento),
    },
  };
}

export async function listarEquipos(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<Equipo[]>> {
  const { data, error } = await supabase
    .from("dispositivos")
    .select("id, nombre, prefijo, ubicacion_id, ultimo_numero")
    .eq("negocio_id", negocioId)
    .order("nombre")
    .order("id");
  if (error) {
    const red = esFalloDeRed(error);
    return falla(red ? MENSAJE_RED : "No se pudieron leer los equipos.", red);
  }
  return {
    ok: true,
    data: data.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      prefijo: d.prefijo,
      ubicacionId: d.ubicacion_id,
      ultimoNumero: d.ultimo_numero,
    })),
  };
}

export async function cargarCatalogo(
  supabase: Cliente,
  ubicacionId: string,
): Promise<Resultado<Catalogo>> {
  const { data, error } = await supabase.rpc("catalogo_pos", { p_ubicacion_id: ubicacionId });
  if (error) return errorRpc(error);
  const catalogo = leerCatalogo(data);
  return catalogo
    ? { ok: true, data: catalogo }
    : falla("El catálogo llegó con un formato inesperado.");
}

// catalogo_pos no devuelve la marca: se pide aparte, por páginas, y la búsqueda funciona sin ella. Si una página falla se devuelve lo cargado y `completas: false`.
export async function cargarMarcas(
  supabase: Cliente,
  negocioId: string,
): Promise<{ marcas: Map<string, string>; completas: boolean }> {
  const marcas = new Map<string, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, marca")
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .not("marca", "is", null)
      .order("id")
      .range(desde, desde + 999);
    if (error || !data) return { marcas, completas: false };
    for (const f of data) if (f.marca) marcas.set(f.id, f.marca);
    if (data.length < 1000) break;
  }
  return { marcas, completas: true };
}

export type SerieDisponible = { id: string; serie: string };

export async function seriesDisponibles(
  supabase: Cliente,
  productoId: string,
  ubicacionId: string,
): Promise<Resultado<SerieDisponible[]>> {
  const { data, error } = await supabase
    .from("series")
    .select("id, serie")
    .eq("producto_id", productoId)
    .eq("ubicacion_id", ubicacionId)
    .eq("estado", "disponible")
    .order("serie")
    .limit(200);
  if (error) return falla("No se pudieron leer las series.");
  return { ok: true, data };
}

export async function nombreVendedor(
  supabase: Cliente,
  usuarioId: string,
): Promise<Resultado<string | null>> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", usuarioId)
    .maybeSingle();
  if (error) return falla("No se pudo leer el nombre del vendedor.", esFalloDeRed(error));
  return { ok: true, data: data?.nombre ?? null };
}

export type ErrorEnvio = { ok: false; codigo: string | null; red: boolean; error: string };

// Reenvío desde la cola: la venta ya se cobró, el servidor marca en vez de rechazar (docs/plan-fase-3.md).
export type OfflineVenta = {
  vendedor_id: string;
  tipo_cambio: number | null;
  numero_impreso: string | null;
};

// El abort y el timeout llegan como error sin código de Postgres: cuentan como fallo de red (esFalloDeRed).
export async function enviarVenta(
  supabase: Cliente,
  payload: VentaPayload,
  offline?: OfflineVenta,
): Promise<{ ok: true; numero: string } | ErrorEnvio> {
  const { data, error } = await supabase
    .rpc(
      "registrar_venta",
      offline ? { p_venta: payload, p_offline: offline } : { p_venta: payload },
    )
    .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS));
  if (error) return { ...errorRpc(error), red: esFalloDeRed(error) };
  const r = respuestaVentaSchema.safeParse(data);
  return r.success
    ? { ok: true, numero: r.data.numero }
    : {
        // La venta pudo guardarse: se trata como duda de red y se reintenta el mismo payload (idempotente por id).
        ok: false,
        codigo: null,
        red: true,
        error: "La respuesta del servidor no se entendió. Reintenta.",
      };
}

// ¿La venta con este UUID ya está en el servidor? Sirve antes de descartar una venta cuyo envío quedó en duda.
export async function existeVenta(supabase: Cliente, ventaId: string): Promise<Resultado<boolean>> {
  const { data, error } = await supabase
    .from("ventas")
    .select("id")
    .eq("id", ventaId)
    .abortSignal(AbortSignal.timeout(TIEMPO_ENVIO_MS))
    .maybeSingle();
  if (error) {
    const red = esFalloDeRed(error);
    return falla(red ? MENSAJE_RED : "No se pudo comprobar la venta.", red);
  }
  return { ok: true, data: data !== null };
}
