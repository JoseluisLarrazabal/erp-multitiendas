import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FormEntrada, PaginaOperacion } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Entrada de mercadería · ERP Multitiendas" };

export default async function PaginaEntrada() {
  const { activo, permisos } = await exigirPermiso("ajustar_inventario");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <PaginaOperacion
      titulo="Entrada de mercadería"
      descripcion="Suma stock a una ubicación. Escanea el código de barras y sigue con la cantidad."
      ubicaciones={ubicaciones}
    >
      {(u) => (
        <FormEntrada
          negocioId={activo.negocioId}
          ubicaciones={u}
          verCostos={permisos.includes("ver_costos")}
        />
      )}
    </PaginaOperacion>
  );
}
