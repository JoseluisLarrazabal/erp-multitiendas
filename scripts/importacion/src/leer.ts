import ExcelJS from "exceljs";

// Una celda leída: siempre texto, más si la celda guardaba un número (el cero inicial ya se perdió).
export type Celda = { texto: string; esNumero: boolean };

export const CAMPOS = [
  "codigo",
  "barras",
  "nombre",
  "marca",
  "modelo",
  "categoria",
  "stock",
  "ubicacion",
] as const;
export type Campo = (typeof CAMPOS)[number];

export type FilaCruda = {
  /** Número de fila como en Sheets (la 1 es el encabezado). */
  fila: number;
  celdas: Record<Campo, Celda>;
  /** Celdas con valor en toda la fila, de cualquier columna: detecta la fila suelta. */
  valores: number;
};

const ENCABEZADOS: Record<Campo, string[]> = {
  codigo: ["código interno"],
  barras: ["código de barras"],
  nombre: ["descripción"],
  marca: ["marca"],
  modelo: ["modelo"],
  categoria: ["categoría"],
  stock: ["stock actual"],
  ubicacion: ["ubicacion", "ubicación"],
};

export const HOJA_PRODUCTOS = "Productos";

function aCelda(celda: ExcelJS.Cell): Celda {
  const v = celda.value;
  const numero =
    typeof v === "number"
      ? v
      : v !== null && typeof v === "object" && "result" in v && typeof v.result === "number"
        ? v.result
        : null;
  if (numero !== null) return { texto: String(numero), esNumero: true };
  return { texto: celda.text ?? "", esNumero: false };
}

// Lectura en streaming: las 292 fotos embebidas no se cargan en memoria.
export async function leerProductos(ruta: string): Promise<FilaCruda[]> {
  const lector = new ExcelJS.stream.xlsx.WorkbookReader(ruta, {
    sharedStrings: "cache",
    styles: "cache",
    worksheets: "emit",
    hyperlinks: "ignore",
    entries: "ignore",
  });
  const filas: FilaCruda[] = [];
  let columnas: Record<Campo, number> | null = null;
  let encontrada = false;

  // Hay que recorrer TODAS las hojas hasta el final, y consumir las ajenas: exceljs bufferea cada hoja en un archivo
  // temporal y lo borra al pasar a la siguiente; una hoja sin consumir (o un `return` antes de tiempo) deja que el
  // borrado gane a la apertura diferida del stream y estalla como ENOENT no capturado.
  for await (const hoja of lector) {
    // Los tipos de exceljs no declaran `name` en WorksheetReader, pero existe (verificado con 4.4.0).
    if ((hoja as unknown as { name: string }).name !== HOJA_PRODUCTOS) {
      for await (const _ of hoja);
      continue;
    }
    encontrada = true;
    for await (const fila of hoja) {
      if (fila.number === 1) {
        const faltan: string[] = [];
        const encontrado: Partial<Record<Campo, number>> = {};
        for (const campo of CAMPOS) {
          const posicion = (fila.values as unknown[]).findIndex(
            (v, i) =>
              i > 0 &&
              typeof v === "string" &&
              ENCABEZADOS[campo].includes(v.trim().replace(/\s+/g, " ").toLowerCase()),
          );
          if (posicion > 0) encontrado[campo] = posicion;
          else faltan.push(campo);
        }
        if (faltan.length > 0)
          throw new Error(`Faltan columnas en Productos: ${faltan.join(", ")}`);
        columnas = encontrado as Record<Campo, number>;
        continue;
      }
      if (!columnas) throw new Error("La hoja Productos no tiene encabezado en la fila 1");
      let valores = 0;
      fila.eachCell({ includeEmpty: false }, (c) => {
        if (aCelda(c).texto.trim() !== "") valores++;
      });
      if (valores === 0) continue;
      const celdas = Object.fromEntries(
        CAMPOS.map((campo) => [campo, aCelda(fila.getCell(columnas![campo]))]),
      ) as Record<Campo, Celda>;
      filas.push({ fila: fila.number, celdas, valores });
    }
  }
  if (!encontrada) throw new Error(`No existe la hoja ${HOJA_PRODUCTOS}`);
  return filas;
}
