import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { FormSalida } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Salida o ajuste · ERP Multitiendas" };

export default async function PaginaSalida() {
  const { activo } = await exigirPermiso("ajustar_inventario");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Salida o ajuste"
        descripcion="Descuenta stock por daño, garantía o devolución a proveedor, o corrige con un ajuste con signo. El motivo es obligatorio."
        acciones={
          <Link
            href="/panel/inventario"
            className={buttonVariants({ variant: "outline", className: "h-10" })}
          >
            <ArrowLeft aria-hidden /> Inventario
          </Link>
        }
      />
      {!ubicaciones.ok && (
        <p role="alert" className="text-destructive text-sm">
          {ubicaciones.error}
        </p>
      )}
      {ubicaciones.ok && ubicaciones.data.length === 0 && (
        <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
          Este negocio no tiene ubicaciones. Se crean por script o seed.
        </p>
      )}
      {ubicaciones.ok && ubicaciones.data.length > 0 && (
        <FormSalida negocioId={activo.negocioId} ubicaciones={ubicaciones.data} />
      )}
    </>
  );
}
