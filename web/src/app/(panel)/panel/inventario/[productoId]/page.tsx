import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SelectNativo } from "@/components/ui/select-nativo";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Seccion } from "@/modules/catalogo/panel";
import { filtrosKardexSchema, formatearCantidad, PAGINA_KARDEX } from "@/modules/inventario";
import {
  FormSeries,
  leerKardex,
  ListaKardex,
  obtenerProductoInventario,
  ResumenStock,
  stockPorUbicacion,
} from "@/modules/inventario/panel";
import { hoyEnBolivia } from "@/lib/format/fecha";
import { nombreArchivo } from "@/modules/reportes";
import { BotonKardexExcel } from "@/modules/reportes/panel";
import { exigirAlgunPermiso, listarUbicaciones } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Kardex · ERP Multitiendas" };

export default async function PaginaKardex({
  params,
  searchParams,
}: {
  params: Promise<{ productoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirAlgunPermiso(["ajustar_inventario", "ver_reportes"]);
  const { productoId } = await params;
  if (!z.guid().safeParse(productoId).success) notFound();
  const filtros = filtrosKardexSchema.parse(await searchParams);
  const supabase = await createClient();
  const [producto, ubicaciones, stock] = await Promise.all([
    obtenerProductoInventario(supabase, activo.negocioId, productoId),
    listarUbicaciones(supabase, activo.negocioId),
    stockPorUbicacion(supabase, productoId),
  ]);
  if (producto.ok && producto.data === null) notFound();
  const kardex = producto.ok
    ? await leerKardex(
        supabase,
        productoId,
        { ubicacionId: filtros.ubicacion, desde: filtros.desde },
        PAGINA_KARDEX,
      )
    : null;
  const error = !producto.ok
    ? producto.error
    : !ubicaciones.ok
      ? ubicaciones.error
      : !stock.ok
        ? stock.error
        : kardex && !kardex.ok
          ? kardex.error
          : null;
  const p = producto.ok ? producto.data : null;
  const puedeAjustar = permisos.includes("ajustar_inventario");
  const hrefKardex = (extra: Record<string, string>) => {
    const q = new URLSearchParams(
      Object.entries({ ubicacion: filtros.ubicacion, ...extra }).filter(([, v]) => v),
    ).toString();
    return `/panel/inventario/${productoId}${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <EncabezadoPagina
        titulo={p ? p.nombre : "Kardex"}
        descripcion={p ? `Código ${p.codigo}. Historial de movimientos: solo lectura.` : undefined}
        acciones={
          <Link
            href="/panel/inventario"
            className={buttonVariants({ variant: "outline", className: "h-10" })}
          >
            <ArrowLeft aria-hidden /> Inventario
          </Link>
        }
      />
      <div className="flex min-w-0 flex-col gap-5">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {p && ubicaciones.ok && stock.ok && (
          <>
            <ResumenStock
              ubicaciones={ubicaciones.data}
              stock={stock.data}
              unidad={p.unidad}
              cargando={false}
            />
            {p.stockMinimo !== null && (
              <p className="text-muted-foreground text-sm">
                Mínimo: {formatearCantidad(p.stockMinimo, p.unidad)}
              </p>
            )}
            <form
              method="get"
              action={`/panel/inventario/${productoId}`}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex min-w-48 flex-col gap-1.5">
                <Label htmlFor="kardex-ubicacion">Ubicación</Label>
                <SelectNativo
                  id="kardex-ubicacion"
                  name="ubicacion"
                  defaultValue={filtros.ubicacion}
                >
                  <option value="">Todas</option>
                  {ubicaciones.data.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </SelectNativo>
              </div>
              <Button type="submit" variant="outline" className="h-10">
                Filtrar
              </Button>
            </form>
          </>
        )}
        {kardex?.ok && kardex.data.filas.length === 0 && (
          <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
            Este producto no tiene movimientos
            {filtros.ubicacion ? " en esa ubicación" : ""}.
          </p>
        )}
        {kardex?.ok && p && ubicaciones.ok && kardex.data.filas.length > 0 && (
          <>
            <div className="flex justify-end">
              <BotonKardexExcel
                productoId={p.id}
                ubicacionId={filtros.ubicacion}
                archivo={nombreArchivo("kardex", p.codigo, activo.nombre, hoyEnBolivia())}
              />
            </div>
            <ListaKardex
              movimientos={kardex.data.filas}
              ubicaciones={ubicaciones.data}
              unidad={p.unidad}
            />
          </>
        )}
        {kardex?.ok && (filtros.desde || kardex.data.siguiente) && (
          <nav
            aria-label="Paginación del kardex"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            {filtros.desde ? (
              <Link
                href={hrefKardex({})}
                className={buttonVariants({ variant: "outline", className: "h-10" })}
              >
                <ArrowLeft aria-hidden /> Volver a lo más reciente
              </Link>
            ) : (
              <span />
            )}
            {kardex.data.siguiente && (
              <Link
                href={hrefKardex({ desde: kardex.data.siguiente })}
                className={buttonVariants({ variant: "outline", className: "h-10" })}
              >
                Movimientos más antiguos <ChevronRight aria-hidden />
              </Link>
            )}
          </nav>
        )}
        {p?.controlaSerie && puedeAjustar && ubicaciones.ok && (
          <Seccion titulo="Registrar series">
            <FormSeries
              negocioId={activo.negocioId}
              productoId={p.id}
              ubicaciones={ubicaciones.data}
            />
          </Seccion>
        )}
      </div>
    </>
  );
}
