import type { Metadata } from "next";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { etiquetaRol } from "@/modules/usuarios";
import { exigirPanel } from "@/modules/usuarios/panel";
import { Acciones } from "./_tablero/acciones";
import { Avisos } from "./_tablero/avisos";
import { bloquesTablero } from "./_tablero/bloques";
import { CajasAbiertas } from "./_tablero/cajas-abiertas";
import { Esqueleto } from "./_tablero/comun";
import { CreditosPagos } from "./_tablero/creditos-pagos";
import { Lotes } from "./_tablero/lotes";
import { MasVendidos } from "./_tablero/mas-vendidos";
import { OrdenesListas } from "./_tablero/ordenes-listas";
import { StockBajo } from "./_tablero/stock-bajo";
import { VentasHoy } from "./_tablero/ventas-hoy";

export const metadata: Metadata = { title: "Inicio · ERP Multitiendas" };

const FECHA_LARGA = new Intl.DateTimeFormat("es-BO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/La_Paz",
});
// "martes, 10 de noviembre" -> "Martes 10 de noviembre"
const fechaLarga = () => {
  const t = FECHA_LARGA.format(new Date()).replace(",", "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default async function PanelInicio() {
  const { activo, permisos } = await exigirPanel();
  const b = bloquesTablero(permisos, activo.tipo);
  const id = activo.negocioId;
  const hayAvisos = b.porRevisar || b.lotes || b.ordenes;
  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            <span className="sr-only">Inicio: </span>
            {fechaLarga()}
          </>
        }
        descripcion={`${activo.nombre} · ${etiquetaRol(activo.rol)}`}
      />
      <div className="flex flex-col gap-4">
        <Acciones acciones={b.acciones} />
        {/* La columna de "Por atender" existe siempre en escritorio; en celular va arriba, debajo de las acciones. */}
        <div
          className={
            b.ventas && hayAvisos ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]" : "grid gap-4"
          }
        >
          {hayAvisos && (
            <div className={b.ventas ? "lg:col-start-2 lg:row-start-1" : undefined}>
              <Suspense fallback={<Esqueleto className="h-40" />}>
                <Avisos negocioId={id} bloques={b} />
              </Suspense>
            </div>
          )}
          {b.ventas && (
            <div className="lg:col-start-1 lg:row-start-1">
              <Suspense fallback={<Esqueleto className="h-64" />}>
                <VentasHoy negocioId={id} verUtilidad={b.utilidad} />
              </Suspense>
            </div>
          )}
        </div>
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          {b.cajas && (
            <Suspense fallback={<Esqueleto className="h-56" />}>
              <CajasAbiertas negocioId={id} />
            </Suspense>
          )}
          {b.creditos && (
            <Suspense fallback={<Esqueleto className="h-56" />}>
              <CreditosPagos negocioId={id} bloques={b} />
            </Suspense>
          )}
          {b.ordenes && (
            <Suspense fallback={<Esqueleto className="h-40" />}>
              <OrdenesListas negocioId={id} />
            </Suspense>
          )}
          {b.stockBajo && (
            <Suspense fallback={<Esqueleto className="h-72" />}>
              <StockBajo negocioId={id} />
            </Suspense>
          )}
          {b.masVendidos && (
            <Suspense fallback={<Esqueleto className="h-72" />}>
              <MasVendidos negocioId={id} tipo={activo.tipo} />
            </Suspense>
          )}
          {b.lotes && (
            <Suspense fallback={<Esqueleto className="h-56" />}>
              <Lotes negocioId={id} />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
