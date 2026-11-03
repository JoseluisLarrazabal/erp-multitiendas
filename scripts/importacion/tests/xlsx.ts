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

// 1x1 px válidos, para que el archivo sea una imagen de verdad.
export const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Imagen anclada en una celda: fila como en Sheets (1-based), columna base 0. El mismo `datos` = la misma imagen del libro. */
export type ImagenAnclada = { fila: number; columna: number; datos: Buffer };

/** Escribe un xlsx con una hoja ajena y la de Productos (encabezado en la fila 1), con imágenes opcionales. */
export async function crearXlsx(
  ruta: string,
  filas: Valor[][],
  imagenes: ImagenAnclada[] = [],
): Promise<void> {
  const libro = new ExcelJS.Workbook();
  libro.addWorksheet("Instrucciones").addRow(["texto"]);
  const hoja = libro.addWorksheet("Productos");
  hoja.addRow(ENCABEZADO);
  for (const f of filas) hoja.addRow(f);
  const ids = new Map<Buffer, number>();
  for (const { fila, columna, datos } of imagenes) {
    // La extensión es solo la del libro; el tipo real lo decide el script por los bytes.
    if (!ids.has(datos)) ids.set(datos, libro.addImage({ buffer: datos as never, extension: "png" }));
    hoja.addImage(ids.get(datos)!, { tl: { col: columna, row: fila - 1 }, ext: { width: 10, height: 10 } });
  }
  await libro.xlsx.writeFile(ruta);
}
