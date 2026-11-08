import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormConsumo, PaginaOperacion } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Consumo de insumos · ERP Multitiendas" };

export default async function PaginaConsumo() {
  const { activo } = await exigirPermiso("ajustar_inventario");
  if (activo.tipo !== "lavanderia") redirect("/panel");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <PaginaOperacion
      titulo="Consumo de insumos"
      descripcion="Descuenta del stock el detergente, las bolsas o los ganchos que se usaron. Suma al gasto en insumos con el costo promedio de ese momento."
      ubicaciones={ubicaciones}
    >
      {(u) => <FormConsumo negocioId={activo.negocioId} ubicaciones={u} />}
    </PaginaOperacion>
  );
}
