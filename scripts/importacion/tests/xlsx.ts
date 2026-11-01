import ExcelJS from "exceljs";

export const ENCABEZADO = [
  "Código interno",
  "imagenes",
  "Código de barras",
  "Descripción",
  "Marca",
  "Modelo",
  "Categoría",
  "Línea",
  "Precio costo (Bs)",
  "Precio contado (Bs)",
  "Precio crédito (Bs)",
  "Precio mínimo (Bs)",
  "Stock actual",
  "Stock mínimo",
  "¿Controla nro. de serie?",
  "Garantía (meses)",
  "Observaciones",
  "Ubicacion",
];

export type Valor = string | number | null;

/** Fila de la planilla con el mismo orden de columnas que la real. Todo inventado. */
export const filaProducto = (p: {
  codigo?: Valor;
  barras?: Valor;
  nombre?: Valor;
  marca?: Valor;
  modelo?: Valor;
  categoria?: Valor;
  stock?: Valor;
  ubicacion?: Valor;
}): Valor[] => [
  p.codigo ?? null,
  null,
  p.barras ?? null,
  p.nombre ?? null,
  p.marca ?? null,
  p.modelo ?? null,
  p.categoria ?? null,
  null,
  null,
  null,
  null,
  null,
  p.stock ?? null,
  null,
  null,
  null,
  null,
  p.ubicacion ?? null,
];

/** Escribe un xlsx con una hoja ajena y la de Productos (encabezado en la fila 1). */
export async function crearXlsx(ruta: string, filas: Valor[][]): Promise<void> {
  const libro = new ExcelJS.Workbook();
  libro.addWorksheet("Instrucciones").addRow(["texto"]);
  const hoja = libro.addWorksheet("Productos");
  hoja.addRow(ENCABEZADO);
  for (const f of filas) hoja.addRow(f);
  await libro.xlsx.writeFile(ruta);
}
