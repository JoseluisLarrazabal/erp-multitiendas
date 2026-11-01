import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Resultado } from "@/modules/usuarios/panel";
import {
  costoUnico,
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
// `pagina` es la efectiva: la pedida acotada a [1, páginas].
type Pagina<T> = { filas: T[]; total: number; pagina: number };

const falla = (texto: string): Resultado<never> => ({ ok: false, error: texto });

export async function listarProductos(
  supabase: Cliente,
  negocioId: string,
  f: Filtros,
  porPagina: number,
): Promise<Resultado<Pagina<ProductoLista>>> {
  const filtrada = (soloConteo: boolean) => {
    let consulta = supabase
      .from("productos_lista")
      .select("*", soloConteo ? { count: "exact", head: true } : undefined)
      .eq("negocio_id", negocioId);
    if (!f.inactivos) consulta = consulta.eq("activo", true);
    if (f.categoria) consulta = consulta.eq("categoria_id", f.categoria);
    if (f.marca) consulta = consulta.eq("marca", f.marca);
    if (f.sinPrecio) consulta = consulta.eq("con_precio", false);
    const q = sanearBusqueda(f.q);
    if (q) {
      // Ya sin comas ni paréntesis (sanearBusqueda): el texto no puede alterar el filtro.
      consulta = consulta.or(
        ["codigo", "codigo_barras", "nombre", "marca", "modelo"]
          .map((c) => `${c}.ilike.*${q}*`)
          .join(","),
      );
    }
    return consulta;
  };
  // Se cuenta primero: pedir un rango fuera de lo que hay da 416 en PostgREST (p. ej. tras guardar precios en la
  // última página de "sin precio", que queda vacía).
  const { count, error: errorConteo } = await filtrada(true);
  if (errorConteo) return falla("No se pudieron leer los productos.");
  const total = count ?? 0;
  const pagina = Math.min(Math.max(1, f.pagina), Math.max(1, Math.ceil(total / porPagina)));
  if (total === 0) return { ok: true, data: { filas: [], total, pagina } };
  const desde = (pagina - 1) * porPagina;
  const { data, error } = await filtrada(false)
    .order("codigo")
    .order("id")
    .range(desde, desde + porPagina - 1);
  if (error) return falla("No se pudieron leer los productos.");
  return {
    ok: true,
    data: {
      total,
      pagina,
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
        montoPrincipal: p.monto_principal,
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
    verCostos && ids.length
      ? supabase.rpc("costos_stock", { p_negocio_id: negocioId, p_producto_ids: ids })
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
  // El costo promedio es por ubicación: si difieren, la celda no tiene un valor único (costoUnico).
  const costosDe = new Map<string, number[]>();
  for (const c of costos.data ?? []) {
    if (c.costo_promedio != null)
      costosDe.set(c.producto_id, [...(costosDe.get(c.producto_id) ?? []), c.costo_promedio]);
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
      ...(() => {
        const { costo, varia } = costoUnico(costosDe.get(p.id) ?? []);
        return { costo, costoVaria: varia };
      })(),
    })),
  };
}
