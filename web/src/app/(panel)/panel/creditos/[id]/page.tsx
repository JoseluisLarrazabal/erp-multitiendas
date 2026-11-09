import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { cargarDetalle, DetalleCreditoVista } from "@/modules/creditos/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Crédito · ERP Multitiendas" };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaDetalleCredito({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { permisos } = await exigirAlgunPermiso(["gestionar_credito", "ver_reportes"]);
  if (!GUID.test(id)) notFound();
  const detalle = await cargarDetalle(await createClient(), { creditoId: id });

  return (
    <>
      <EncabezadoPagina
        titulo="Crédito"
        descripcion="Cuotas, pagos recibidos y saldo. Los pagos cubren las cuotas de la más vieja a la más nueva."
        acciones={
          <Link
            href="/panel/creditos"
            className={buttonVariants({ variant: "outline", className: "h-10" })}
          >
            <ArrowLeft aria-hidden /> Créditos
          </Link>
        }
      />
      {detalle.ok ? (
        <DetalleCreditoVista
          d={detalle.data}
          puedeGestionar={permisos.includes("gestionar_credito")}
        />
      ) : (
        <p role="alert" className="text-destructive text-sm">
          {detalle.error}
        </p>
      )}
    </>
  );
}
