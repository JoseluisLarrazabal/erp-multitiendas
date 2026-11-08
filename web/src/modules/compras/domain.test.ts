import { describe, expect, it } from "vitest";
import { lineaCentavos, parsearDecimal, totalCentavos } from "./domain";

describe("parsearDecimal", () => {
  it("escala por los decimales y acepta coma o punto", () => {
    expect(parsearDecimal("12,5", 3, 9)).toBe(12500n);
    expect(parsearDecimal("0.125", 3, 9)).toBe(125n);
    expect(parsearDecimal("7", 4, 8)).toBe(70000n);
  });
  it("rechaza vacío, negativo, exceso de decimales y de enteros", () => {
    for (const t of ["", "-1", "1,2345", "abc", "1e3", "1234567890"])
      expect(parsearDecimal(t, 3, 9)).toBeNull();
  });
});

describe("lineaCentavos", () => {
  it("redondea cantidad × costo a centavos, mitad hacia arriba (igual que la RPC)", () => {
    expect(lineaCentavos("10", "7")).toBe(7000);
    expect(lineaCentavos("1,5", "2,5")).toBe(375);
    expect(lineaCentavos("1", "0,0600")).toBe(6);
    expect(lineaCentavos("1", "0,005")).toBe(1);
    expect(lineaCentavos("1", "0,0049")).toBe(0);
  });
  it("es exacta con importes grandes", () => {
    expect(lineaCentavos("123456,789", "98765,4321")).toBe(1219326311126);
  });
  it("null si algún valor es inválido", () => {
    expect(lineaCentavos("", "1")).toBeNull();
    expect(lineaCentavos("1", "x")).toBeNull();
  });
});

describe("totalCentavos", () => {
  it("suma las líneas ya redondeadas", () => {
    expect(
      totalCentavos([
        { cantidad: "1,5", costo: "2,5" },
        { cantidad: "1", costo: "0,06" },
      ]),
    ).toBe(381);
  });
  it("null si una línea es inválida", () => {
    expect(totalCentavos([{ cantidad: "1", costo: "" }])).toBeNull();
  });
});
