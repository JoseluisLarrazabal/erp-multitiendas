import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { FormEntrada } from "@/modules/inventario/panel";
import { exigirPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Entrada de mercadería · ERP Multitiendas" };

export default async function PaginaEntrada() {
  const { activo, permisos } = await exigirPermiso("ajustar_inventario");
  const ubicaciones = await listarUbicaciones(await createClient(), activo.negocioId);

  return (
    <>
      <EncabezadoPagina
        titulo="Entrada de mercadería"
        descripcion="Suma stock a una ubicación. Escanea el código de barras y sigue con la cantidad."
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
        <FormEntrada
          negocioId={activo.negocioId}
          ubicaciones={ubicaciones.data}
          verCostos={permisos.includes("ver_costos")}
        />
      )}
    </>
  );
}
