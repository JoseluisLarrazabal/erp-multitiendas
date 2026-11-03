import { esDia, type Celda, type Columna, type TablaDatos } from "./tabla";

// Para el nombre de archivo: minúsculas, sin acentos ni espacios.
export const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// `<reporte>-<negocio>-<desde>-<hasta>.xlsx`
export const nombreArchivo = (...partes: string[]) =>
  `${partes.map(slug).filter(Boolean).join("-")}.xlsx`;

const FORMATO: Partial<Record<Columna["tipo"], string>> = {
  monto: "#,##0.00",
  costo: "#,##0.00##",
  kg: "0.000",
  entero: "0",
};

// Excel no guarda zona horaria: la fecha se escribe con la hora de pared de Bolivia (UTC-4) como si fuera UTC.
const BOLIVIA_MS = 4 * 3600_000;

function celda(tipo: Columna["tipo"], v: Celda, esNegrita: boolean) {
  const estilo = esNegrita ? { fontWeight: "bold" as const } : {};
  if (v === null || v === "") return null;
  if (tipo === "dia" && esDia(v))
    return { value: new Date(`${v}T00:00:00Z`), type: Date, format: "dd/mm/yyyy", ...estilo };
  if (tipo === "fechahora")
    return {
      value: new Date(Date.parse(String(v)) - BOLIVIA_MS),
      type: Date,
      format: "dd/mm/yyyy hh:mm",
      ...estilo,
    };
  // Sin neutralizar "=" ni "-": write-excel-file escribe los textos como cadenas compartidas, que Excel nunca evalúa.
  if (tipo === "texto" || tipo === "dia") return { value: String(v), type: String, ...estilo };
  return { value: Number(v), type: Number, format: FORMATO[tipo], ...estilo };
}

// Hoja de datos: encabezado en negrita, filas tipadas y, si hay, la fila de totales en negrita.
export function hojaExcel(t: TablaDatos) {
  return [
    t.columnas.map((c) => ({ value: c.titulo, type: String, fontWeight: "bold" as const })),
    ...t.filas.map((f) => f.map((v, i) => celda(t.columnas[i]!.tipo, v, false))),
    ...(t.totales ? [t.totales.map((v, i) => celda(t.columnas[i]!.tipo, v, true))] : []),
  ];
}

const anchos = (t: TablaDatos) =>
  t.columnas.map((c, i) => ({
    width: Math.min(
      40,
      Math.max(
        c.titulo.length + 2,
        12,
        ...t.filas.map((f) =>
          typeof f[i] === "string" && c.tipo === "texto" ? f[i].length + 2 : 0,
        ),
      ),
    ),
  }));

// Se genera en el navegador con las filas ya cargadas. La librería se carga recién al pulsar el botón.
export async function descargarExcel(t: TablaDatos, archivo: string) {
  const { default: escribir } = await import("write-excel-file/browser");
  await escribir(hojaExcel(t), { sheet: t.hoja, columns: anchos(t) }).toFile(archivo);
}
