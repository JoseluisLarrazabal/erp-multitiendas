import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sinTildes } from "@/lib/texto";
import { sanearBusqueda } from "@/modules/catalogo";
import { falla, type Resultado } from "@/modules/usuarios/panel";
import {
  ordenarPorFaltante,
  valorDeStock,
  type FilaStock,
  type Movimiento,
  type ProductoElegible,
  type Unidad,
} from "./domain";

type Cliente = SupabaseClient<Database>;
// `pagina` es la efectiva: la pedida acotada a [1, páginas].
export type Pagina<T> = { filas: T[]; total: number; pagina: number };

// Siempre columnas explícitas: authenticated no tiene select sobre stock.costo_promedio ni
// movimientos_inventario.costo_unitario, y un `select *` da 42501.
const COLUMNAS_LISTA =
  "id, codigo, codigo_barras, nombre, unidad, controla_serie, activo, stock_minimo, stock_total, stock_bajo, stock_negativo";
const COLUMNAS_ELEGIBLE = "id, codigo, codigo_barras, nombre, unidad, controla_serie, activo";

type FilaLista = Pick<
  Database["public"]["Views"]["inventario_lista"]["Row"],
  "id" | "codigo" | "codigo_barras" | "nombre" | "unidad" | "controla_serie" | "activo"
>;

const aElegible = (p: FilaLista): ProductoElegible => ({
  id: p.id!,
  codigo: p.codigo!,
  codigoBarras: p.codigo_barras,
  nombre: p.nombre!,
  unidad: p.unidad as Unidad,
  controlaSerie: p.controla_serie === true,
  activo: p.activo === true,
});

const filtroTexto = (q: string) =>
  `codigo.ilike.*${q}*,codigo_barras.ilike.*${q}*,busqueda.ilike.*${sinTildes(q)}*`;

// Stock por producto de la página, paginado en el servidor (la vista inventario_lista agrega el total).
// `negativo`: algún producto con una ubicación en negativo, aunque el total sume positivo.
export async function listarStock(
  supabase: Cliente,
  negocioId: string,
  f: { q: string; bajo: boolean; pagina: number; activosOConStock?: boolean; negativo?: boolean },
  porPagina: number,
  verCostos: boolean,
): Promise<Resultado<Pagina<FilaStock>>> {
  const q = sanearBusqueda(f.q);
  const filtrada = (soloConteo: boolean) => {
    let c = supabase
      .from("inventario_lista")
      .select(COLUMNAS_LISTA, soloConteo ? { count: "exact", head: true } : undefined)
      .eq("negocio_id", negocioId);
    if (f.bajo) c = c.eq("stock_bajo", true);
    // Conteo: un producto desactivado con stock sigue contándose (M-14).
    if (f.activosOConStock) c = c.or("activo.eq.true,stock_total.neq.0");
    if (f.negativo) c = c.eq("stock_negativo", true);
    if (q) c = c.or(filtroTexto(q));
    return c;
  };
  // Se cuenta primero: pedir un rango fuera de lo que hay da 416 en PostgREST.
  const { count, error: errorConteo } = await filtrada(true);
  if (errorConteo) return falla("No se pudo leer el inventario.");
  const total = count ?? 0;
  const pagina = Math.min(Math.max(1, f.pagina), Math.max(1, Math.ceil(total / porPagina)));
  if (total === 0) return { ok: true, data: { filas: [], total, pagina } };
  const desde = (pagina - 1) * porPagina;
  const { data, error } = await filtrada(false)
    .order("nombre")
    .order("id")
    .range(desde, desde + porPagina - 1);
  if (error) return falla("No se pudo leer el inventario.");

  const ids = data.map((p) => p.id!);
  const [stock, costos] = await Promise.all([
    supabase.from("stock").select("producto_id, ubicacion_id, cantidad").in("producto_id", ids),
    verCostos
      ? supabase.rpc("costos_stock", { p_negocio_id: negocioId, p_producto_ids: ids })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (stock.error) return falla("No se pudo leer el stock.");
  if (costos.error) return falla("No se pudieron leer los costos.");

  const costoDe = new Map<string, number | null>();
  for (const c of costos.data ?? [])
    costoDe.set(`${c.producto_id}|${c.ubicacion_id}`, c.costo_promedio);
  const porProducto = new Map<string, Record<string, number>>();
  const valorizable = new Map<string, { cantidad: number; costo: number | null }[]>();
  for (const s of stock.data) {
    porProducto.set(s.producto_id, {
      ...porProducto.get(s.producto_id),
      [s.ubicacion_id]: s.cantidad,
    });
    valorizable.set(s.producto_id, [
      ...(valorizable.get(s.producto_id) ?? []),
      { cantidad: s.cantidad, costo: costoDe.get(`${s.producto_id}|${s.ubicacion_id}`) ?? null },
    ]);
  }
  return {
    ok: true,
    data: {
      total,
      pagina,
      filas: data.map((p) => ({
        ...aElegible(p),
        stockMinimo: p.stock_minimo,
        total: p.stock_total ?? 0,
        bajo: p.stock_bajo === true,
        porUbicacion: porProducto.get(p.id!) ?? {},
        valor: verCostos ? valorDeStock(valorizable.get(p.id!) ?? []) : null,
      })),
    },
  };
}

// Cuántos productos están bajo su mínimo (productos_stock_bajo; head: no trae las filas).
export async function contarStockBajo(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<number>> {
  const { count, error } = await supabase.rpc(
    "productos_stock_bajo",
    { p_negocio_id: negocioId },
    { count: "exact", head: true },
  );
  if (error) return falla("No se pudo contar el stock bajo.");
  return { ok: true, data: count ?? 0 };
}

// Los `limite` productos más urgentes (cantidad / mínimo) y cuántos están bajo su mínimo, en una sola petición.
// shortcut: la urgencia se ordena entre los 50 más bajos por cantidad, no entre todos; mejorar si un negocio pasa de 50.
const POOL_STOCK_BAJO = 50;
export async function listarStockBajo(
  supabase: Cliente,
  negocioId: string,
  limite: number,
): Promise<
  Resultado<{
    total: number;
    filas: {
      productoId: string;
      codigo: string;
      nombre: string;
      cantidad: number;
      minimo: number;
    }[];
  }>
> {
  const { data, count, error } = await supabase
    .rpc("productos_stock_bajo", { p_negocio_id: negocioId }, { count: "exact" })
    .order("cantidad")
    .limit(POOL_STOCK_BAJO);
  if (error) return falla("No se pudo leer el stock bajo.");
  return {
    ok: true,
    data: {
      total: count ?? data.length,
      filas: ordenarPorFaltante(
        data.map((f) => ({
          productoId: f.producto_id,
          codigo: f.codigo,
          nombre: f.nombre,
          cantidad: f.cantidad,
          minimo: f.stock_minimo,
        })),
      ).slice(0, limite),
    },
  };
}

export async function obtenerProductoInventario(
  supabase: Cliente,
  negocioId: string,
  productoId: string,
): Promise<Resultado<(ProductoElegible & { activo: boolean; stockMinimo: number | null }) | null>> {
  const { data, error } = await supabase
    .from("inventario_lista")
    .select(COLUMNAS_LISTA)
    .eq("negocio_id", negocioId)
    .eq("id", productoId)
    .maybeSingle();
  if (error) return falla("No se pudo leer el producto.");
  if (!data) return { ok: true, data: null };
  return {
    ok: true,
    data: { ...aElegible(data), activo: data.activo === true, stockMinimo: data.stock_minimo },
  };
}

// Más recientes primero. Pide uno de más para saber si hay página siguiente; `siguiente` es el cursor (id del último
// movimiento mostrado).
export async function leerKardex(
  supabase: Cliente,
  productoId: string,
  filtro: { ubicacionId: string; desde: string },
  porPagina: number,
): Promise<Resultado<{ filas: Movimiento[]; siguiente: string | null }>> {
  const { data, error } = await supabase.rpc("kardex_producto", {
    p_producto_id: productoId,
    p_ubicacion_id: (filtro.ubicacionId || null) as string,
    p_limite: porPagina + 1,
    p_desde_id: (filtro.desde || null) as string,
  });
  if (error) return falla("No se pudo leer el kardex.");
  const pagina = data.slice(0, porPagina);
  return {
    ok: true,
    data: {
      siguiente: data.length > porPagina ? pagina[pagina.length - 1]!.id : null,
      filas: pagina.map((m) => ({
        id: m.id,
        revertido: m.revertido,
        ubicacionId: m.ubicacion_id,
        tipo: m.tipo,
        cantidad: m.cantidad,
        costoUnitario: m.costo_unitario,
        refTipo: m.ref_tipo,
        referencia: m.referencia,
        usuario: m.usuario_nombre,
        motivo: m.motivo,
        fecha: m.created_at,
      })),
    },
  };
}

export async function stockPorUbicacion(
  supabase: Cliente,
  productoId: string,
): Promise<Resultado<Record<string, number>>> {
  const { data, error } = await supabase
    .from("stock")
    .select("ubicacion_id, cantidad")
    .eq("producto_id", productoId);
  if (error) return falla("No se pudo leer el stock.");
  return { ok: true, data: Object.fromEntries(data.map((s) => [s.ubicacion_id, s.cantidad])) };
}

const LIMITE_BUSQUEDA = 8;

// Selector de producto: coincidencia exacta de código o de barras primero (el lector USB), luego por texto.
export async function buscarProductos(
  supabase: Cliente,
  negocioId: string,
  texto: string,
  opciones: { conInactivos?: boolean } = {},
): Promise<Resultado<ProductoElegible[]>> {
  // Salida y traslado: un desactivado con stock distinto de 0 se puede sacar o mover (M-14). Dos .or() se combinan con AND.
  const base = () => {
    const c = supabase
      .from("inventario_lista")
      .select(COLUMNAS_ELEGIBLE)
      .eq("negocio_id", negocioId);
    return opciones.conInactivos ? c.or("activo.eq.true,stock_total.neq.0") : c.eq("activo", true);
  };
  const q = sanearBusqueda(texto);
  const sinFilas = { data: [], error: null };
  const [exacto, parecidos] = await Promise.all([
    /^[\w.-]+$/.test(texto)
      ? base().or(`codigo.eq.${texto},codigo_barras.eq.${texto}`).limit(LIMITE_BUSQUEDA)
      : sinFilas,
    q ? base().or(filtroTexto(q)).order("nombre").limit(LIMITE_BUSQUEDA) : sinFilas,
  ]);
  if (exacto.error || parecidos.error) return falla("No se pudo buscar el producto.");
  const vistos = new Set<string>();
  const filas = [...exacto.data, ...parecidos.data].filter((p) => {
    if (vistos.has(p.id!)) return false;
    vistos.add(p.id!);
    return true;
  });
  return { ok: true, data: filas.slice(0, LIMITE_BUSQUEDA).map(aElegible) };
}

export type SerieDisponible = { id: string; serie: string };

export async function seriesDisponibles(
  supabase: Cliente,
  productoId: string,
  ubicacionId: string,
  limite: number,
): Promise<Resultado<SerieDisponible[]>> {
  const { data, error } = await supabase
    .from("series")
    .select("id, serie")
    .eq("producto_id", productoId)
    .eq("ubicacion_id", ubicacionId)
    .eq("estado", "disponible")
    .order("serie")
    .limit(limite);
  if (error) return falla("No se pudieron leer las series.");
  return { ok: true, data };
}

// sistema = stock + reservado: lo reservado sigue en el local aunque el kardex ya lo descontó (lo mismo que espera registrar_conteo).
export type FilaConteo = ProductoElegible & { sistema: number; reservado: number };

// Productos de una página del conteo, con lo que dice el sistema en esa ubicación.
export async function paginaConteo(
  supabase: Cliente,
  negocioId: string,
  ubicacionId: string,
  q: string,
  pagina: number,
  porPagina: number,
): Promise<Resultado<Pagina<FilaConteo>>> {
  const lista = await listarStock(
    supabase,
    negocioId,
    { q, bajo: false, pagina, activosOConStock: true },
    porPagina,
    false,
  );
  if (!lista.ok) return lista;
  const ids = lista.data.filas.map((f) => f.id);
  const { data: res, error } = ids.length
    ? await supabase
        .from("stock_reservado")
        .select("producto_id, cantidad")
        .eq("ubicacion_id", ubicacionId)
        .in("producto_id", ids)
    : { data: [], error: null };
  if (error) return falla("No se pudieron leer las reservas.");
  const reservadoDe = new Map((res ?? []).map((r) => [r.producto_id, Number(r.cantidad)]));
  return {
    ok: true,
    data: {
      ...lista.data,
      filas: lista.data.filas.map((f) => {
        const reservado = reservadoDe.get(f.id) ?? 0;
        return {
          id: f.id,
          codigo: f.codigo,
          codigoBarras: f.codigoBarras,
          nombre: f.nombre,
          unidad: f.unidad,
          controlaSerie: f.controlaSerie,
          activo: f.activo,
          sistema: (f.porUbicacion[ubicacionId] ?? 0) + reservado,
          reservado,
        };
      }),
    },
  };
}

export type LoteVencimiento = {
  loteId: string;
  codigo: string;
  vence: string;
  dias: number;
  saldo: number;
  productoNombre: string;
  productoCodigo: string;
  unidad: Unidad;
  ubicacion: string;
};

type FilaLote = {
  lote_id: string;
  codigo: string;
  vence: string;
  dias_restantes: number;
  saldo: number;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  unidad: Unidad;
  ubicacion_nombre: string;
};

// Lotes con saldo estimado que vencen en `dias` o antes (los vencidos incluidos).
export async function leerLotesPorVencer(
  supabase: Cliente,
  negocioId: string,
  dias: number,
): Promise<Resultado<LoteVencimiento[]>> {
  const { data, error } = await supabase.rpc("lotes_por_vencer", {
    p_negocio_id: negocioId,
    p_dias: dias,
  });
  if (error) return falla("No se pudieron leer los vencimientos.");
  const filas = data as FilaLote[];
  return {
    ok: true,
    data: filas.map((f) => ({
      loteId: f.lote_id,
      codigo: f.codigo,
      vence: f.vence,
      dias: f.dias_restantes,
      saldo: f.saldo,
      productoNombre: f.producto_nombre,
      productoCodigo: f.producto_codigo,
      unidad: f.unidad,
      ubicacion: f.ubicacion_nombre,
    })),
  };
}
