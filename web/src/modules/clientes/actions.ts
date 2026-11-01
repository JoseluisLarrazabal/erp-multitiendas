"use server";

// Solo para el panel (se importa por panel.ts). No importar desde /pos: ver usuarios/actions.ts.
import { revalidatePath } from "next/cache";
import { codigoErp, mensajeErp } from "@/lib/erp-errores";
import { createClient } from "@/lib/supabase/server";
import { validar, type Resultado } from "@/modules/usuarios/panel";
import { clientePanelSchema } from "./schemas";

// Sin datos personales en el mensaje: solo texto fijo según el código.
export async function guardarCliente(entrada: unknown): Promise<Resultado<null>> {
  const d = validar(clientePanelSchema, entrada);
  if (!d)
    return { ok: false, error: mensajeErp("ERP_DATOS_INVALIDOS"), codigo: "ERP_DATOS_INVALIDOS" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_cliente", {
    p_negocio_id: d.negocioId,
    p_datos: {
      ...(d.id ? { id: d.id } : {}),
      nombre: d.nombre,
      ci_nit: d.ci_nit,
      telefono: d.telefono,
      direccion: d.direccion,
    },
  });
  if (error) {
    const codigo = codigoErp(error);
    return { ok: false, error: mensajeErp(codigo), codigo };
  }
  revalidatePath("/panel/clientes");
  return { ok: true, data: null };
}
