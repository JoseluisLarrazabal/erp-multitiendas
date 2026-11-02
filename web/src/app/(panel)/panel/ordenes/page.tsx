import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";
import {
  FiltrosOrdenesForm,
  hrefOrdenes,
  leerFiltrosOrdenes,
  listarOrdenes,
  ListaOrdenes,
  PAGINA_ORDENES,
} from "@/modules/ventas/panel";

export const metadata: Metadata = { title: "Órdenes · ERP Multitiendas" };

const boton = cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-9 md:min-h-8");

export default async function PaginaOrdenes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo } = await exigirAlgunPermiso(["ver_reportes", "cambiar_estado_orden"]);
  if (activo.tipo !== "lavanderia") redirect("/panel");
  const { filtros, invalido } = leerFiltrosOrdenes(await searchParams);
  const supabase = await createClient();
  // Un cursor ilegible ya lo descarta leerFiltrosOrdenes (marca `invalido`); un error de consulta se muestra tal cual.
  const lista = await listarOrdenes(supabase, activo.negocioId, filtros, PAGINA_ORDENES);
  const desde = filtros.desde;
  const hayFiltros = !!(filtros.q || filtros.estado);

  return (
    <>
      <EncabezadoPagina
        titulo="Órdenes"
        descripcion={`Órdenes de lavandería de ${activo.nombre}, de la más reciente a la más antigua. Entra a una para ver el detalle o anularla.`}
      />
      <div className="flex min-w-0 flex-col gap-5">
        <FiltrosOrdenesForm filtros={{ ...filtros, desde: "" }} invalido={invalido} />
        {invalido && (
          <p role="status" className="text-sm font-medium">
            {AVISO_FILTRO_INVALIDO}
          </p>
        )}
        {!lista.ok && (
          <p role="alert" className="text-destructive text-sm">
            {lista.error}
          </p>
        )}
        {lista.ok && lista.data.filas.length === 0 && (
          <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
            {hayFiltros
              ? "Ninguna orden coincide con los filtros."
              : desde
                ? "No hay más órdenes."
                : "No hay órdenes activas."}
          </p>
        )}
        {lista.ok && lista.data.filas.length > 0 && <ListaOrdenes ordenes={lista.data.filas} />}
        {lista.ok && (desde || lista.data.siguiente) && (
          <nav aria-label="Paginación" className="flex flex-wrap items-center gap-2">
            {desde && (
              <Link href={hrefOrdenes({ ...filtros, desde: "" })} className={boton}>
                Volver al inicio
              </Link>
            )}
            {lista.data.siguiente && (
              <Link
                href={hrefOrdenes({ ...filtros, desde: lista.data.siguiente })}
                className={boton}
              >
                Siguientes <ChevronRight aria-hidden />
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
