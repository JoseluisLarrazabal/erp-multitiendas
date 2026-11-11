import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { DIAS_VENCIMIENTO, leerFiltrosVencimientos } from "@/modules/inventario";
import { leerLotesPorVencer, ListaVencimientos } from "@/modules/inventario/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Vencimientos · ERP Multitiendas" };

export default async function PaginaVencimientos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo } = await exigirAlgunPermiso(["ajustar_inventario", "ver_reportes"]);
  if (activo.tipo !== "frial") redirect("/panel");
  const { filtros, invalido } = leerFiltrosVencimientos(await searchParams);
  const lotes = await leerLotesPorVencer(await createClient(), activo.negocioId, filtros.dias);

  return (
    <>
      <EncabezadoPagina
        titulo="Vencimientos"
        descripcion={`Lotes de ${activo.nombre} que vencen en los próximos ${filtros.dias} días, vencidos incluidos. El saldo es estimado: la venta no elige lote.`}
        acciones={
          <Link
            href="/panel/inventario"
            className="text-primary inline-flex min-h-10 items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> Inventario
          </Link>
        }
      />
      <div className="flex min-w-0 flex-col gap-5">
        <nav aria-label="Plazo" className="flex flex-wrap items-center gap-2">
          {DIAS_VENCIMIENTO.map((d) => (
            <Link
              key={d}
              href={`/panel/inventario/vencimientos?dias=${d}`}
              aria-current={d === filtros.dias ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: d === filtros.dias ? "default" : "outline",
                }),
              )}
            >
              {d} días
            </Link>
          ))}
        </nav>
        {invalido && (
          <p role="status" className="text-sm font-medium">
            {AVISO_FILTRO_INVALIDO}
          </p>
        )}
        {!lotes.ok && (
          <p role="alert" className="text-destructive text-sm">
            {lotes.error} Recarga la página para reintentar.
          </p>
        )}
        {lotes.ok && lotes.data.length === 0 && (
          <EstadoVacio>Ningún lote vence en los próximos {filtros.dias} días.</EstadoVacio>
        )}
        {lotes.ok && lotes.data.length > 0 && <ListaVencimientos lotes={lotes.data} />}
      </div>
    </>
  );
}
