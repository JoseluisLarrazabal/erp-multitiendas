import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EncabezadoPagina, Seccion } from "@/modules/catalogo/panel";
import { listarCajaPorRevisar, ListaCajaPorRevisar } from "@/modules/caja/panel";
import { listarStock, ListaStock } from "@/modules/inventario/panel";
import { exigirAlgunPermiso, listarUbicaciones } from "@/modules/usuarios/panel";
import {
  leerDesdeReconciliacion,
  listarReconciliacion,
  ListaReconciliacion,
  PAGINA_RECONCILIACION,
} from "@/modules/ventas/panel";

export const metadata: Metadata = { title: "Reconciliación · ERP Multitiendas" };

const LIMITE_NEGATIVOS = 25;
const vacio = "text-muted-foreground text-sm";

export default async function PaginaReconciliacion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo } = await exigirAlgunPermiso(["ver_reportes"]);
  const {
    filtros: { desde: desdePedido },
    invalido,
  } = leerDesdeReconciliacion(await searchParams);
  const supabase = await createClient();
  const [ventasInicial, negativos, ubicaciones, caja] = await Promise.all([
    listarReconciliacion(supabase, activo.negocioId, desdePedido || null, PAGINA_RECONCILIACION),
    listarStock(
      supabase,
      activo.negocioId,
      { q: "", bajo: false, pagina: 1, negativo: true },
      LIMITE_NEGATIVOS,
      false,
    ),
    listarUbicaciones(supabase, activo.negocioId),
    listarCajaPorRevisar(supabase, activo.negocioId),
  ]);
  // Un cursor de otro negocio (o viejo) lo rechaza la RPC: se ignora y se parte del inicio, como un filtro inválido.
  const cursorIgnorado = !ventasInicial.ok && !!desdePedido;
  const desde = cursorIgnorado ? "" : desdePedido;
  const ventas = cursorIgnorado
    ? await listarReconciliacion(supabase, activo.negocioId, null, PAGINA_RECONCILIACION)
    : ventasInicial;

  return (
    <>
      <EncabezadoPagina
        titulo="Reconciliación"
        descripcion={`Ventas sin conexión de ${activo.nombre} con algo por revisar o un QR sin confirmar, y productos con stock negativo en alguna ubicación.`}
      />
      {(invalido || cursorIgnorado) && (
        <p role="status" className="mb-4 text-sm font-medium">
          {AVISO_FILTRO_INVALIDO}
        </p>
      )}
      <div className="flex min-w-0 flex-col gap-6">
        <Seccion titulo="Ventas a revisar">
          {!ventas.ok ? (
            <p role="alert" className="text-destructive text-sm">
              {ventas.error}
            </p>
          ) : (
            <ListaReconciliacion
              ventas={ventas.data.filas}
              textoVacio={desde ? "No hay más ventas para revisar." : "No hay ventas para revisar."}
            />
          )}
          {ventas.ok && (desde || ventas.data.siguiente) && (
            <nav aria-label="Paginación" className="flex flex-wrap items-center gap-2">
              {desde && (
                <Link
                  href="/panel/reconciliacion"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "min-h-9 md:min-h-8",
                  )}
                >
                  Volver al inicio
                </Link>
              )}
              {ventas.data.siguiente && (
                <Link
                  href={`/panel/reconciliacion?desde=${ventas.data.siguiente}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "min-h-9 md:min-h-8",
                  )}
                >
                  Siguientes <ChevronRight aria-hidden />
                </Link>
              )}
            </nav>
          )}
        </Seccion>

        <Seccion titulo="Caja por revisar">
          {!caja.ok ? (
            <p role="alert" className="text-destructive text-sm">
              {caja.error}
            </p>
          ) : (
            <ListaCajaPorRevisar filas={caja.data} />
          )}
        </Seccion>

        <Seccion titulo="Stock negativo">
          {!negativos.ok || !ubicaciones.ok ? (
            <p role="alert" className="text-destructive text-sm">
              {!negativos.ok ? negativos.error : !ubicaciones.ok ? ubicaciones.error : null}
            </p>
          ) : negativos.data.filas.length === 0 ? (
            <p className={vacio}>Ningún producto tiene stock negativo.</p>
          ) : (
            <>
              <ListaStock
                filas={negativos.data.filas}
                ubicaciones={ubicaciones.data}
                verCostos={false}
              />
              {negativos.data.total > negativos.data.filas.length && (
                <p className="text-muted-foreground text-xs">
                  Mostrando {negativos.data.filas.length} de {negativos.data.total} productos.{" "}
                  <Link href="/panel/inventario" className="underline">
                    Ver todo en Inventario
                  </Link>
                </p>
              )}
            </>
          )}
        </Seccion>
      </div>
    </>
  );
}
