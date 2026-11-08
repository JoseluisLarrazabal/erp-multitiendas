"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { codigoErp, mensajeErp } from "@/lib/erp-errores";
import { createClient } from "@/lib/supabase/server";
import { validar, type Resultado } from "@/modules/usuarios/panel";

const revisarCajaSchema = z.object({ tipo: z.enum(["apertura", "movimiento"]), id: z.guid() });

export async function revisarCaja(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(revisarCajaSchema, entrada);
  if (!d)
    return { ok: false, error: mensajeErp("ERP_DATOS_INVALIDOS"), codigo: "ERP_DATOS_INVALIDOS" };
  const { error } = await (
    await createClient()
  ).rpc("revisar_caja", { p_tipo: d.tipo, p_id: d.id });
  if (error) {
    const codigo = codigoErp(error);
    return { ok: false, error: mensajeErp(codigo), codigo };
  }
  revalidatePath("/panel/reconciliacion");
  return { ok: true, data: null };
}
