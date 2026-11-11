import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Paginador } from "@/modules/catalogo/panel";
import {
  leerFiltrosCompras,
  listarCompras,
  ListaCompras,
  PAGINA_COMPRAS,
} from "@/modules/compras/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Compras · ERP Multitiendas" };

export default async function PaginaCompras({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirPermiso("gestionar_compras");
  const { filtros, invalido } = leerFiltrosCompras(await searchParams);
  const verCostos = permisos.includes("ver_costos");
  const lista = await listarCompras(
    await createClient(),
    activo.negocioId,
    filtros.pagina,
    PAGINA_COMPRAS,
    verCostos,
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Compras"
        descripcion={`Compras a proveedores de ${activo.nombre}. Cada compra suma stock y recalcula el costo promedio.`}
        acciones={
          <Link href="/panel/compras/nueva" className={buttonVariants()}>
            <Plus aria-hidden /> Nueva compra
          </Link>
        }
      />
      <div className="flex min-w-0 flex-col gap-6">
        {invalido && (
          <p role="status" className="text-sm font-medium">
            {AVISO_FILTRO_INVALIDO}
          </p>
        )}
        {!lista.ok ? (
          <p role="alert" className="text-destructive text-sm">
            {lista.error}
          </p>
        ) : lista.data.filas.length === 0 ? (
          <EstadoVacio>Aún no hay compras.</EstadoVacio>
        ) : (
          <>
            <ListaCompras compras={lista.data.filas} puedeAnular={permisos.includes("anular")} />
            <Paginador
              pagina={lista.data.pagina}
              porPagina={PAGINA_COMPRAS}
              total={lista.data.total}
              unidad="compras"
              hrefDe={(p) => `/panel/compras${p > 1 ? `?pagina=${p}` : ""}`}
            />
          </>
        )}
      </div>
    </>
  );
}
