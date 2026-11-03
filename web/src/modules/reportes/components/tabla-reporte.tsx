import { cn } from "@/lib/utils";
import { esNumerica, textoCelda, type TablaDatos } from "../tabla";

// Tabla de un reporte. Dentro de un contenedor con scroll horizontal (enfocable con teclado): en el celular la página
// no se ensancha.
export function TablaReporte({ tabla, nombre }: { tabla: TablaDatos; nombre: string }) {
  const { columnas } = tabla;
  // Números y fechas no se parten; los textos pueden envolver.
  const clase = (i: number) =>
    cn(
      "px-3 py-2",
      columnas[i]!.tipo === "texto"
        ? "min-w-32 text-left break-words whitespace-normal"
        : "whitespace-nowrap",
      esNumerica(columnas[i]!.tipo) ? "text-right tabular-nums" : "text-left",
    );
  const celda = (v: string | number | null, i: number, esTotal: boolean) => {
    const contenido = esTotal && v === null ? "" : textoCelda(columnas[i]!.tipo, v);
    return i === 0 ? (
      <th key={i} scope="row" className={cn(clase(i), "font-normal", esTotal && "font-semibold")}>
        {contenido}
      </th>
    ) : (
      <td key={i} className={clase(i)}>
        {contenido}
      </td>
    );
  };
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`Tabla de ${nombre}`}
      className="bg-card focus-visible:ring-ring overflow-x-auto rounded-xl border shadow-[0_2px_5px_#34345a0d] focus-visible:ring-2 focus-visible:outline-none"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{nombre}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-xs font-semibold">
            {columnas.map((c, i) => (
              <th key={c.titulo} scope="col" className={clase(i)}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {tabla.filas.map((fila, n) => (
            <tr key={n}>{fila.map((v, i) => celda(v, i, false))}</tr>
          ))}
        </tbody>
        {tabla.totales && (
          <tfoot>
            <tr className="border-t-2 font-semibold">
              {tabla.totales.map((v, i) => celda(v, i, true))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
