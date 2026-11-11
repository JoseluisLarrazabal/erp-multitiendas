"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  codigoDeMensaje,
  detalleDeError,
  mensajeDeError as mensajeBase,
  validar,
  type Resultado,
} from "@/modules/usuarios/panel";
import { MAX_SERIES, mensajeDeInventario, PAGINA_CONTEO, type ProductoElegible } from "./domain";
import {
  buscarProductos,
  paginaConteo,
  seriesDisponibles,
  stockPorUbicacion,
  type FilaConteo,
  type Pagina,
  type SerieDisponible,
} from "./queries";
import {
  busquedaSchema,
  conteoSchema,
  entradaSchema,
  paginaConteoSchema,
  revertirConsumoSchema,
  salidaSchema,
  seriesDisponiblesSchema,
  seriesSchema,
  stockProductoSchema,
  trasladoSchema,
} from "./schemas";

const mensaje = (codigo?: string) => mensajeDeInventario(codigo) ?? mensajeBase(codigo);
const fallo = (
  codigo?: string,
  errorRpc?: Parameters<typeof detalleDeError>[0],
): Resultado<never> => ({
  ok: false,
  error: mensaje(codigo),
  codigo: codigo ?? null,
  ...detalleDeError(errorRpc),
});
const REVALIDAR = "/panel/inventario";
const listo = (): Resultado<null> => {
  revalidatePath(REVALIDAR, "layout");
  return { ok: true, data: null };
};

export async function registrarEntrada(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(entradaSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const comunes = {
    p_operacion_id: d.operacionId,
    p_negocio_id: d.negocioId,
    p_producto_id: d.productoId,
    p_ubicacion_id: d.ubicacionId,
    p_cantidad: d.cantidad,
    // Los tipos generados marcan estos dos como no nulos, pero la RPC acepta null.
    p_costo_unitario: d.costo as number,
    p_motivo: d.motivo as string,
  };
  // El schema garantiza lote y vence juntos o ninguno.
  const { error } =
    d.lote && d.vence
      ? await supabase.rpc("registrar_entrada_lote", {
          ...comunes,
          p_lote: d.lote,
          p_vence: d.vence,
        })
      : await supabase.rpc("registrar_entrada", comunes);
  if (error) return fallo(codigoDeMensaje(error.message), error);
  return listo();
}

export async function revertirConsumo(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(revertirConsumoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revertir_consumo", {
    p_operacion_id: d.operacionId,
    p_movimiento_id: d.movimientoId,
    p_motivo: d.motivo,
  });
  if (error) return fallo(codigoDeMensaje(error.message), error);
  revalidatePath(REVALIDAR, "layout");
  return { ok: true, data: null };
}

export async function registrarSalida(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(salidaSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_inventario", {
    p_operacion_id: d.operacionId,
    p_negocio_id: d.negocioId,
    p_producto_id: d.productoId,
    p_ubicacion_id: d.ubicacionId,
    p_tipo: d.tipo,
    p_cantidad: d.cantidad,
    p_motivo: d.motivo,
    p_serie_ids: d.serieIds ?? undefined,
  });
  if (error) return fallo(codigoDeMensaje(error.message), error);
  return listo();
}

export async function trasladar(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(trasladoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { error } = await supabase.rpc("trasladar_stock", {
    p_operacion_id: d.operacionId,
    p_negocio_id: d.negocioId,
    p_producto_id: d.productoId,
    p_origen_id: d.origenId,
    p_destino_id: d.destinoId,
    p_cantidad: d.cantidad,
    p_motivo: d.motivo as string,
    p_serie_ids: d.serieIds ?? undefined,
  });
  if (error) return fallo(codigoDeMensaje(error.message), error);
  return listo();
}

export async function registrarConteo(entrada: unknown): Promise<Resultado<{ ajustes: number }>> {
  const d = validar(conteoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_conteo", {
    p_operacion_id: d.operacionId,
    p_negocio_id: d.negocioId,
    p_ubicacion_id: d.ubicacionId,
    p_items: d.items.map((i) => ({
      producto_id: i.productoId,
      cantidad_contada: i.cantidad,
      ...(i.serieIds ? { serie_ids: i.serieIds } : {}),
    })),
    p_motivo: d.motivo as string,
  });
  if (error) return fallo(codigoDeMensaje(error.message), error);
  revalidatePath(REVALIDAR, "layout");
  return { ok: true, data: { ajustes: data } };
}

export async function registrarSeries(
  entrada: unknown,
): Promise<Resultado<{ registradas: number }>> {
  const d = validar(seriesSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_series", {
    p_negocio_id: d.negocioId,
    p_producto_id: d.productoId,
    p_ubicacion_id: d.ubicacionId,
    p_series: d.series,
  });
  if (error) return fallo(codigoDeMensaje(error.message), error);
  revalidatePath(REVALIDAR, "layout");
  return { ok: true, data: { registradas: data } };
}

// Lecturas de los formularios (el cliente las pide al elegir producto o ubicación). La RLS acota todo al negocio.

export async function buscarProductosAccion(
  entrada: unknown,
): Promise<Resultado<ProductoElegible[]>> {
  const d = validar(busquedaSchema, entrada);
  if (!d) return { ok: true, data: [] };
  return buscarProductos(await createClient(), d.negocioId, d.q, { conInactivos: d.conInactivos });
}

export async function stockProductoAccion(
  entrada: unknown,
): Promise<Resultado<Record<string, number>>> {
  const d = validar(stockProductoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  return stockPorUbicacion(await createClient(), d.productoId);
}

export async function seriesDisponiblesAccion(
  entrada: unknown,
): Promise<Resultado<SerieDisponible[]>> {
  const d = validar(seriesDisponiblesSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  return seriesDisponibles(await createClient(), d.productoId, d.ubicacionId, MAX_SERIES);
}

export async function paginaConteoAccion(entrada: unknown): Promise<Resultado<Pagina<FilaConteo>>> {
  const d = validar(paginaConteoSchema, entrada);
  if (!d) return fallo("ERP_DATOS_INVALIDOS");
  return paginaConteo(
    await createClient(),
    d.negocioId,
    d.ubicacionId,
    d.q,
    d.pagina,
    PAGINA_CONTEO,
  );
}
