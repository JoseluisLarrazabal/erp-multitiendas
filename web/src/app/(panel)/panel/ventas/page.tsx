import type { Metadata } from "next";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Paginador } from "@/modules/catalogo/panel";
import {
  FiltrosVentasForm,
  hrefVentas,
  leerFiltrosVentas,
  listarEquiposPanel,
  listarVentas,
  ListaVentas,
  PAGINA_VENTAS,
} from "@/modules/ventas/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Ventas · ERP Multitiendas" };

export default async function PaginaVentas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo } = await exigirAlgunPermiso(["ver_reportes", "anular"]);
  const { filtros, invalido } = leerFiltrosVentas(await searchParams);
  const supabase = await createClient();
  const [lista, equipos] = await Promise.all([
    listarVentas(supabase, activo.negocioId, filtros, PAGINA_VENTAS),
    listarEquiposPanel(supabase, activo.negocioId),
  ]);
  const error = !lista.ok ? lista.error : !equipos.ok ? equipos.error : null;
  const hayFiltros = !!(
    filtros.q ||
    filtros.estado ||
    filtros.equipo ||
    filtros.desde ||
    filtros.hasta
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Ventas"
        descripcion={`Ventas de ${activo.nombre}, de la más reciente a la más antigua. Entra a una para ver el detalle, anularla o devolverla.`}
      />
      <div className="flex min-w-0 flex-col gap-5">
        <FiltrosVentasForm
          filtros={filtros}
          invalido={invalido}
          equipos={equipos.ok ? equipos.data : []}
        />
        {invalido && (
          <p role="status" className="text-sm font-medium">
            {AVISO_FILTRO_INVALIDO}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {lista.ok && lista.data.filas.length === 0 && (
          <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
            {hayFiltros ? "Ninguna venta coincide con los filtros." : "Aún no hay ventas."}
          </p>
        )}
        {lista.ok && equipos.ok && lista.data.filas.length > 0 && (
          <ListaVentas ventas={lista.data.filas} equipos={equipos.data} />
        )}
        {lista.ok && (
          <Paginador
            pagina={lista.data.pagina}
            porPagina={PAGINA_VENTAS}
            total={lista.data.total}
            unidad="ventas"
            hrefDe={(pagina) => hrefVentas({ ...filtros, pagina })}
          />
        )}
      </div>
    </>
  );
}
