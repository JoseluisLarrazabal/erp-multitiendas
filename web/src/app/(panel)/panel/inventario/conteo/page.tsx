import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { FormConteo } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Conteo de inventario · ERP Multitiendas" };

export default async function PaginaConteo() {
  const { activo } = await exigirPermiso("ajustar_inventario");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Conteo de inventario"
        descripcion="Elige una ubicación, ingresa lo que contaste y revisa las diferencias antes de confirmar. Los productos que no cuentes no se tocan."
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
        <FormConteo negocioId={activo.negocioId} ubicaciones={ubicaciones.data} />
      )}
    </>
  );
}
