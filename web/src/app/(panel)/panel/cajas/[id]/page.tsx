import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, EnlaceVolver } from "@/modules/catalogo/panel";
import { detalleSesion, DetalleSesionVista } from "@/modules/caja/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Caja · ERP Multitiendas" };

export default async function PaginaCaja({ params }: { params: Promise<{ id: string }> }) {
  const { activo, permisos } = await exigirAlgunPermiso(["caja", "ver_reportes"]);
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const d = await detalleSesion(await createClient(), activo.negocioId, id);
  if (d.ok && d.data === null) notFound();

  return (
    <>
      <EncabezadoPagina
        titulo="Sesión de caja"
        descripcion={`Detalle en ${activo.nombre}.`}
        acciones={<EnlaceVolver href="/panel/cajas">Cajas</EnlaceVolver>}
      />
      {!d.ok || !d.data ? (
        <p role="alert" className="text-destructive text-sm">
          {d.ok ? "" : d.error}
        </p>
      ) : (
        <DetalleSesionVista
          d={d.data}
          verVentas={permisos.includes("ver_reportes") || permisos.includes("anular")}
        />
      )}
    </>
  );
}
