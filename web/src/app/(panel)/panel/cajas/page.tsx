import type { Metadata } from "next";
import { z } from "zod";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { AVISO_FILTRO_INVALIDO, leerFiltros } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Paginador } from "@/modules/catalogo/panel";
import { listarSesiones, ListaSesiones, PAGINA_CAJAS } from "@/modules/caja/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Cajas · ERP Multitiendas" };

export default async function PaginaCajas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo } = await exigirAlgunPermiso(["caja", "ver_reportes"]);
  const {
    filtros: { pagina },
    invalido,
  } = leerFiltros(
    { pagina: z.coerce.number().int().min(1).max(10_000) },
    { pagina: 1 },
    await searchParams,
  );
  const lista = await listarSesiones(await createClient(), activo.negocioId, pagina, PAGINA_CAJAS);

  return (
    <>
      <EncabezadoPagina
        titulo="Cajas"
        descripcion={`Sesiones de caja de ${activo.nombre}, de la más reciente a la más antigua. Esperado, contado y diferencia aparecen al cerrar.`}
      />
      {invalido && (
        <p role="status" className="mb-4 text-sm font-medium">
          {AVISO_FILTRO_INVALIDO}
        </p>
      )}
      {!lista.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {lista.error}
        </p>
      ) : lista.data.filas.length === 0 ? (
        <EstadoVacio>Aún no hay sesiones de caja.</EstadoVacio>
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <ListaSesiones sesiones={lista.data.filas} />
          <Paginador
            pagina={lista.data.pagina}
            porPagina={PAGINA_CAJAS}
            total={lista.data.total}
            unidad="sesiones"
            hrefDe={(p) => `/panel/cajas${p > 1 ? `?pagina=${p}` : ""}`}
          />
        </div>
      )}
    </>
  );
}
