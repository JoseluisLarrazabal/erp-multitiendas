import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Seccion } from "@/modules/catalogo/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";
import {
  AnularOrden,
  ANULABLES,
  detalleOrden,
  detalleVenta,
  DetalleOrdenVista,
  DetalleVentaVista,
} from "@/modules/ventas/panel";

export const metadata: Metadata = { title: "Orden · ERP Multitiendas" };

export default async function PaginaOrden({ params }: { params: Promise<{ id: string }> }) {
  const { activo, permisos } = await exigirAlgunPermiso(["ver_reportes", "cambiar_estado_orden"]);
  if (activo.tipo !== "lavanderia") redirect("/panel");
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const supabase = await createClient();
  // La orden y su venta comparten id.
  const [orden, venta] = await Promise.all([
    detalleOrden(supabase, activo.negocioId, id),
    detalleVenta(supabase, activo.negocioId, id),
  ]);
  if (orden.ok && orden.data === null) notFound();

  const volver = (
    <Link
      href="/panel/ordenes"
      className={buttonVariants({ variant: "outline", className: "h-10" })}
    >
      <ArrowLeft aria-hidden /> Órdenes
    </Link>
  );
  if (!orden.ok || !venta.ok || !orden.data || !venta.data) {
    return (
      <>
        <EncabezadoPagina titulo="Orden" acciones={volver} />
        <p role="alert" className="text-destructive text-sm">
          {!orden.ok ? orden.error : !venta.ok ? venta.error : "No se pudo leer la orden."}
        </p>
      </>
    );
  }

  const o = orden.data;
  const v = venta.data;
  const puedeAnular = permisos.includes("anular") && ANULABLES.includes(o.estado);
  return (
    <>
      <EncabezadoPagina
        titulo={`Orden ${v.numero}`}
        descripcion={`Detalle en ${activo.nombre}.`}
        acciones={
          <div className="flex flex-wrap gap-2">
            {volver}
            <Link
              href={`/panel/ventas/${v.id}`}
              className={buttonVariants({ variant: "outline", className: "h-10" })}
            >
              <Receipt aria-hidden /> Ver venta
            </Link>
          </div>
        }
      />
      <p id="detalle-estado" tabIndex={-1} className="sr-only outline-none">
        Orden {o.estado}
      </p>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <DetalleOrdenVista
            o={o}
            reembolsada={v.estado === "anulada"}
            conDevolucion={v.devoluciones.length > 0}
          />
          <DetalleVentaVista v={v} />
        </div>
        {puedeAnular && (
          <Seccion titulo="Anular orden">
            <AnularOrden ordenId={o.id} numero={v.numero} />
          </Seccion>
        )}
      </div>
    </>
  );
}
