import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Resultado } from "@/modules/usuarios/panel";
import {
  sanearBusqueda,
  type Categoria,
  type Filtros,
  type FilaPrecios,
  type Lista,
  type Moneda,
  type ProductoDetalle,
  type ProductoLista,
  type TipoCambio,
} from "./domain";

type Cliente = SupabaseClient<Database>;
type Pagina<T> = { filas: T[]; total: number };

const falla = (texto: string): Resultado<never> => ({ ok: false, error: texto });

export async function listarProductos(
  supabase: Cliente,
  negocioId: string,
  f: Filtros,
  porPagina: number,
): Promise<Resultado<Pagina<ProductoLista>>> {
  let consulta = supabase
    .from("productos_lista")
    .select("*", { count: "exact" })
    .eq("negocio_id", negocioId);
  if (!f.inactivos) consulta = consulta.eq("activo", true);
  if (f.categoria) consulta = consulta.eq("categoria_id", f.categoria);
  if (f.marca) consulta = consulta.eq("marca", f.marca);
  if (f.sinPrecio) consulta = consulta.eq("con_precio", false);
  const q = sanearBusqueda(f.q);
  if (q) {
    // Ya sin comas, paréntesis ni comodines (sanearBusqueda): el texto no puede alterar el filtro.
    consulta = consulta.or(
      ["codigo", "codigo_barras", "nombre", "marca", "modelo"]
        .map((c) => `${c}.ilike.*${q}*`)
        .join(","),
    );
  }
  const desde = (f.pagina - 1) * porPagina;
  const { data, error, count } = await consulta
    .order("codigo")
    .order("id")
    .range(desde, desde + porPagina - 1);
  if (error) return falla("No se pudieron leer los productos.");
  return {
    ok: true,
    data: {
      total: count ?? 0,
      filas: data.map((p) => ({
        id: p.id!,
        codigo: p.codigo!,
        codigoBarras: p.codigo_barras,
        nombre: p.nombre!,
        marca: p.marca,
        categoria: p.categoria_nombre,
        tipo: p.tipo!,
        activo: p.activo!,
        fotoPath: p.foto_path,
        conPrecio: p.con_precio === true,
        monedaPrincipal: p.moneda_principal as Moneda | null,
        principalBs: p.principal_bs,
      })),
    },
  };
}

export async function listarCategorias(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<Categoria[]>> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre")
    .eq("negocio_id", negocioId)
    .order("nombre");
  if (error) return falla("No se pudieron leer las categorías.");
  return { ok: true, data };
}

// shortcut: trae la columna marca de todos los productos y deduplica aquí; con ~600 productos es una lectura
// pequeña. Pasar a una vista o RPC `select distinct` si el catálogo supera ~5.000 productos.
export async function listarMarcas(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<string[]>> {
  const { data, error } = await supabase
    .from("productos")
    .select("marca")
    .eq("negocio_id", negocioId)
    .not("marca", "is", null)
    .limit(5000);
  if (error) return falla("No se pudieron leer las marcas.");
  const marcas = [...new Set(data.map((f) => f.marca!))];
  return { ok: true, data: marcas.sort((a, b) => a.localeCompare(b, "es")) };
}

export async function obtenerProducto(
  supabase: Cliente,
  negocioId: string,
  productoId: string,
): Promise<Resultado<ProductoDetalle | null>> {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("id", productoId)
    .maybeSingle();
  if (error) return falla("No se pudo leer el producto.");
  if (!data) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      id: data.id,
      codigo: data.codigo,
      codigoBarras: data.codigo_barras ?? "",
      nombre: data.nombre,
      marca: data.marca ?? "",
      modelo: data.modelo ?? "",
      categoriaId: data.categoria_id ?? "",
      tipo: data.tipo,
      unidad: data.unidad,
      controlaSerie: data.controla_serie,
      garantiaMeses: data.garantia_meses == null ? "" : String(data.garantia_meses),
      stockMinimo: data.stock_minimo == null ? "" : String(data.stock_minimo).replace(".", ","),
      fotoPath: data.foto_path,
      activo: data.activo,
    },
  };
}

// URLs firmadas en lote (una sola llamada). Las que fallan quedan fuera: la lista muestra el ícono de reemplazo.
export async function urlsDeFotos(
  supabase: Cliente,
  rutas: readonly (string | null)[],
): Promise<Map<string, string>> {
  const unicas = [...new Set(rutas.filter((r): r is string => !!r))];
  const urls = new Map<string, string>();
  if (unicas.length === 0) return urls;
  const { data } = await supabase.storage.from("productos").createSignedUrls(unicas, 3600);
  for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  return urls;
}

export async function tipoCambioVigente(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<number | null>> {
  const { data, error } = await supabase
    .from("tipos_cambio")
    .select("valor")
    .eq("negocio_id", negocioId)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return falla("No se pudo leer el tipo de cambio.");
  return { ok: true, data: data?.valor ?? null };
}

export async function historialTipoCambio(
  supabase: Cliente,
  negocioId: string,
): Promise<Resultado<TipoCambio[]>> {
  const { data, error } = await supabase
    .from("tipos_cambio")
    .select("id, valor, vigente_desde, usuario_id")
    .eq("negocio_id", negocioId)
    .order("vigente_desde", { ascending: false })
    .limit(20);
  if (error) return falla("No se pudo leer el historial.");
  const ids = [...new Set(data.map((t) => t.usuario_id).filter((u): u is string => !!u))];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const { data: perfiles } = await supabase.from("perfiles").select("id, nombre").in("id", ids);
    for (const p of perfiles ?? []) nombres.set(p.id, p.nombre);
  }
  return {
    ok: true,
    data: data.map((t) => ({
      id: t.id,
      valor: t.valor,
      vigenteDesde: t.vigente_desde,
      usuario: (t.usuario_id && nombres.get(t.usuario_id)) || "—",
    })),
  };
}

// Filas de la grilla: los productos de la página, con sus precios y, con ver_costos, su costo.
export async function filasDePrecios(
  supabase: Cliente,
  productos: readonly ProductoLista[],
  negocioId: string,
  verCostos: boolean,
): Promise<Resultado<FilaPrecios[]>> {
  const ids = productos.map((p) => p.id);
  const [precios, costos] = await Promise.all([
    ids.length
      ? supabase
          .from("producto_precios")
          .select("producto_id, lista, monto, moneda")
          .in("producto_id", ids)
      : Promise.resolve({ data: [], error: null }),
    verCostos
      ? supabase.rpc("costos_stock", { p_negocio_id: negocioId })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (precios.error) return falla("No se pudieron leer los precios.");
  if (costos.error) return falla("No se pudieron leer los costos.");

  const porProducto = new Map<
    string,
    { moneda: Moneda; precios: Partial<Record<Lista, number>> }
  >();
  for (const f of precios.data ?? []) {
    const fila = porProducto.get(f.producto_id) ?? { moneda: f.moneda as Moneda, precios: {} };
    fila.precios[f.lista as Lista] = f.monto;
    porProducto.set(f.producto_id, fila);
  }
  // Un mismo costo por ubicación en la práctica (fijar_costos las iguala); se toma el primero conocido.
  const costoDe = new Map<string, number>();
  for (const c of costos.data ?? []) {
    if (c.costo_promedio != null && !costoDe.has(c.producto_id))
      costoDe.set(c.producto_id, c.costo_promedio);
  }
  return {
    ok: true,
    data: productos.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      tipo: p.tipo,
      moneda: porProducto.get(p.id)?.moneda ?? null,
      precios: porProducto.get(p.id)?.precios ?? {},
      costo: costoDe.get(p.id) ?? null,
    })),
  };
}
