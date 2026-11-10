import type { Metadata } from "next";
import Link from "next/link";
import { Hourglass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { formatearDia, hoyEnBolivia } from "@/lib/format/fecha";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import {
  agruparAlCambiar,
  armarTabla,
  hrefReportes,
  leerFiltrosReporte,
  nombreArchivo,
  rangosRapidos,
  reportesDe,
} from "@/modules/reportes";
import {
  BotonExcel,
  FiltrosReporteForm,
  leerReporte,
  TablaReporte,
} from "@/modules/reportes/panel";
import { exigirPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Reportes · ERP Multitiendas" };

export default async function PaginaReportes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirPermiso("ver_reportes");
  const hoy = hoyEnBolivia();
  const verCostos = permisos.includes("ver_costos");
  const { filtros, invalido } = leerFiltrosReporte(await searchParams, activo.tipo, hoy, verCostos);
  const lista = reportesDe(activo.tipo, verCostos);
  const def = lista.find((d) => d.id === filtros.r)!;
  const datos = await leerReporte(await createClient(), activo.negocioId, filtros);
  const tabla = datos.ok
    ? armarTabla(datos.data, {
        tipo: activo.tipo,
        agrupar: filtros.agrupar,
        filtro: filtros.filtro,
        puedeVerCostos: verCostos,
        esMasVendidos: filtros.r === "masvendidos",
      })
    : null;
  const rango =
    filtros.desde === filtros.hasta
      ? formatearDia(filtros.desde)
      : `${formatearDia(filtros.desde)} al ${formatearDia(filtros.hasta)}`;
  const archivo =
    def.id === "stock"
      ? nombreArchivo("stock", activo.nombre, hoy)
      : nombreArchivo(def.etiqueta, activo.nombre, filtros.desde, filtros.hasta);

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion={`${def.etiqueta} de ${activo.nombre}${def.id === "stock" ? ", al día de hoy" : `, del ${rango}`}. Las fechas son de La Paz y cuentan ambos días.`}
        acciones={
          activo.tipo === "frial" && (
            <Link
              href="/panel/inventario/vencimientos"
              className={buttonVariants({ variant: "outline", className: "h-10" })}
            >
              <Hourglass aria-hidden /> Vencimientos
            </Link>
          )
        }
      />
      <div className="flex min-w-0 flex-col gap-5">
        <nav aria-label="Reporte" className="flex flex-wrap items-center gap-2">
          {lista.map((d) => (
            <Link
              key={d.id}
              href={hrefReportes({
                ...filtros,
                r: d.id,
                agrupar: agruparAlCambiar(d, filtros.agrupar),
              })}
              aria-current={d.id === filtros.r ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: d.id === filtros.r ? "default" : "outline", size: "sm" }),
                "min-h-9 md:min-h-8",
              )}
            >
              {d.etiqueta}
            </Link>
          ))}
        </nav>
        {def.criterio && <p className="text-muted-foreground text-sm">{def.criterio}</p>}
        <FiltrosReporteForm filtros={filtros} def={def} tipo={activo.tipo} hoy={hoy} />
        {invalido && (
          <p role="status" className="text-sm font-medium">
            {AVISO_FILTRO_INVALIDO}
          </p>
        )}
        {!datos.ok && (
          <p role="alert" className="text-destructive text-sm">
            {datos.error}
          </p>
        )}
        {tabla?.avisos.map((a) => (
          <p key={a} role="status" className="text-sm font-medium">
            {a}
          </p>
        ))}
        {tabla && tabla.filas.length === 0 && (
          <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
            No hay datos para este reporte con los filtros elegidos. Prueba con otro rango, por
            ejemplo{" "}
            <Link
              href={hrefReportes({ ...filtros, ...rangosRapidos(hoy).mes })}
              className="text-foreground underline underline-offset-2"
            >
              Este mes
            </Link>
            .
          </p>
        )}
        {tabla && tabla.filas.length > 0 && (
          <>
            <div className="flex justify-end">
              <BotonExcel tabla={tabla} archivo={archivo} />
            </div>
            <TablaReporte tabla={tabla} nombre={def.etiqueta} />
          </>
        )}
      </div>
    </>
  );
}
