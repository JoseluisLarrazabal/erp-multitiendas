import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  CalendarClock,
  ClipboardCheck,
  Droplets,
  PackageMinus,
  PackagePlus,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Paginador } from "@/modules/catalogo/panel";
import { filtrosStockSchema, hrefStock, PAGINA_STOCK } from "@/modules/inventario";
import {
  contarStockBajo,
  FiltrosStockForm,
  listarStock,
  ListaStock,
} from "@/modules/inventario/panel";
import { exigirAlgunPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Inventario · ERP Multitiendas" };

export default async function PaginaInventario({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirAlgunPermiso(["ajustar_inventario", "ver_reportes"]);
  const filtros = filtrosStockSchema.parse(await searchParams);
  const puedeAjustar = permisos.includes("ajustar_inventario");
  const verCostos = permisos.includes("ver_costos");
  const supabase = await createClient();
  const [lista, ubicaciones, bajos] = await Promise.all([
    listarStock(supabase, activo.negocioId, filtros, PAGINA_STOCK, verCostos),
    listarUbicaciones(supabase, activo.negocioId),
    contarStockBajo(supabase, activo.negocioId),
  ]);
  const error = !lista.ok ? lista.error : !ubicaciones.ok ? ubicaciones.error : null;
  const hayFiltros = filtros.q !== "" || filtros.bajo;
  const enlace = buttonVariants({ variant: "outline", className: "h-10" });

  return (
    <>
      <EncabezadoPagina
        titulo="Inventario"
        descripcion={`Stock de ${activo.nombre} por ubicación. Entra a un producto para ver su kardex.`}
        acciones={
          (puedeAjustar || activo.tipo === "frial") && (
            <>
              {activo.tipo === "frial" && (
                <Link href="/panel/inventario/vencimientos" className={enlace}>
                  <CalendarClock aria-hidden /> Vencimientos
                </Link>
              )}
              {puedeAjustar && (
                <>
                  <Link href="/panel/inventario/entrada" className={enlace}>
                    <PackagePlus aria-hidden /> Entrada
                  </Link>
                  <Link href="/panel/inventario/salida" className={enlace}>
                    <PackageMinus aria-hidden /> Salida o ajuste
                  </Link>
                  {activo.tipo === "lavanderia" && (
                    <Link href="/panel/inventario/salida?tipo=consumo" className={enlace}>
                      <Droplets aria-hidden /> Consumo
                    </Link>
                  )}
                  <Link href="/panel/inventario/traslado" className={enlace}>
                    <ArrowLeftRight aria-hidden /> Traslado
                  </Link>
                  <Link href="/panel/inventario/conteo" className={enlace}>
                    <ClipboardCheck aria-hidden /> Conteo
                  </Link>
                </>
              )}
            </>
          )
        }
      />
      <div className="flex min-w-0 flex-col gap-5">
        <FiltrosStockForm filtros={filtros} bajos={bajos.ok ? bajos.data : null} />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {lista.ok && lista.data.filas.length === 0 && (
          <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
            {filtros.bajo && filtros.q === ""
              ? "Ningún producto está bajo su mínimo."
              : hayFiltros
                ? "Ningún producto coincide con la búsqueda o el filtro."
                : "Aún no hay productos con stock para mostrar."}
          </p>
        )}
        {lista.ok && ubicaciones.ok && lista.data.filas.length > 0 && (
          <ListaStock
            filas={lista.data.filas}
            ubicaciones={ubicaciones.data}
            verCostos={verCostos}
          />
        )}
        {lista.ok && (
          <Paginador
            pagina={lista.data.pagina}
            porPagina={PAGINA_STOCK}
            total={lista.data.total}
            hrefDe={(pagina) => hrefStock({ q: filtros.q, bajo: filtros.bajo, pagina })}
          />
        )}
      </div>
    </>
  );
}
