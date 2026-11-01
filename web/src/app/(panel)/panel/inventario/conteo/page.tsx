import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FormConteo, PaginaOperacion } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Conteo de inventario · ERP Multitiendas" };

export default async function PaginaConteo() {
  const { activo } = await exigirPermiso("ajustar_inventario");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <PaginaOperacion
      titulo="Conteo de inventario"
      descripcion="Elige una ubicación, ingresa lo que contaste y revisa las diferencias antes de confirmar. Los productos que no cuentes no se tocan."
      ubicaciones={ubicaciones}
    >
      {(u) => <FormConteo negocioId={activo.negocioId} ubicaciones={u} />}
    </PaginaOperacion>
  );
}
