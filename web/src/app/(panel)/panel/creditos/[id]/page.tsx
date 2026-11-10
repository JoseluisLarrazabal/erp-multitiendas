import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { cargarDetalle, DetalleCreditoVista } from "@/modules/creditos/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";
import { cargarNegocio, listarEquiposPanel, sesionesAbiertas } from "@/modules/ventas/panel";

export const metadata: Metadata = { title: "Crédito · ERP Multitiendas" };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaDetalleCredito({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { permisos, activo } = await exigirAlgunPermiso(["gestionar_credito", "ver_reportes"]);
  if (!GUID.test(id)) notFound();
  const supabase = await createClient();
  const puedeAnular = permisos.includes("anular");
  const [detalle, negocio, equipos, abiertas] = await Promise.all([
    cargarDetalle(supabase, { creditoId: id }),
    cargarNegocio(supabase, activo.negocioId),
    // Las cajas solo sirven a quien puede anular: sin el permiso no se leen.
    puedeAnular ? listarEquiposPanel(supabase, activo.negocioId) : null,
    puedeAnular ? sesionesAbiertas(supabase, activo.negocioId) : null,
  ]);
  // Cajas abiertas por equipo: de ahí sale el efectivo de un reverso. `null` = no se pudieron leer (distinto de "no hay").
  const abiertos =
    equipos?.ok && abiertas?.ok
      ? abiertas.data.flatMap((s) => {
          const e = equipos.data.find((x) => x.id === s.dispositivoId);
          return e
            ? [{ dispositivoId: e.id, nombre: `${e.nombre} (${e.prefijo})`, sesionId: s.id }]
            : [];
        })
      : null;

  return (
    <>
      <div className="print:hidden">
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
      </div>
      {detalle.ok ? (
        <DetalleCreditoVista
          d={detalle.data}
          puedeGestionar={permisos.includes("gestionar_credito")}
          puedeAnular={puedeAnular}
          equipos={abiertos}
          negocio={
            negocio.ok
              ? {
                  nombre: negocio.data.nombre,
                  nit: negocio.data.nit,
                  datosNota: negocio.data.datosNota,
                }
              : { nombre: activo.nombre, nit: null, datosNota: null }
          }
        />
      ) : (
        <p role="alert" className="text-destructive text-sm">
          {detalle.error}
        </p>
      )}
    </>
  );
}
