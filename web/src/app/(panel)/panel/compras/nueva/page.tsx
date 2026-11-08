import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { FormCompra } from "@/modules/compras/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Nueva compra · ERP Multitiendas" };

const tarjeta = "text-muted-foreground bg-card rounded-xl border p-6 text-sm";

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
        acciones={
          <Link
            href="/panel/compras"
            className={buttonVariants({ variant: "outline", className: "h-10" })}
          >
            <ArrowLeft aria-hidden /> Compras
          </Link>
        }
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {!error && activos.length === 0 && (
        <p className={tarjeta}>
          Primero crea un proveedor activo en{" "}
          <Link href="/panel/proveedores" className="text-primary underline underline-offset-4">
            Proveedores
          </Link>
          .
        </p>
      )}
      {!error && activos.length > 0 && ubicaciones.ok && ubicaciones.data.length === 0 && (
        <p className={tarjeta}>Este negocio no tiene ubicaciones. Se crean por script o seed.</p>
      )}
      {!error && activos.length > 0 && ubicaciones.ok && ubicaciones.data.length > 0 && (
        <FormCompra
          negocioId={activo.negocioId}
          proveedores={activos}
          ubicaciones={ubicaciones.data}
        />
      )}
    </>
  );
}
