import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { hoyEnBolivia } from "@/lib/format/fecha";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, EnlaceVolver } from "@/modules/catalogo/panel";
import { FormCompra } from "@/modules/compras/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Nueva compra · ERP Multitiendas" };

export default async function PaginaNuevaCompra() {
  const { activo } = await exigirPermiso("gestionar_compras");
  const supabase = await createClient();
  const [proveedores, ubicaciones] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id, nombre")
      .eq("negocio_id", activo.negocioId)
      .eq("activo", true)
      .order("nombre")
      .order("id"),
    listarUbicaciones(supabase, activo.negocioId),
  ]);
  const error = proveedores.error
    ? "No se pudieron leer los proveedores."
    : !ubicaciones.ok
      ? ubicaciones.error
      : null;
  const activos = proveedores.data ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Nueva compra"
        descripcion="Registra lo que compraste a un proveedor: suma stock y recalcula el costo promedio."
        acciones={<EnlaceVolver href="/panel/compras">Compras</EnlaceVolver>}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {!error && activos.length === 0 && (
        <EstadoVacio>
          Primero crea un proveedor activo en{" "}
          <Link href="/panel/proveedores" className="text-primary underline underline-offset-4">
            Proveedores
          </Link>
          .
        </EstadoVacio>
      )}
      {!error && activos.length > 0 && ubicaciones.ok && ubicaciones.data.length === 0 && (
        <EstadoVacio>Este negocio no tiene ubicaciones. Se crean por script o seed.</EstadoVacio>
      )}
      {!error && activos.length > 0 && ubicaciones.ok && ubicaciones.data.length > 0 && (
        <FormCompra
          negocioId={activo.negocioId}
          proveedores={activos}
          ubicaciones={ubicaciones.data}
          esFrial={activo.tipo === "frial"}
          hoy={hoyEnBolivia()}
        />
      )}
    </>
  );
}
