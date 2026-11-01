import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sanearBusqueda } from "@/modules/catalogo";
import type { Resultado } from "@/modules/usuarios/panel";
import {
  valorDeStock,
  type FilaStock,
  type Movimiento,
  type ProductoElegible,
  type Unidad,
} from "./domain";

type Cliente = SupabaseClient<Database>;
// `pagina` es la efectiva: la pedida acotada a [1, páginas].
export type Pagina<T> = { filas: T[]; total: number; pagina: number };

const falla = (texto: string): Resultado<never> => ({ ok: false, error: texto });

// Siempre columnas explícitas: authenticated no tiene select sobre stock.costo_promedio ni
// movimientos_inventario.costo_unitario, y un `select *` da 42501.
const COLUMNAS_LISTA =
  "id, codigo, codigo_barras, nombre, unidad, controla_serie, activo, stock_minimo, stock_total, stock_bajo";
const COLUMNAS_ELEGIBLE = "id, codigo, codigo_barras, nombre, unidad, controla_serie";

type FilaLista = {
  id: string | null;
  codigo: string | null;
  codigo_barras: string | null;
  nombre: string | null;
  unidad: string | null;
  controla_serie: boolean | null;
};

const aElegible = (p: FilaLista): ProductoElegible => ({
  id: p.id!,
  codigo: p.codigo!,
  codigoBarras: p.codigo_barras,
  nombre: p.nombre!,
  unidad: p.unidad as Unidad,
  controlaSerie: p.controla_serie === true,
});

const filtroTexto = (q: string) =>
  ["codigo", "codigo_barras", "nombre", "marca"].map((c) => `${c}.ilike.*${q}*`).join(",");

// Stock por producto de la página, paginado en el servidor (la vista inventario_lista agrega el total).
export async function listarStock(
  supabase: Cliente,
  negocioId: string,
  f: { q: string; bajo: boolean; pagina: number; soloActivos?: boolean },
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
    if (f.soloActivos) c = c.eq("activo", true);
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
        activo: p.activo === true,
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
        ubicacionId: m.ubicacion_id,
        tipo: m.tipo,
        cantidad: m.cantidad,
        costoUnitario: m.costo_unitario,
        refTipo: m.ref_tipo,
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
): Promise<Resultado<ProductoElegible[]>> {
  const base = () =>
    supabase
      .from("inventario_lista")
      .select(COLUMNAS_ELEGIBLE)
      .eq("negocio_id", negocioId)
      .eq("activo", true);
  const q = sanearBusqueda(texto);
  const exacto = /^[\w.-]+$/.test(texto)
    ? await base().or(`codigo.eq.${texto},codigo_barras.eq.${texto}`).limit(LIMITE_BUSQUEDA)
    : { data: [], error: null };
  const parecidos = q
    ? await base().or(filtroTexto(q)).order("nombre").limit(LIMITE_BUSQUEDA)
    : { data: [], error: null };
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

export type FilaConteo = ProductoElegible & { sistema: number };

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
    { q, bajo: false, pagina, soloActivos: true },
    porPagina,
    false,
  );
  if (!lista.ok) return lista;
  return {
    ok: true,
    data: {
      ...lista.data,
      filas: lista.data.filas.map((f) => ({
        id: f.id,
        codigo: f.codigo,
        codigoBarras: f.codigoBarras,
        nombre: f.nombre,
        unidad: f.unidad,
        controlaSerie: f.controlaSerie,
        sistema: f.porUbicacion[ubicacionId] ?? 0,
      })),
    },
  };
}
