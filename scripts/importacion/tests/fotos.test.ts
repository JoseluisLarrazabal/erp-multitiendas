import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { detectarTipo, leerFotos, planificarFotos } from "../src/fotos.ts";
import { leerProductos } from "../src/leer.ts";
import { construirPlan } from "../src/plan.ts";
import { crearXlsx, filaProducto, JPEG, PNG, type ImagenAnclada } from "./xlsx.ts";

const dir = mkdtempSync(join(tmpdir(), "fotos-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const basura = Buffer.from("esto no es una imagen");
// JPEG de verdad más relleno: pasa los magic bytes pero supera los 5 MB del bucket.
const enorme = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);

let n = 0;
async function planDe(imagenes: ImagenAnclada[]) {
  const archivo = join(dir, `${n++}.xlsx`);
  await crearXlsx(
    archivo,
    [
      filaProducto({ codigo: "ej-1", nombre: "Ejemplo uno", stock: 1 }), // fila 2: ejemplo
      filaProducto({ codigo: "ej-2", nombre: "Ejemplo dos", stock: 1 }), // fila 3: ejemplo
      filaProducto({ codigo: "001", nombre: "Uno", stock: 1 }), // 4
      filaProducto({ codigo: "002", nombre: "Dos", stock: 1 }), // 5
      filaProducto({ codigo: "003", nombre: "Tres", stock: 1 }), // 6
      filaProducto({ codigo: "004", nombre: "Cuatro", stock: "1,5" }), // 7: rechazada (decimal)
      ["598"], // 8: fila suelta, excluida
      filaProducto({ codigo: "005", nombre: "Cinco", stock: 1 }), // 9
      filaProducto({ codigo: "006", nombre: "Seis", stock: 1 }), // 10
      filaProducto({ codigo: "007", nombre: "Siete", stock: 1 }), // 11
    ],
    imagenes,
  );
  const leidas = await leerFotos(archivo);
  return { leidas, fotos: planificarFotos(construirPlan(await leerProductos(archivo)), leidas) };
}

describe("detectarTipo", () => {
  it("reconoce JPEG, PNG y WebP por los primeros bytes", () => {
    expect(detectarTipo(JPEG)?.ext).toBe("jpg");
    expect(detectarTipo(PNG)?.ext).toBe("png");
    expect(detectarTipo(WEBP)?.ext).toBe("webp");
    expect(detectarTipo(basura)).toBeNull();
    expect(detectarTipo(Buffer.from("<svg"))).toBeNull();
  });
});

describe("fotos de la planilla", () => {
  it("asocia cada ancla a la fila de su producto; una imagen compartida sirve a dos filas", async () => {
    const { leidas, fotos } = await planDe([
      { fila: 4, columna: 1, datos: JPEG },
      { fila: 5, columna: 1, datos: JPEG },
      { fila: 6, columna: 1, datos: PNG },
    ]);
    expect(leidas.anclas).toHaveLength(3);
    expect(leidas.imagenes.size).toBe(2); // 3 anclas, 2 imágenes únicas
    expect(fotos.anclas).toBe(3);
    expect(fotos.asociadas.map((a) => [a.fila, a.codigo, a.tipo.ext])).toEqual([
      [4, "001", "jpg"],
      [5, "002", "jpg"],
      [6, "003", "png"],
    ]);
    expect(fotos.asociadas[0]?.imagen).toBe(fotos.asociadas[1]?.imagen);
    expect(fotos.avisos).toEqual([]);
    expect(fotos.rechazadas).toEqual([]);
  });

  it("avisa, sin asociar, las anclas en fila excluida, rechazada o sin producto", async () => {
    const { fotos } = await planDe([
      { fila: 3, columna: 1, datos: JPEG }, // ejemplo
      { fila: 7, columna: 1, datos: JPEG }, // rechazada
      { fila: 8, columna: 1, datos: JPEG }, // suelta
      { fila: 40, columna: 1, datos: JPEG }, // sin producto
    ]);
    expect(fotos.asociadas).toEqual([]);
    expect(fotos.avisos).toEqual([
      { fila: 3, regla: "foto_fila_excluida" },
      { fila: 7, regla: "foto_fila_rechazada" },
      { fila: 8, regla: "foto_fila_excluida" },
      { fila: 40, regla: "foto_fila_sin_producto" },
    ]);
  });

  it("con dos anclas en la fila gana la de columna menor y avisa de la otra", async () => {
    const { fotos } = await planDe([
      { fila: 6, columna: 3, datos: JPEG },
      { fila: 6, columna: 1, datos: PNG },
    ]);
    expect(fotos.asociadas.map((a) => [a.fila, a.tipo.ext])).toEqual([[6, "png"]]);
    expect(fotos.avisos).toEqual([{ fila: 6, regla: "foto_varias_en_fila" }]);
  });

  it("con varias anclas gana la primera válida; si ninguna lo es, rechaza con el motivo de la primera", async () => {
    const { fotos } = await planDe([
      { fila: 9, columna: 1, datos: basura },
      { fila: 9, columna: 2, datos: PNG },
      { fila: 10, columna: 1, datos: enorme },
      { fila: 10, columna: 2, datos: basura },
    ]);
    expect(fotos.asociadas.map((a) => [a.fila, a.tipo.ext])).toEqual([[9, "png"]]);
    expect(fotos.avisos).toEqual([
      { fila: 9, regla: "foto_varias_en_fila" },
      { fila: 10, regla: "foto_varias_en_fila" },
    ]);
    expect(fotos.rechazadas).toEqual([{ fila: 10, regla: "foto_muy_grande" }]);
  });

  it("un ancla sin datos de imagen se cuenta y se rechaza como foto_sin_datos", async () => {
    const { leidas } = await planDe([{ fila: 9, columna: 1, datos: JPEG }]);
    const sinDatos = { anclas: leidas.anclas, imagenes: new Map() };
    const plan = construirPlan(await leerProductos(join(dir, `${n - 1}.xlsx`)));
    const fotos = planificarFotos(plan, sinDatos);
    expect(fotos.anclas).toBe(1);
    expect(fotos.rechazadas).toEqual([{ fila: 9, regla: "foto_sin_datos" }]);
  });

  it("rechaza tipo inválido y tamaño mayor a 5 MB, y acepta WebP", async () => {
    const { fotos } = await planDe([
      { fila: 9, columna: 1, datos: basura },
      { fila: 10, columna: 1, datos: enorme },
      { fila: 11, columna: 1, datos: WEBP },
    ]);
    expect(fotos.rechazadas).toEqual([
      { fila: 9, regla: "foto_tipo_invalido" },
      { fila: 10, regla: "foto_muy_grande" },
    ]);
    expect(fotos.asociadas.map((a) => [a.fila, a.tipo.ext])).toEqual([[11, "webp"]]);
  });

  it("un libro sin imágenes da cero anclas", async () => {
    const { fotos } = await planDe([]);
    expect(fotos).toEqual({ anclas: 0, asociadas: [], avisos: [], rechazadas: [] });
  });
});
