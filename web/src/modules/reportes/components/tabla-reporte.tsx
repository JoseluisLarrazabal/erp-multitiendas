import { Td, TdCifra, Th } from "@/components/ui/tabla";
import { cn } from "@/lib/utils";
import { esNumerica, textoCelda, type TablaDatos } from "../tabla";

// Tabla de un reporte. Dentro de un contenedor con scroll horizontal (enfocable con teclado): en el celular la página
// no se ensancha.
export function TablaReporte({ tabla, nombre }: { tabla: TablaDatos; nombre: string }) {
  const { columnas } = tabla;
  // Números y fechas no se parten; los textos pueden envolver.
  const clase = (i: number) =>
    cn(
      columnas[i]!.tipo === "texto"
        ? "min-w-32 text-left break-words whitespace-normal"
        : "whitespace-nowrap",
      esNumerica(columnas[i]!.tipo) ? "text-right" : "text-left",
    );
  const celda = (v: string | number | null, i: number, esTotal: boolean) => {
    const contenido = esTotal && v === null ? "" : textoCelda(columnas[i]!.tipo, v);
    const filete = esTotal && "border-t-foreground border-t-2";
    return i === 0 ? (
      <th
        key={i}
        scope="row"
        className={cn(
          "h-11 border-b px-3 first:pl-0 last:pr-0",
          clase(i),
          "font-normal",
          esTotal && "font-semibold",
          filete,
        )}
      >
        {contenido}
      </th>
    ) : esNumerica(columnas[i]!.tipo) ? (
      <TdCifra key={i} className={cn(clase(i), filete)}>
        {contenido}
      </TdCifra>
    ) : (
      <Td key={i} className={cn(clase(i), "text-[13px]", filete)}>
        {contenido}
      </Td>
    );
  };
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`Tabla de ${nombre}`}
      className="focus-visible:ring-ring overflow-x-auto rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{nombre}</caption>
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <Th key={c.titulo} scope="col" className={clase(i)}>
                {c.titulo}
              </Th>
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
  );
}
