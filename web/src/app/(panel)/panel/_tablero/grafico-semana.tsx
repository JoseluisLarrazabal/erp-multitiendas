import { formatearBs } from "@/lib/format/moneda";
import { cn } from "@/lib/utils";
import { alturaRelativa, type DiaVentas } from "./serie";

const DIA_CORTO = new Intl.DateTimeFormat("es-BO", { weekday: "short", timeZone: "UTC" });
const ENTERO = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 });
// Las barras ocupan hasta el 80% del alto; el resto queda para el monto del día más alto.
const ALTO_MAXIMO = 80;

const etiquetaDia = (dia: string, esHoy: boolean) =>
  esHoy ? "Hoy" : DIA_CORTO.format(new Date(`${dia}T00:00:00Z`)).replace(".", "");

export function GraficoSemana({ dias }: { dias: DiaVentas[] }) {
  const maximo = Math.max(...dias.map((d) => d.monto));
  const alto = (monto: number) => alturaRelativa(monto, maximo) * ALTO_MAXIMO;
  const resumen = dias
    .map((d, i) => `${etiquetaDia(d.dia, i === dias.length - 1)} ${formatearBs(d.monto)}`)
    .join(", ");
  return (
    <figure className="m-0">
      <figcaption className="text-muted-foreground mb-2 text-[13px] font-semibold">
        Últimos 7 días, en Bs
      </figcaption>
      <div role="img" aria-label={`Ventas de los últimos 7 días: ${resumen}`}>
        <div className="relative h-32">
          {/* Solo barras y línea base: los montos van en HTML para que no se encojan con el ancho. */}
          <svg
            viewBox="0 0 70 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            aria-hidden
          >
            {dias.map((d, i) => (
              <rect
                key={d.dia}
                x={i * 10 + 1.5}
                width={7}
                y={100 - alto(d.monto)}
                height={alto(d.monto)}
                className={i === dias.length - 1 ? "fill-primary" : "fill-chart-bar"}
              />
            ))}
            <line
              x1={0}
              x2={70}
              y1={100}
              y2={100}
              className="stroke-border"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="absolute inset-0 grid grid-cols-7" aria-hidden>
            {dias.map((d) => (
              <div key={d.dia} className="relative">
                <span
                  className={cn(
                    "cifra absolute inset-x-0 text-center text-[13px] leading-none whitespace-nowrap",
                    d.monto === 0 && "text-muted-foreground font-normal",
                  )}
                  style={{ bottom: `calc(${alto(d.monto)}% + 4px)` }}
                >
                  {ENTERO.format(d.monto)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-muted-foreground mt-1 grid grid-cols-7 text-[13px]" aria-hidden>
          {dias.map((d, i) => (
            <span
              key={d.dia}
              className={
                i === dias.length - 1 ? "text-foreground text-center font-semibold" : "text-center"
              }
            >
              {etiquetaDia(d.dia, i === dias.length - 1)}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Ventas por día, últimos 7 días</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Ventas</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d, i) => (
            <tr key={d.dia}>
              <th scope="row">{etiquetaDia(d.dia, i === dias.length - 1)}</th>
              <td>{formatearBs(d.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
