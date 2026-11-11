import { cn } from "@/lib/utils";
import { esNumerica, textoCelda, type TablaDatos } from "../tabla";

// Lo común de las celdas va en la tabla con selectores descendientes: un reporte de Stock llega a ~13.000 celdas y cada
// una lleva solo su alineación (y `cifra` si es numérica), no una cadena larga de clases (menos bytes y menos `cn()`).
const CLASE_TABLA = [
  "w-full text-sm",
  "[&_:is(td,th):first-child]:pl-0 [&_:is(td,th):last-child]:pr-0",
  "[&_thead_th]:text-muted-foreground [&_thead_th]:border-foreground [&_thead_th]:h-10 [&_thead_th]:border-b-2 [&_thead_th]:px-3 [&_thead_th]:text-[13px] [&_thead_th]:font-semibold",
  "[&_:is(tbody,tfoot)_:is(td,th)]:h-11 [&_:is(tbody,tfoot)_:is(td,th)]:border-b [&_:is(tbody,tfoot)_:is(td,th)]:px-3",
  "[&_tbody_th]:font-normal [&_:is(tbody,tfoot)_:is(td,th)]:text-[13px]",
].join(" ");

// Tabla de un reporte. Dentro de un contenedor con scroll horizontal (enfocable con teclado): en el celular la página
// no se ensancha.
export function TablaReporte({ tabla, nombre }: { tabla: TablaDatos; nombre: string }) {
  const { columnas } = tabla;
  // Una vez por columna (y por variante), fuera del bucle de filas. Números y fechas no se parten; los textos envuelven.
  const filete = "border-t-foreground border-t-2";
  const clases = columnas.map((c) => {
    const base = cn(
      c.tipo === "texto" ? "min-w-32 break-words whitespace-normal" : "whitespace-nowrap",
      esNumerica(c.tipo) ? "text-right" : "text-left",
    );
    const dato = cn(base, esNumerica(c.tipo) && "cifra");
    return {
      base,
      fila: base,
      celda: dato,
      totalFila: cn(base, filete, "font-semibold"),
      totalCelda: cn(dato, filete),
    };
  });
  const celda = (v: string | number | null, i: number, esTotal: boolean) => {
    const contenido = esTotal && v === null ? "" : textoCelda(columnas[i]!.tipo, v);
    const k = clases[i]!;
    return i === 0 ? (
      <th key={i} scope="row" className={esTotal ? k.totalFila : k.fila}>
        {contenido}
      </th>
    ) : (
      <td key={i} className={esTotal ? k.totalCelda : k.celda}>
        {contenido}
      </td>
    );
  };
  return (
    <>
      <p className="text-muted-foreground mb-2 text-xs md:hidden">
        Desliza hacia la derecha para ver todas las columnas.
      </p>
      <div
        tabIndex={0}
        role="region"
        aria-label={`Tabla de ${nombre}`}
        className="focus-visible:ring-ring overflow-x-auto rounded-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <table className={CLASE_TABLA}>
          <caption className="sr-only">{nombre}</caption>
          <thead>
            <tr>
              {columnas.map((c, i) => (
                <th key={c.titulo} scope="col" className={clases[i]!.base}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, n) => (
              <tr key={n}>{fila.map((v, i) => celda(v, i, false))}</tr>
            ))}
          </tbody>
          {tabla.totales && (
            <tfoot>
              <tr className="font-semibold">{tabla.totales.map((v, i) => celda(v, i, true))}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
