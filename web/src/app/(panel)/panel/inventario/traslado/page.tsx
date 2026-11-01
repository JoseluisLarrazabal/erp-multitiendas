import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { FormTraslado } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Traslado entre ubicaciones · ERP Multitiendas" };

export default async function PaginaTraslado() {
  const { activo } = await exigirPermiso("ajustar_inventario");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Traslado entre ubicaciones"
        descripcion="Mueve stock de una ubicación a otra conservando el total. Si el origen no alcanza, te avisamos antes de confirmar."
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
        <FormTraslado negocioId={activo.negocioId} ubicaciones={ubicaciones.data} />
      )}
    </>
  );
}
