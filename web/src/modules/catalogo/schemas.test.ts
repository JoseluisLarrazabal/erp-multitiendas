import { describe, expect, it } from "vitest";
import {
  categoriaSchema,
  filaPreciosSchema,
  filtrosSchema,
  guardarGrillaSchema,
  productoSchema,
  tipoCambioSchema,
} from "./schemas";

const ID = "e0000000-0000-0000-0000-000000000001";
const NEG = "a0000000-0000-0000-0000-000000000001";

const producto = {
  negocioId: NEG,
  id: null,
  codigo: " CEL-9 ",
  codigoBarras: " ",
  nombre: "Celular",
  marca: "",
  modelo: "",
  categoriaId: null,
  tipo: "producto",
  unidad: "unidad",
  controlaSerie: false,
  garantiaMeses: "12",
  stockMinimo: "2,5",
};

describe("productoSchema", () => {
  it("recorta, vuelve null lo vacío y convierte números", () => {
    const r = productoSchema.parse(producto);
    expect(r.codigo).toBe("CEL-9");
    expect(r.codigoBarras).toBeNull();
    expect(r.marca).toBeNull();
    expect(r.garantiaMeses).toBe(12);
    expect(r.stockMinimo).toBe(2.5);
  });
  it("rechaza código vacío, tipo o unidad desconocidos y garantía no entera", () => {
    expect(productoSchema.safeParse({ ...producto, codigo: " " }).success).toBe(false);
    expect(productoSchema.safeParse({ ...producto, tipo: "otro" }).success).toBe(false);
    expect(productoSchema.safeParse({ ...producto, unidad: "litro" }).success).toBe(false);
    expect(productoSchema.safeParse({ ...producto, garantiaMeses: "1,5" }).success).toBe(false);
  });
});

describe("categoriaSchema y tipoCambioSchema", () => {
  it("categoría: nombre obligatorio", () => {
    expect(categoriaSchema.safeParse({ negocioId: NEG, id: null, nombre: "  " }).success).toBe(
      false,
    );
    expect(categoriaSchema.parse({ negocioId: NEG, id: null, nombre: " Cables " }).nombre).toBe(
      "Cables",
    );
  });
  it("tipo de cambio: coma o punto, mayor a 0, hasta 4 decimales", () => {
    expect(tipoCambioSchema.parse({ negocioId: NEG, valor: "6,96" }).valor).toBe(6.96);
    for (const valor of ["", "0", "-6", "abc", "6,96123"]) {
      expect(tipoCambioSchema.safeParse({ negocioId: NEG, valor }).success, valor).toBe(false);
    }
  });
});

describe("filaPreciosSchema", () => {
  it("convierte montos y deja null lo vacío (borra la lista)", () => {
    const r = filaPreciosSchema.parse({
      productoId: ID,
      moneda: "USD",
      precios: { contado: "200,5", credito: "" },
    });
    expect(r.precios).toEqual({ contado: 200.5, credito: null });
  });
  it("rechaza monto 0, texto, lista o moneda desconocidas", () => {
    const base = { productoId: ID, moneda: "BOB", precios: {} };
    expect(filaPreciosSchema.safeParse({ ...base, precios: { contado: "0" } }).success).toBe(false);
    expect(filaPreciosSchema.safeParse({ ...base, precios: { contado: "x" } }).success).toBe(false);
    expect(filaPreciosSchema.safeParse({ ...base, precios: { oro: "1" } }).success).toBe(false);
    expect(filaPreciosSchema.safeParse({ ...base, moneda: "EUR" }).success).toBe(false);
  });
});

describe("guardarGrillaSchema", () => {
  const fila = { productoId: ID, precios: null, costo: "12,3456" };
  it("acepta solo costo (4 decimales) y limita a 200 filas", () => {
    expect(guardarGrillaSchema.parse({ negocioId: NEG, filas: [fila] }).filas[0]!.costo).toBe(
      12.3456,
    );
    expect(guardarGrillaSchema.safeParse({ negocioId: NEG, filas: [] }).success).toBe(false);
    expect(
      guardarGrillaSchema.safeParse({ negocioId: NEG, filas: Array(201).fill(fila) }).success,
    ).toBe(false);
  });
});

describe("filtrosSchema", () => {
  it("valores basura caen al valor por defecto", () => {
    expect(filtrosSchema.parse({ pagina: "-4", categoria: "no-es-id", sinPrecio: "si" })).toEqual({
      q: "",
      categoria: "",
      marca: "",
      sinPrecio: false,
      inactivos: false,
      pagina: 1,
    });
    expect(filtrosSchema.parse({ q: " 777 ", sinPrecio: "1", pagina: "3" })).toMatchObject({
      q: "777",
      sinPrecio: true,
      pagina: 3,
    });
  });
});
