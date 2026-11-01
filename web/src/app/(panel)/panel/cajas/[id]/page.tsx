import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { detalleSesion, DetalleSesionVista } from "@/modules/caja/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Caja · ERP Multitiendas" };

export default async function PaginaCaja({ params }: { params: Promise<{ id: string }> }) {
  const { activo } = await exigirAlgunPermiso(["caja", "ver_reportes"]);
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const d = await detalleSesion(await createClient(), activo.negocioId, id);
  if (d.ok && d.data === null) notFound();

  return (
    <>
      <EncabezadoPagina
        titulo="Sesión de caja"
        descripcion={`Detalle en ${activo.nombre}.`}
        acciones={
          <Link
            href="/panel/cajas"
            className={buttonVariants({ variant: "outline", className: "h-10" })}
          >
            <ArrowLeft aria-hidden /> Cajas
          </Link>
        }
      />
      {!d.ok || !d.data ? (
        <p role="alert" className="text-destructive text-sm">
          {d.ok ? "" : d.error}
        </p>
      ) : (
        <DetalleSesionVista d={d.data} />
      )}
    </>
  );
}
