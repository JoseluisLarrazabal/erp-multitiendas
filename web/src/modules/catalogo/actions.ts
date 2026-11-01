"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  codigoDeMensaje,
  mensajeDeError as mensajeBase,
  type Resultado,
} from "@/modules/usuarios/panel";
import { MOTIVO_COSTOS, mensajeDeCatalogo } from "./domain";
import {
  categoriaSchema,
  estadoProductoSchema,
  fotoSchema,
  guardarGrillaSchema,
  productoSchema,
  tipoCambioSchema,
} from "./schemas";

const mensaje = (codigo?: string) => mensajeDeCatalogo(codigo) ?? mensajeBase(codigo);
const fallo = (codigo?: string): Resultado<never> => ({ ok: false, error: mensaje(codigo) });

function validar<T>(schema: ZodType<T>, entrada: unknown): T | null {
  const r = schema.safeParse(entrada);
  return r.success ? r.data : null;
}

type Datos = ReturnType<typeof datosDeProducto>;
const datosDeProducto = (d: {
  id: string | null;
  codigo: string;
  codigoBarras: string | null;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  categoriaId: string | null;
  tipo: string;
  unidad: string;
  controlaSerie: boolean;
  garantiaMeses: number | null;
  stockMinimo: number | null;
}) => ({
  id: d.id,
  codigo: d.codigo,
  codigo_barras: d.codigoBarras,
  nombre: d.nombre,
  marca: d.marca,
  modelo: d.modelo,
  categoria_id: d.categoriaId,
  tipo: d.tipo,
  unidad: d.unidad,
  controla_serie: d.controlaSerie,
  garantia_meses: d.garantiaMeses,
  stock_minimo: d.stockMinimo,
});

export async function guardarProducto(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const d = validar(productoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const datos: Datos = datosDeProducto(d);
  // Sin foto_path en el objeto la RPC conserva la foto actual.
  const { data, error } = await supabase.rpc("guardar_producto", {
    p_negocio_id: d.negocioId,
    p_datos: datos,
  });
  if (error || !data) return fallo(codigoDeMensaje(error?.message));
  revalidatePath("/panel/productos");
  revalidatePath("/panel/precios");
  return { ok: true, data: { id: data } };
}

// La foto se sube desde el navegador a Storage; aquí solo se guarda la ruta. guardar_producto exige todos los
// campos, así que se relee el producto (con la RLS de quien llama) y se reenvía con foto_path.
export async function asignarFoto(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(fotoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("productos")
    .select("*")
    .eq("id", d.productoId)
    .maybeSingle();
  if (!p) return fallo("ERP_DATOS_INVALIDOS");
  const { error } = await supabase.rpc("guardar_producto", {
    p_negocio_id: p.negocio_id,
    p_datos: {
      id: p.id,
      codigo: p.codigo,
      codigo_barras: p.codigo_barras,
      nombre: p.nombre,
      marca: p.marca,
      modelo: p.modelo,
      categoria_id: p.categoria_id,
      tipo: p.tipo,
      unidad: p.unidad,
      controla_serie: p.controla_serie,
      garantia_meses: p.garantia_meses,
      stock_minimo: p.stock_minimo,
      foto_path: d.fotoPath,
    },
  });
  if (error) return fallo(codigoDeMensaje(error.message));
  revalidatePath("/panel/productos");
  return { ok: true, data: null };
}

export async function cambiarEstadoProducto(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(estadoProductoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("desactivar_producto", {
    p_producto_id: d.productoId,
    p_activo: d.activo,
  });
  if (error) return fallo(codigoDeMensaje(error.message));
  revalidatePath("/panel/productos");
  return { ok: true, data: null };
}

export async function guardarCategoria(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(categoriaSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_categoria", {
    p_negocio_id: d.negocioId,
    // El generador de tipos marca p_id como no nulo, pero la RPC acepta null (crear).
    p_id: d.id as string,
    p_nombre: d.nombre,
  });
  if (error) return fallo(codigoDeMensaje(error.message));
  revalidatePath("/panel/productos", "layout");
  return { ok: true, data: null };
}

export async function registrarTipoCambio(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(tipoCambioSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_tipo_cambio", {
    p_negocio_id: d.negocioId,
    p_valor: d.valor,
  });
  if (error) return fallo(codigoDeMensaje(error.message));
  revalidatePath("/panel/tipo-cambio");
  revalidatePath("/panel/productos");
  revalidatePath("/panel/precios");
  return { ok: true, data: null };
}

export type ResultadoGrilla = {
  guardados: number;
  fallidas: { productoId: string; error: string }[];
};

// Un solo lote de precios y otro de costos. Si el lote entero falla por datos de una fila (el RPC es todo o
// nada y no dice cuál), se reintenta fila por fila para señalar solo las malas y guardar las demás.
export async function guardarGrilla(entrada: unknown): Promise<Resultado<ResultadoGrilla>> {
  const d = validar(guardarGrillaSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();

  const itemPrecios = (f: (typeof d.filas)[number]) => ({
    producto_id: f.productoId,
    moneda: f.precios!.moneda,
    precios: Object.fromEntries(Object.entries(f.precios!.precios)),
  });
  const guardarPrecios = (filas: typeof d.filas) =>
    supabase.rpc("guardar_precios", { p_negocio_id: d.negocioId, p_items: filas.map(itemPrecios) });
  const guardarCostos = (filas: typeof d.filas) =>
    supabase.rpc("fijar_costos", {
      p_negocio_id: d.negocioId,
      p_items: filas.map((f) => ({ producto_id: f.productoId, costo: f.costo })),
      p_motivo: MOTIVO_COSTOS,
    });
  const RECUPERABLES = ["ERP_DATOS_INVALIDOS", "ERP_MONEDA_MIXTA"];

  const conPrecios = d.filas.filter((f) => f.precios);
  const conCostos = d.filas.filter((f) => f.costo !== null);
  const fallidas = new Map<string, string>();

  for (const [lote, llamar] of [
    [conPrecios, guardarPrecios],
    [conCostos, guardarCostos],
  ] as const) {
    if (lote.length === 0) continue;
    const { error } = await llamar(lote);
    if (!error) continue;
    const codigo = codigoDeMensaje(error.message);
    if (!codigo || !RECUPERABLES.includes(codigo)) return fallo(codigo);
    for (const fila of lote) {
      const { error: e } = await llamar([fila]);
      if (e) fallidas.set(fila.productoId, mensaje(codigoDeMensaje(e.message)));
    }
  }

  revalidatePath("/panel/precios");
  revalidatePath("/panel/productos");
  return {
    ok: true,
    data: {
      guardados: d.filas.length - fallidas.size,
      fallidas: [...fallidas].map(([productoId, error]) => ({ productoId, error })),
    },
  };
}
