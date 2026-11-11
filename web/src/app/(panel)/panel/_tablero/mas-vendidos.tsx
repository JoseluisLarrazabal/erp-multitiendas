import { createClient } from "@/lib/supabase/server";
import { formatearBs } from "@/lib/format/moneda";
import { hoyEnBolivia } from "@/lib/format/fecha";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { hrefReportes } from "@/modules/reportes";
import { leerReporte } from "@/modules/reportes/panel";
import { ErrorBloque, Tarjeta } from "./comun";
import { restarDias } from "./serie";

const PRIMEROS = 5;

export async function MasVendidos({ negocioId, tipo }: { negocioId: string; tipo: string }) {
  const hoy = hoyEnBolivia();
  const desde = restarDias(hoy, 6);
  const r = await leerReporte(await createClient(), negocioId, {
    r: "ventas",
    desde,
    hasta: hoy,
    agrupar: "producto",
    dias: 30,
    filtro: "todo",
  });
  // El frial no tiene la pestaña "Más vendidos": su ranking es Ventas por corte.
  const href = hrefReportes(
    tipo === "frial"
      ? { r: "ventas", agrupar: "producto", desde, hasta: hoy }
      : { r: "masvendidos", desde, hasta: hoy },
  );
  const titulo = "Más vendidos de la semana";
  if (!r.ok) return <ErrorBloque titulo={titulo} mensaje={r.error} href={href} />;
  const filas =
    r.data.tipo === "ventas" ? r.data.filas.filter((f) => f.neto > 0).slice(0, PRIMEROS) : [];
  const maximo = Math.max(...filas.map((f) => f.neto));
  return (
    <Tarjeta titulo={titulo} enlace={{ href, texto: "Reporte" }}>
      {filas.length === 0 ? (
        <EstadoVacio>Sin ventas en los últimos 7 días.</EstadoVacio>
      ) : (
        <ol className="-my-1 flex flex-col">
          {filas.map((f, i) => (
            <li key={f.clave ?? f.etiqueta} className="border-b py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex min-w-0 gap-2 text-sm font-semibold">
                  <span className="text-muted-foreground w-4 shrink-0 font-normal">{i + 1}</span>
                  <span className="line-clamp-2" title={f.etiqueta}>
                    {f.etiqueta}
                  </span>
                </p>
                <p className="cifra text-[13px] whitespace-nowrap">{formatearBs(f.neto)}</p>
              </div>
              <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full" aria-hidden>
                <div
                  className="bg-chart-bar h-full rounded-full"
                  style={{ width: `${(f.neto / maximo) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}
