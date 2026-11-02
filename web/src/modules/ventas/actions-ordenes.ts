"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { codigoErp, mensajeErp } from "@/lib/erp-errores";
import { createClient } from "@/lib/supabase/server";
import { validar, type Resultado } from "@/modules/usuarios/panel";
import { mensajeDeVentas } from "./domain-panel";
import { anularOrdenSchema } from "./schemas-ordenes";

const fallo = (error: { message: string } | null): Resultado<never> => {
  const codigo = codigoErp(error ?? undefined);
  return { ok: false, error: mensajeDeVentas("anular", codigo) ?? mensajeErp(codigo), codigo };
};

// El reembolso no se devuelve: el detalle lo deduce (venta anulada = efectivo devuelto a la caja).
export async function anularOrden(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(anularOrdenSchema, entrada);
  if (!d) return fallo({ message: "ERP_DATOS_INVALIDOS" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_orden", {
    p_orden_id: d.ordenId,
    p_motivo: d.motivo,
  });
  if (error) return fallo(error);
  revalidatePath("/panel/ordenes", "layout");
  revalidatePath("/panel/ventas", "layout");
  revalidatePath("/panel/cajas", "layout");
  return { ok: true, data: null };
}
