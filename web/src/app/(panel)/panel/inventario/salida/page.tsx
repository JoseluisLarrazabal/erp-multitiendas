import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FormSalida, PaginaOperacion } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Salida o ajuste · ERP Multitiendas" };

export default async function PaginaSalida({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo } = await exigirPermiso("ajustar_inventario");
  const esLavanderia = activo.tipo === "lavanderia";
  const tipoInicial =
    esLavanderia && (await searchParams).tipo === "consumo" ? "consumo" : undefined;
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <PaginaOperacion
      titulo="Salida o ajuste"
      descripcion="Descuenta stock por daño, garantía o devolución a proveedor, o corrige con un ajuste con signo. El motivo es obligatorio."
      ubicaciones={ubicaciones}
    >
      {(u) => (
        <FormSalida
          negocioId={activo.negocioId}
          esFrial={activo.tipo === "frial"}
          esLavanderia={esLavanderia}
          tipoInicial={tipoInicial}
          ubicaciones={u}
        />
      )}
    </PaginaOperacion>
  );
}
