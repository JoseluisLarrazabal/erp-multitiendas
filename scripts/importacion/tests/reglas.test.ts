import { describe, expect, it } from "vitest";
import {
  categoriasParecidas,
  claveCategoria,
  claveDuplicado,
  digitoEan13Valido,
  esFilaEjemplo,
  esFilaSuelta,
  limpiarCodigo,
  limpiarMarcaModelo,
  limpiarTexto,
  normalizarBarras,
  normalizarUbicacion,
  parsearStock,
} from "../src/reglas.ts";

const texto = (t: string) => ({ texto: t, esNumero: false });
const numero = (n: number) => ({ texto: String(n), esNumero: true });

describe("filas excluidas", () => {
  it("las filas 2 y 3 son ejemplos", () => {
    expect([1, 2, 3, 4].filter(esFilaEjemplo)).toEqual([2, 3]);
  });
  it("un solo valor suelto es fila suelta; con dos valores, no", () => {
    expect(esFilaSuelta(1)).toBe(true);
    expect(esFilaSuelta(2)).toBe(false);
  });
});

describe("textos", () => {
  it("trim y colapso de espacios", () => {
    expect(limpiarTexto("  Taza   azul  grande ")).toBe("Taza azul grande");
  });
  it('marca o modelo "--" queda vacío', () => {
    expect(limpiarMarcaModelo(" -- ")).toBe("");
    expect(limpiarMarcaModelo("Marca  X")).toBe("Marca X");
  });
  it("el código interno se conserva como texto, solo con trim", () => {
    expect(limpiarCodigo(texto(" 007 "))).toBe("007");
    expect(limpiarCodigo(numero(12))).toBe("12");
  });
});

describe("código de barras", () => {
  it("vacío queda sin código", () => {
    expect(normalizarBarras(texto(" "), "").barras).toBeNull();
  });
  it("dígitos con espacios se tratan como numérico", () => {
    const r = normalizarBarras(texto("750 123 0456"), "");
    expect(r).toMatchObject({ barras: "7501230456", modelo: "", correcciones: ["barras_espacios"] });
    expect(normalizarBarras(texto("aro 20"), "").barras).toBeNull();
  });
  it("conserva los ceros iniciales", () => {
    expect(normalizarBarras(texto("0012345"), "").barras).toBe("0012345");
  });
  it("código corto se conserva", () => {
    expect(normalizarBarras(texto("25"), "").barras).toBe("25");
  });
  it("notación científica en texto se rechaza, queda vacío con aviso", () => {
    const r = normalizarBarras(texto("7.75E+12"), "");
    expect(r.barras).toBeNull();
    expect(r.avisos).toEqual(["barras_notacion_cientifica"]);
  });
  it("número de celda de 13 dígitos se rechaza (se muestra en notación científica)", () => {
    const r = normalizarBarras(numero(7750000000000), "");
    expect(r.barras).toBeNull();
    expect(r.avisos).toEqual(["barras_notacion_cientifica"]);
  });
  it("número de celda corto se conserva con aviso", () => {
    const r = normalizarBarras(numero(4321), "");
    expect(r.barras).toBe("4321");
    expect(r.avisos).toEqual(["barras_numerico"]);
  });
  it("alfanumérico de una palabra con dígito se conserva con aviso", () => {
    expect(normalizarBarras(texto("ab12cd"), "M-1")).toMatchObject({
      barras: "ab12cd",
      avisos: ["barras_alfanumerico"],
    });
  });
  it("texto con espacios o símbolos va a modelo si está vacío", () => {
    const r = normalizarBarras(texto("aro  20/29"), "");
    expect(r).toMatchObject({
      barras: null,
      modelo: "aro 20/29",
      correcciones: ["barras_a_modelo"],
    });
  });
  it("texto no numérico con modelo ocupado se descarta con aviso", () => {
    const r = normalizarBarras(texto("aro 20/29"), "M-1");
    expect(r).toMatchObject({
      barras: null,
      modelo: "M-1",
      avisos: ["barras_no_numerico_descartado"],
    });
  });
  it("EAN-13 con dígito verificador inválido: aviso y se conserva", () => {
    expect(digitoEan13Valido("4006381333931")).toBe(true);
    expect(digitoEan13Valido("4006381333932")).toBe(false);
    const r = normalizarBarras(texto("4006381333932"), "");
    expect(r).toMatchObject({ barras: "4006381333932", avisos: ["ean13_digito_invalido"] });
  });
  it("EAN-13 válido no avisa", () => {
    expect(normalizarBarras(texto("4006381333931"), "").avisos).toEqual([]);
  });
});

describe("ubicación", () => {
  it("reconoce tienda y depósito sin mayúsculas ni tilde", () => {
    expect(normalizarUbicacion("TIENDA")).toEqual({ ubicacion: "Tienda" });
    expect(normalizarUbicacion(" Deposito ")).toEqual({ ubicacion: "Depósito" });
    expect(normalizarUbicacion("Depósito")).toEqual({ ubicacion: "Depósito" });
  });
  it("vacía: Tienda con aviso", () => {
    expect(normalizarUbicacion("")).toEqual({ ubicacion: "Tienda", aviso: "sin_ubicacion" });
  });
  it("desconocida: Tienda con aviso aparte", () => {
    expect(normalizarUbicacion("bodega-2")).toEqual({
      ubicacion: "Tienda",
      aviso: "ubicacion_desconocida",
    });
  });
});

describe("stock", () => {
  it("entero >= 0", () => {
    expect(parsearStock("12")).toEqual({ ok: true, valor: 12 });
    expect(parsearStock("0")).toEqual({ ok: true, valor: 0 });
  });
  it("vacío es 0", () => {
    expect(parsearStock("  ")).toEqual({ ok: true, valor: 0 });
  });
  it("decimal se rechaza y devuelve su valor", () => {
    expect(parsearStock("1,5")).toEqual({ ok: false, motivo: "stock_decimal", valor: 1.5 });
    expect(parsearStock("2.5")).toEqual({ ok: false, motivo: "stock_decimal", valor: 2.5 });
  });
  it("separador de miles ambiguo se rechaza", () => {
    for (const t of ["1.000", "2,000", "12.345", "1.234.567", "0.500"])
      expect(parsearStock(t)).toEqual({ ok: false, motivo: "stock_ambiguo" });
  });
  it("lo que no calza con miles sigue su camino", () => {
    expect(parsearStock("1000")).toEqual({ ok: true, valor: 1000 });
    expect(parsearStock("1.50")).toMatchObject({ motivo: "stock_decimal" });
    expect(parsearStock("1.0000")).toMatchObject({ ok: true, valor: 1 });
  });
  it("negativo o no numérico se rechaza", () => {
    expect(parsearStock("-3")).toEqual({ ok: false, motivo: "stock_invalido" });
    expect(parsearStock("diez")).toEqual({ ok: false, motivo: "stock_invalido" });
  });
});

describe("categorías y duplicados", () => {
  it("la unión de categorías no distingue mayúsculas", () => {
    expect(claveCategoria(" Vasos  de vidrio ")).toBe(claveCategoria("vasos de VIDRIO"));
  });
  it("detecta parecidas sin unirlas", () => {
    const pares = categoriasParecidas([
      "Ollas",
      "Ollas grandes",
      "Utensilios",
      "Utencilios",
      "Vasos",
    ]);
    expect(pares).toEqual([
      ["Ollas", "Ollas grandes"],
      ["Utensilios", "Utencilios"],
    ]);
  });
  it("la clave de posible duplicado ignora mayúsculas, acentos y espacios", () => {
    expect(claveDuplicado("Taza  Azul", "Acme", "")).toBe(claveDuplicado("taza azul", "ACME", ""));
    expect(claveDuplicado("Taza", "Acme", "A")).not.toBe(claveDuplicado("Taza", "Acme", "B"));
  });
});
