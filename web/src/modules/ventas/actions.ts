"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codigoErp, mensajeErp } from "@/lib/erp-errores";
import { createClient } from "@/lib/supabase/server";
import { validar, type Resultado } from "@/modules/usuarios/panel";
import { mensajeDeVentas, type AccionVentas } from "./domain-panel";
import { anularSchema, devolverSchema, topeSchema } from "./schemas-panel";

const fallo = (accion: AccionVentas, error: { message: string } | null): Resultado<never> => {
  const codigo = codigoErp(error ?? undefined);
  return { ok: false, error: mensajeDeVentas(accion, codigo) ?? mensajeErp(codigo), codigo };
};
const invalido = (accion: AccionVentas): Resultado<never> =>
  fallo(accion, { message: "ERP_DATOS_INVALIDOS" });

function revalidar() {
  revalidatePath("/panel/ventas", "layout");
  revalidatePath("/panel/cajas", "layout");
}

export async function anularVenta(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(anularSchema, entrada);
  if (!d) return invalido("anular");
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_venta", {
    p_venta_id: d.ventaId,
    p_motivo: d.motivo,
  });
  if (error) return fallo("anular", error);
  revalidar();
  return { ok: true, data: null };
}

const respuestaDevolucion = z.object({ monto: z.number(), monto_efectivo: z.number() });
export type Devuelto = { monto: number; montoEfectivo: number };

export async function devolverVenta(entrada: unknown): Promise<Resultado<Devuelto>> {
  const d = validar(devolverSchema, entrada);
  if (!d) return invalido("devolver");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("devolver_venta", {
    p_devolucion: {
      id: d.id,
      venta_id: d.ventaId,
      dispositivo_id: d.dispositivoId,
      caja_sesion_id: d.cajaSesionId,
      medio: d.medio,
      motivo: d.motivo,
      items: d.items.map((i) => ({ venta_item_id: i.ventaItemId, cantidad: i.cantidad })),
    },
  });
  if (error) return fallo("devolver", error);
  revalidar();
  const r = respuestaDevolucion.safeParse(data);
  // La devolución se guardó aunque la respuesta no se entienda: la pantalla recarga y muestra el detalle.
  return {
    ok: true,
    data: r.success
      ? { monto: r.data.monto, montoEfectivo: r.data.monto_efectivo }
      : { monto: NaN, montoEfectivo: NaN },
  };
}

export async function fijarTopeDescuento(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(topeSchema, entrada);
  if (!d) return invalido("tope");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fijar_tope_descuento", {
    p_negocio_id: d.negocioId,
    p_tope: d.tope,
  });
  if (error) return fallo("tope", error);
  revalidatePath("/panel/descuento");
  return { ok: true, data: null };
}
