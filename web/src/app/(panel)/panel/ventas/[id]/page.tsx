import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { itemsVisibles } from "@/components/panel/panel-items";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Seccion } from "@/modules/catalogo/panel";
import {
  AnularVenta,
  detalleVenta,
  DetalleVentaVista,
  EXPLICACION_ESPECIAL,
  FormDevolucion,
  listarEquiposPanel,
  permiteAnularODevolver,
  sesionesAbiertas,
  type EquipoAbierto,
} from "@/modules/ventas/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Venta · ERP Multitiendas" };

const AVISO_PLAZO =
  "Pasadas 24 horas de la venta, devolver exige el permiso de devolución fuera de plazo. Si no lo tienes, el sistema lo rechazará.";

export default async function PaginaVenta({ params }: { params: Promise<{ id: string }> }) {
  const { activo, permisos } = await exigirAlgunPermiso(["ver_reportes", "anular"]);
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const [detalle, equipos, abiertas] = await Promise.all([
    detalleVenta(supabase, activo.negocioId, id),
    listarEquiposPanel(supabase, activo.negocioId),
    sesionesAbiertas(supabase, activo.negocioId),
  ]);
  if (detalle.ok && detalle.data === null) notFound();

  const volver = (
    <Link
      href="/panel/ventas"
      className={buttonVariants({ variant: "outline", className: "h-10" })}
    >
      <ArrowLeft aria-hidden /> Ventas
    </Link>
  );
  if (!detalle.ok || !equipos.ok || !abiertas.ok || !detalle.data) {
    const error = !detalle.ok
      ? detalle.error
      : !equipos.ok
        ? equipos.error
        : !abiertas.ok
          ? abiertas.error
          : "";
    return (
      <>
        <EncabezadoPagina titulo="Venta" acciones={volver} />
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      </>
    );
  }

  const v = detalle.data;
  const puedeAnular = permisos.includes("anular");
  const abiertos: EquipoAbierto[] = abiertas.data.flatMap((s) => {
    const e = equipos.data.find((x) => x.id === s.dispositivoId);
    return e ? [{ dispositivoId: e.id, nombre: `${e.nombre} (${e.prefijo})`, sesionId: s.id }] : [];
  });
  const quedaAlgo = v.items.some(
    (i) => Math.round(i.cantidad * 1000) > Math.round(i.devuelta * 1000),
  );
  const completada = v.estado === "completada";
  const ofreceAcciones = permiteAnularODevolver(v.especial);
  const puedeVerCreditos = itemsVisibles(permisos, activo.tipo).some(
    (i) => i.href === "/panel/creditos",
  );
  const puedeDevolver =
    completada && ofreceAcciones && (puedeAnular || permisos.includes("devolver_fuera_plazo"));
  const sinDevoluciones = v.devoluciones.length === 0;

  return (
    <>
      <EncabezadoPagina
        titulo={`Venta ${v.numero}`}
        descripcion={`Detalle en ${activo.nombre}.`}
        acciones={volver}
      />
      <p id="detalle-estado" tabIndex={-1} className="sr-only outline-none">
        Venta {v.estado === "anulada" ? "anulada" : "completada"}
      </p>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <DetalleVentaVista v={v} />
        {completada && v.especial && (
          <div className="flex min-w-0 flex-col gap-6">
            <Seccion titulo="Anular y devolver">
              <p className="text-sm">{EXPLICACION_ESPECIAL[v.especial]}</p>
              {v.credito && puedeVerCreditos && (
                <Link
                  href={`/panel/creditos/${v.credito.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-10 w-fit" })}
                >
                  Ver pagos del crédito
                </Link>
              )}
            </Seccion>
          </div>
        )}
        {completada && ofreceAcciones && (puedeAnular || puedeDevolver) && (
          <div className="flex min-w-0 flex-col gap-6">
            {puedeAnular && sinDevoluciones && (
              <Seccion titulo="Anular venta">
                {v.cajaSesionAbierta ? (
                  <>
                    {v.fueraDePlazo && (
                      <p className="bg-secondary rounded-lg p-3 text-sm">
                        {AVISO_PLAZO.replace("devolver", "anular")}
                      </p>
                    )}
                    <AnularVenta ventaId={v.id} numero={v.numero} />
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    La caja de esta venta ya se cerró: no se puede anular. Usa una devolución.
                  </p>
                )}
              </Seccion>
            )}
            {puedeAnular && !sinDevoluciones && (
              <Seccion titulo="Anular venta">
                <p className="text-muted-foreground text-sm">
                  La venta ya tiene devoluciones, así que no se puede anular. Devuelve lo que falte.
                </p>
              </Seccion>
            )}
            {/* Se mantiene montada tras devolver todo: el resultado de la devolución vive en su estado. */}
            {puedeDevolver && (
              <Seccion titulo="Devolver">
                {abiertos.length === 0 && quedaAlgo ? (
                  <p className="text-muted-foreground text-sm">
                    No hay ninguna caja abierta. El dinero de una devolución sale de la caja de un
                    equipo: abre una en el punto de venta.
                  </p>
                ) : (
                  <FormDevolucion
                    ventaId={v.id}
                    items={v.items}
                    equipos={abiertos}
                    aviso={v.fueraDePlazo ? AVISO_PLAZO : null}
                  />
                )}
              </Seccion>
            )}
          </div>
        )}
      </div>
    </>
  );
}
