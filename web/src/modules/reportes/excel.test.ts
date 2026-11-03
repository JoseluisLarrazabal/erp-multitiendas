import { describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/universal";
import { readSheet } from "read-excel-file/universal";
import { hojaExcel, nombreArchivo, slug } from "./excel";
import type { TablaDatos } from "./tabla";

describe("slug y nombre de archivo", () => {
  it("sin acentos, espacios ni mayúsculas", () => {
    expect(slug("Más vendidos")).toBe("mas-vendidos");
    expect(slug("  Lavandería  Demo!! ")).toBe("lavanderia-demo");
  });
  it("<reporte>-<negocio>-<desde>-<hasta>.xlsx", () => {
    expect(nombreArchivo("Ventas", "Tienda Demo", "2026-11-01", "2026-11-02")).toBe(
      "ventas-tienda-demo-2026-11-01-2026-11-02.xlsx",
    );
  });
});

const tabla: TablaDatos = {
  hoja: "Ventas",
  columnas: [
    { titulo: "Día", tipo: "dia" },
    { titulo: "Producto", tipo: "texto" },
    { titulo: "Kg", tipo: "kg" },
    { titulo: "Neto", tipo: "monto" },
    { titulo: "Abierta", tipo: "fechahora" },
  ],
  filas: [
    ["2026-11-02", '=HYPERLINK("x")', 1.255, 75.3, "2026-11-02T13:30:00Z"],
    ["2026-11-01", "-cmd", 0, 10, null],
    ["2026-10-31", "=1+1", 0, 0, null],
  ],
  totales: ["Total", null, 1.255, 85.3, null],
  avisos: [],
};

describe("hojaExcel", () => {
  const hoja = hojaExcel(tabla);
  it("encabezado, filas y totales", () => {
    expect(hoja).toHaveLength(5);
    expect(hoja[0]!.map((c) => (c as { value: string }).value)).toEqual([
      "Día",
      "Producto",
      "Kg",
      "Neto",
      "Abierta",
    ]);
  });
  it("el texto va tal cual, como celda de texto y no de fórmula", () => {
    expect(hoja[1]![1]).toMatchObject({ value: '=HYPERLINK("x")', type: String });
    expect(hoja[2]![1]).toMatchObject({ value: "-cmd", type: String });
    expect(hoja[1]![3]).toMatchObject({ value: 75.3, type: Number, format: "#,##0.00" });
    expect(hoja[1]![2]).toMatchObject({ value: 1.255, format: "0.000" });
  });
  it("la fila de totales va en negrita y 'Total' no se trata como fecha", () => {
    expect(hoja[4]![0]).toMatchObject({ value: "Total", type: String, fontWeight: "bold" });
    expect(hoja[4]![3]).toMatchObject({ value: 85.3, fontWeight: "bold" });
  });
  it("celdas vacías quedan vacías", () => {
    expect(hoja[2]![4]).toBeNull();
  });
  it("se escribe y se lee de vuelta con tipos: número, fecha y hora de Bolivia", async () => {
    const blob = await writeExcelFile(hoja as never).toBlob();
    const filas = (await readSheet(blob)) as unknown[][];
    // Una fórmula sin valor guardado se leería vacía: que vuelva el texto literal prueba que es una celda de texto.
    expect(filas[1]![1]).toBe('=HYPERLINK("x")');
    expect(filas[2]![1]).toBe("-cmd");
    expect(filas[1]![2]).toBe(1.255);
    expect(filas[1]![3]).toBe(75.3);
    expect((filas[1]![0] as Date).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    // 13:30 UTC = 09:30 en La Paz.
    // El serial de Excel es un decimal: puede quedar a 1 ms.
    expect(
      Math.abs((filas[1]![4] as Date).getTime() - Date.parse("2026-11-02T09:30:00Z")),
    ).toBeLessThan(1000);
    expect(filas[3]![1]).toBe("=1+1");
    expect(filas[4]![0]).toBe("Total");
  });
});
