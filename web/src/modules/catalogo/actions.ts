"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  codigoDeMensaje,
  mensajeDeError as mensajeBase,
  validar,
  type Resultado,
} from "@/modules/usuarios/panel";
import { MOTIVO_COSTOS, mensajeDeCatalogo } from "./domain";
import type { FilaFallida } from "./grilla";
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
  pesoPaqueteKg?: number | null;
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
  // Sin la clave la RPC conserva el peso actual.
  ...(d.pesoPaqueteKg !== undefined && { peso_paquete_kg: d.pesoPaqueteKg }),
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

// La foto se sube desde el navegador a Storage; aquí solo se guarda la ruta, sin tocar los demás campos del
// producto (una edición concurrente no se pisa). Una ruta null quita la foto.
export async function asignarFoto(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(fotoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_foto_producto", {
    p_producto_id: d.productoId,
    // El generador de tipos marca p_foto_path como no nulo, pero la RPC acepta null (quitar).
    p_foto_path: d.fotoPath as string,
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
  // Filas con todo lo que se mandó ya guardado.
  guardadas: number;
  // Filas donde algo no se guardó. Lo que no figura en `campos` sí se guardó.
  fallidas: FilaFallida[];
};

// Un solo lote de precios y otro de costos. Si el lote entero falla por datos de una fila (el RPC es todo o
// nada y no dice cuál), se reintenta fila por fila para señalar solo las malas y guardar las demás. Un lote que
// falla no impide el otro, y se revalida siempre que algo se haya guardado.
export async function guardarGrilla(entrada: unknown): Promise<Resultado<ResultadoGrilla>> {
  const d = validar(guardarGrillaSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();

  const guardarPrecios = (filas: typeof d.filas) =>
    supabase.rpc("guardar_precios", {
      p_negocio_id: d.negocioId,
      p_items: filas.map((f) => ({
        producto_id: f.productoId,
        moneda: f.precios!.moneda,
        precios: f.precios!.precios,
      })),
    });
  const guardarCostos = (filas: typeof d.filas) =>
    supabase.rpc("fijar_costos", {
      p_negocio_id: d.negocioId,
      p_items: filas.map((f) => ({ producto_id: f.productoId, costo: f.costo })),
      p_motivo: MOTIVO_COSTOS,
    });
  const RECUPERABLES = ["ERP_DATOS_INVALIDOS", "ERP_MONEDA_MIXTA"];

  const fallas = new Map<string, FilaFallida>();
  const marcar = (productoId: string, campo: FilaFallida["campos"][number], error: string) => {
    const f = fallas.get(productoId) ?? { productoId, error, campos: [] };
    f.campos.push(campo);
    fallas.set(productoId, f);
  };
  let guardoAlgo = false;
  let fatal: { codigo?: string } | null = null;

  for (const [campo, lote, llamar] of [
    ["precios", d.filas.filter((f) => f.precios), guardarPrecios],
    ["costo", d.filas.filter((f) => f.costo !== null), guardarCostos],
  ] as const) {
    if (lote.length === 0) continue;
    const { error } = await llamar(lote);
    if (!error) {
      guardoAlgo = true;
      continue;
    }
    const codigo = codigoDeMensaje(error.message);
    if (!codigo || !RECUPERABLES.includes(codigo)) {
      fatal ??= { codigo };
      for (const fila of lote) marcar(fila.productoId, campo, mensaje(codigo));
      continue;
    }
    for (const fila of lote) {
      const { error: e } = await llamar([fila]);
      if (e) marcar(fila.productoId, campo, mensaje(codigoDeMensaje(e.message)));
      else guardoAlgo = true;
    }
  }

  // Nada se guardó y la causa es de todo el lote (permiso, sesión, conexión): un solo aviso, no fila por fila.
  if (!guardoAlgo && fatal && fallas.size === d.filas.length) return fallo(fatal.codigo);
  if (guardoAlgo) {
    revalidatePath("/panel/precios");
    revalidatePath("/panel/productos");
  }
  return {
    ok: true,
    data: { guardadas: d.filas.length - fallas.size, fallidas: [...fallas.values()] },
  };
}
