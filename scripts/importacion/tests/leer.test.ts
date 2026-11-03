import fs, { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { leerProductos } from "../src/leer.ts";
import { crearXlsx, filaProducto } from "./xlsx.ts";

const dir = mkdtempSync(join(tmpdir(), "importacion-leer-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("leerProductos", () => {
  it("lee texto como texto, marca los números y salta filas vacías", async () => {
    const ruta = join(dir, "a.xlsx");
    await crearXlsx(ruta, [
      filaProducto({ codigo: "007", barras: "00123", nombre: "Uno", stock: 3 }),
      [],
      filaProducto({ codigo: "8", barras: 7750000000000, nombre: "Dos" }),
      ["598"],
    ]);
    const filas = await leerProductos(ruta);
    expect(filas.map((f) => f.fila)).toEqual([2, 4, 5]);
    expect(filas[0]?.celdas.codigo).toEqual({ texto: "007", esNumero: false });
    expect(filas[0]?.celdas.barras).toEqual({ texto: "00123", esNumero: false });
    expect(filas[0]?.celdas.stock).toEqual({ texto: "3", esNumero: true });
    expect(filas[1]?.celdas.barras.esNumero).toBe(true);
    expect(filas[2]?.valores).toBe(1);
  });

  it("falla si falta una columna", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Productos").addRow(["Código interno"]);
    const ruta = join(dir, "b.xlsx");
    await libro.xlsx.writeFile(ruta);
    await expect(leerProductos(ruta)).rejects.toThrow(/Faltan columnas/);
  });

  // exceljs bufferea cada hoja en un tmp y lo borra al pasar a la siguiente; si la hoja ajena no se consume, el borrado
  // le gana a la apertura diferida del stream (aquí forzada con un retraso) y salta un ENOENT no capturado.
  it("no deja un archivo temporal huérfano ni un ENOENT no capturado al saltar la hoja ajena", async () => {
    const ruta = join(dir, "c.xlsx");
    await crearXlsx(ruta, [filaProducto({ codigo: "1", nombre: "Uno", stock: 1 })]);
    const abrir = fs.open;
    const errores: unknown[] = [];
    const capturar = (e: unknown) => errores.push(e);
    process.on("uncaughtException", capturar);
    // @ts-expect-error retrasa solo la apertura de lectura de los tmp de exceljs
    fs.open = (p: unknown, f: unknown, ...a: unknown[]) =>
      String(p).includes("/tmp-") && f === "r" ? void setTimeout(() => abrir(p as never, f as never, ...(a as [])), 50) : abrir(p as never, f as never, ...(a as []));
    try {
      expect(await leerProductos(ruta)).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 200));
    } finally {
      fs.open = abrir;
      process.off("uncaughtException", capturar);
    }
    expect(errores).toEqual([]);
  });
});
