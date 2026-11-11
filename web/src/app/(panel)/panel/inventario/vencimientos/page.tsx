import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EncabezadoPagina, EnlaceVolver } from "@/modules/catalogo/panel";
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
        acciones={<EnlaceVolver href="/panel/inventario">Inventario</EnlaceVolver>}
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
