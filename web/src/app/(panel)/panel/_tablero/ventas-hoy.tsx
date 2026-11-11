import { createClient } from "@/lib/supabase/server";
import { formatearBs } from "@/lib/format/moneda";
import { hoyEnBolivia } from "@/lib/format/fecha";
import { leerReporte } from "@/modules/reportes/panel";
import { ErrorBloque, plural, Tarjeta } from "./comun";
import { GraficoSemana } from "./grafico-semana";
import { restarDias, serieSieteDias } from "./serie";

export async function VentasHoy({
  negocioId,
  verUtilidad,
}: {
  negocioId: string;
  verUtilidad: boolean;
}) {
  const hoy = hoyEnBolivia();
  const r = await leerReporte(await createClient(), negocioId, {
    r: "ventas",
    desde: restarDias(hoy, 6),
    hasta: hoy,
    agrupar: "dia",
    dias: 30,
    filtro: "todo",
  });
  if (r.ok === false)
    return <ErrorBloque titulo="Ventas de hoy" mensaje={r.error} href="/panel/ventas" />;
  if (r.data.tipo !== "ventas")
    return (
      <ErrorBloque
        titulo="Ventas de hoy"
        mensaje="El reporte llegó en un formato inesperado."
        href="/panel/ventas"
      />
    );
  const dias = serieSieteDias(r.data.filas, hoy);
  const filaHoy = r.data.filas.find((f) => f.clave === hoy);
  const ayer = dias[5]!.monto;
  // La utilidad llega null sin ver_costos: el permiso lo decide la RPC, no esta pantalla.
  const utilidad = verUtilidad ? (filaHoy?.ganancia ?? null) : null;
  return (
    <Tarjeta titulo="Ventas de hoy" enlace={{ href: "/panel/ventas", texto: "Ver ventas" }}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1">
          <p className="cifra text-3xl leading-tight" data-testid="ventas-hoy-total">
            {formatearBs(dias[6]!.monto)}
          </p>
          <p className="text-muted-foreground text-sm">Ayer, día completo: {formatearBs(ayer)}</p>
          <p className="text-sm">{plural(filaHoy?.ventas ?? 0, "venta", "ventas")}</p>
          {utilidad !== null && (
            <div className="mt-3 border-t pt-3">
              <p className="text-muted-foreground text-[13px] font-semibold">Utilidad de hoy</p>
              <p className="cifra text-xl">{formatearBs(utilidad)}</p>
            </div>
          )}
        </div>
        <GraficoSemana dias={dias} />
      </div>
    </Tarjeta>
  );
}
