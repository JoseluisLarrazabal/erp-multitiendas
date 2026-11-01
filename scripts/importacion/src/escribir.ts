import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Plan, Producto } from "./plan.ts";
import { claveCategoria } from "./reglas.ts";

export type Cliente = SupabaseClient;

const LOTE = 200;
const PAGINA = 1000;

type Respuesta = { data: unknown; error: { message: string } | null };

async function leerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<Respuesta>,
  esquema: z.ZodType<T>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = z.array(esquema).parse(data);
    filas.push(...pagina);
    if (pagina.length < PAGINA) return filas;
  }
}

async function insertarEnLotes<T extends object, R>(
  filas: T[],
  insertar: (lote: T[]) => PromiseLike<Respuesta>,
  esquema: z.ZodType<R>,
): Promise<R[]> {
  const devueltas: R[] = [];
  for (let i = 0; i < filas.length; i += LOTE) {
    const { data, error } = await insertar(filas.slice(i, i + LOTE));
    if (error) throw new Error(error.message);
    devueltas.push(...z.array(esquema).parse(data));
  }
  return devueltas;
}

const Ubic = z.object({ id: z.guid(), nombre: z.string() });
const Categoria = z.object({ id: z.guid(), nombre: z.string() });
const ProductoDb = z.object({
  id: z.guid(),
  codigo: z.string(),
  codigo_barras: z.string().nullable(),
});
const ResultadoInicial = z.object({ creados: z.number().int(), ya_existian: z.number().int() });

export type ResultadoEscritura = {
  categoriasCreadas: number;
  categoriasYaExistian: number;
  productosCreados: number;
  productosYaExistian: number;
  /** Códigos de barras que ya tenía otro producto del negocio: el nuevo queda sin código. */
  barrasEnConflicto: number;
  stockInicialCreado: number;
  stockInicialYaExistia: number;
};

/** Aplica el plan. Idempotente: producto por (negocio_id, codigo), `inicial` por producto (lo decide la RPC). */
export async function escribir(
  cliente: Cliente,
  negocioId: string,
  plan: Plan,
): Promise<ResultadoEscritura> {
  const negocio = await cliente.from("negocios").select("id").eq("id", negocioId);
  if (negocio.error) throw new Error(negocio.error.message);
  if (negocio.data.length !== 1) throw new Error("El negocio indicado no existe");

  // Las ubicaciones se identifican por nombre dentro del negocio; si falta una usada, se aborta antes de escribir.
  const ubicaciones = new Map(
    (
      await leerTodo(
        (d, h) =>
          cliente
            .from("ubicaciones")
            .select("id, nombre")
            .eq("negocio_id", negocioId)
            .order("id")
            .range(d, h),
        Ubic,
      )
    ).map((u) => [u.nombre, u.id]),
  );
  for (const nombre of new Set(plan.aceptadas.map((p) => p.ubicacion))) {
    if (!ubicaciones.has(nombre)) throw new Error(`El negocio no tiene la ubicación "${nombre}"`);
  }

  const resultado: ResultadoEscritura = {
    categoriasCreadas: 0,
    categoriasYaExistian: 0,
    productosCreados: 0,
    productosYaExistian: 0,
    barrasEnConflicto: 0,
    stockInicialCreado: 0,
    stockInicialYaExistia: 0,
  };

  const categorias = new Map(
    (
      await leerTodo(
        (d, h) =>
          cliente
            .from("categorias")
            .select("id, nombre")
            .eq("negocio_id", negocioId)
            .order("id")
            .range(d, h),
        Categoria,
      )
    ).map((c) => [claveCategoria(c.nombre), c.id]),
  );
  const nuevas = plan.categorias.filter((n) => !categorias.has(claveCategoria(n)));
  resultado.categoriasYaExistian = plan.categorias.length - nuevas.length;
  const creadas = await insertarEnLotes(
    nuevas.map((nombre) => ({ negocio_id: negocioId, nombre })),
    (lote) => cliente.from("categorias").insert(lote).select("id, nombre"),
    Categoria,
  );
  for (const c of creadas) categorias.set(claveCategoria(c.nombre), c.id);
  resultado.categoriasCreadas = creadas.length;

  const existentes = await leerTodo(
    (d, h) =>
      cliente
        .from("productos")
        .select("id, codigo, codigo_barras")
        .eq("negocio_id", negocioId)
        .order("id")
        .range(d, h),
    ProductoDb,
  );
  const idPorCodigo = new Map(existentes.map((p) => [p.codigo, p.id]));
  const barrasUsadas = new Set(
    existentes.flatMap((p) => (p.codigo_barras ? [p.codigo_barras] : [])),
  );
  const porCrear: Producto[] = [];
  for (const p of plan.aceptadas) {
    if (idPorCodigo.has(p.codigo)) resultado.productosYaExistian++;
    else porCrear.push(p);
  }
  const filasProducto = porCrear.map((p) => {
    const conflicto = p.barras !== null && barrasUsadas.has(p.barras);
    if (conflicto) resultado.barrasEnConflicto++;
    return {
      negocio_id: negocioId,
      codigo: p.codigo,
      codigo_barras: conflicto ? null : p.barras,
      nombre: p.nombre,
      marca: p.marca || null,
      modelo: p.modelo || null,
      categoria_id:
        p.categoria === null ? null : (categorias.get(claveCategoria(p.categoria)) ?? null),
      tipo: "producto",
      unidad: "unidad",
    };
  });
  // Catálogo, no contabilidad: insert directo (el kardex, abajo, solo por RPC).
  const insertados = await insertarEnLotes(
    filasProducto,
    (lote) => cliente.from("productos").insert(lote).select("id, codigo"),
    z.object({ id: z.guid(), codigo: z.string() }),
  );
  for (const p of insertados) idPorCodigo.set(p.codigo, p.id);
  resultado.productosCreados = insertados.length;

  // Stock inicial por RPC (kardex): el trigger crea y suma `stock`. usuario_id queda null (no hay sesión).
  const items = [];
  for (const p of plan.aceptadas) {
    if (p.stock === 0) continue;
    const productoId = idPorCodigo.get(p.codigo);
    const ubicacionId = ubicaciones.get(p.ubicacion);
    if (!productoId || !ubicacionId) throw new Error("Producto o ubicación sin resolver");
    items.push({ producto_id: productoId, ubicacion_id: ubicacionId, cantidad: p.stock });
  }
  for (let i = 0; i < items.length; i += LOTE) {
    const { data, error } = await cliente.rpc("registrar_stock_inicial", {
      p_negocio_id: negocioId,
      p_items: items.slice(i, i + LOTE),
    });
    if (error) throw new Error(error.message);
    const r = ResultadoInicial.parse(data);
    resultado.stockInicialCreado += r.creados;
    resultado.stockInicialYaExistia += r.ya_existian;
  }
  return resultado;
}

const Cantidad = z.object({
  producto_id: z.guid(),
  ubicacion_id: z.guid(),
  cantidad: z.coerce.number(),
});

export type EstadoBase = {
  /** Del archivo de esta corrida: stock `inicial`/`importacion` de sus productos (por `codigo`), en el negocio. */
  importadoPorUbicacion: Record<string, number>;
  importadoTotal: number;
  /** Del negocio entero: pares (producto, ubicación) donde `stock` no es la suma del kardex. */
  diferenciasKardex: number;
  /** De los productos de esta corrida. */
  productosAuditados: number;
  auditadosConUsuario: number;
};

// Milésimas enteras: la suma no arrastra error de coma flotante (numeric(12,3) en la base).
const mil = (n: number): number => Math.round(n * 1000);

/** Lee lo que quedó en la base para conciliar. `codigos`: los productos aceptados de este archivo. */
export async function leerEstado(
  cliente: Cliente,
  negocioId: string,
  codigos: string[],
): Promise<EstadoBase> {
  const nombres = new Map(
    (
      await leerTodo(
        (d, h) =>
          cliente
            .from("ubicaciones")
            .select("id, nombre")
            .eq("negocio_id", negocioId)
            .order("id")
            .range(d, h),
        Ubic,
      )
    ).map((u) => [u.id, u.nombre]),
  );
  const delArchivo = new Set(codigos);
  const idsArchivo = new Set(
    (
      await leerTodo(
        (d, h) =>
          cliente
            .from("productos")
            .select("id, codigo, codigo_barras")
            .eq("negocio_id", negocioId)
            .order("id")
            .range(d, h),
        ProductoDb,
      )
    )
      .filter((p) => delArchivo.has(p.codigo))
      .map((p) => p.id),
  );
  const movimientos = await leerTodo(
    (d, h) =>
      cliente
        .from("movimientos_inventario")
        .select("producto_id, ubicacion_id, cantidad, ref_tipo, tipo")
        .eq("negocio_id", negocioId)
        .order("id")
        .range(d, h),
    Cantidad.extend({ ref_tipo: z.string().nullable(), tipo: z.string() }),
  );
  const importadoMil: Record<string, number> = {};
  let totalMil = 0;
  const kardex = new Map<string, number>();
  for (const m of movimientos) {
    const clave = `${m.producto_id}:${m.ubicacion_id}`;
    kardex.set(clave, (kardex.get(clave) ?? 0) + mil(m.cantidad));
    if (m.tipo === "inicial" && m.ref_tipo === "importacion" && idsArchivo.has(m.producto_id)) {
      const nombre = nombres.get(m.ubicacion_id) ?? "?";
      importadoMil[nombre] = (importadoMil[nombre] ?? 0) + mil(m.cantidad);
      totalMil += mil(m.cantidad);
    }
  }
  const filasStock = await leerTodo(
    (d, h) =>
      cliente
        .from("stock")
        .select("producto_id, ubicacion_id, cantidad")
        .eq("negocio_id", negocioId)
        .order("producto_id")
        .order("ubicacion_id")
        .range(d, h),
    Cantidad,
  );
  const enStock = new Map(
    filasStock.map((s) => [`${s.producto_id}:${s.ubicacion_id}`, mil(s.cantidad)]),
  );
  let diferenciasKardex = 0;
  for (const clave of new Set([...kardex.keys(), ...enStock.keys()])) {
    if ((kardex.get(clave) ?? 0) !== (enStock.get(clave) ?? 0)) diferenciasKardex++;
  }

  // registro_id es el id del producto (texto). Se filtra aquí: una lista de ids en la URL no cabe.
  const auditoria = await leerTodo(
    (d, h) =>
      cliente
        .from("auditoria")
        .select("registro_id, usuario_id")
        .eq("negocio_id", negocioId)
        .eq("tabla", "productos")
        .eq("accion", "insert")
        .order("id")
        .range(d, h),
    z.object({ registro_id: z.string(), usuario_id: z.string().nullable() }),
  );
  const propias = auditoria.filter((a) => idsArchivo.has(a.registro_id));
  return {
    importadoPorUbicacion: Object.fromEntries(
      Object.entries(importadoMil).map(([k, v]) => [k, v / 1000]),
    ),
    importadoTotal: totalMil / 1000,
    diferenciasKardex,
    productosAuditados: propias.length,
    auditadosConUsuario: propias.filter((a) => a.usuario_id !== null).length,
  };
}
