import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FormTraslado, PaginaOperacion } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Traslado entre ubicaciones · ERP Multitiendas" };

export default async function PaginaTraslado() {
  const { activo } = await exigirPermiso("ajustar_inventario");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <PaginaOperacion
      titulo="Traslado entre ubicaciones"
      descripcion="Mueve stock de una ubicación a otra conservando el total. Si el origen no alcanza, te avisamos antes de confirmar."
      ubicaciones={ubicaciones}
      minimo={2}
    >
      {(u) => <FormTraslado negocioId={activo.negocioId} ubicaciones={u} />}
    </PaginaOperacion>
  );
}
