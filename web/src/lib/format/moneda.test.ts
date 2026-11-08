import { describe, expect, it } from "vitest";
import { formatearBs, parsearMonto } from "./moneda";

describe("formatearBs", () => {
  it("formatea cero", () => {
    expect(formatearBs(0)).toBe("Bs 0,00");
  });

  it("completa los centavos", () => {
    expect(formatearBs(19.99)).toBe("Bs 19,99");
    expect(formatearBs(0.05)).toBe("Bs 0,05");
    expect(formatearBs(150)).toBe("Bs 150,00");
  });

  it("separa miles con punto y decimales con coma", () => {
    expect(formatearBs(1234.5)).toBe("Bs 1.234,50");
    expect(formatearBs(1234567.89)).toBe("Bs 1.234.567,89");
  });

  it("formatea negativos", () => {
    expect(formatearBs(-1234.5)).toBe("-Bs 1.234,50");
    expect(formatearBs(-0.05)).toBe("-Bs 0,05");
  });

  it("no se rompe con flotantes binarios", () => {
    expect(formatearBs(1.1 + 2.2)).toBe("Bs 3,30");
  });

  it("valores no finitos muestran un guion en vez de romper el render", () => {
    expect(formatearBs(NaN)).toBe("—");
    expect(formatearBs(Infinity)).toBe("—");
    expect(formatearBs(-Infinity)).toBe("—");
  });
});

describe("parsearMonto", () => {
  it("devuelve la escala pedida", () => {
    expect(parsearMonto("12,5")).toBe(1250);
    expect(parsearMonto("6,9612", 4)).toBe(69612);
  });
  it("tope de 10 enteros (numeric(12,2))", () => {
    expect(parsearMonto("9999999999,99")).toBe(999_999_999_999);
    expect(parsearMonto("10000000000")).toBeNull();
    expect(parsearMonto("1".repeat(20))).toBeNull();
  });
  it("la coma es siempre decimal; punto con 3 dígitos es ambiguo", () => {
    expect(parsearMonto("6,965", 4)).toBe(69650);
    expect(parsearMonto("0,125", 4)).toBe(1250);
    expect(parsearMonto("0.125", 4)).toBeNull();
    expect(parsearMonto("1.234", 4)).toBeNull();
    expect(parsearMonto("12,50")).toBe(1250);
    expect(parsearMonto("0,125")).toBeNull();
    expect(parsearMonto("0.125")).toBeNull();
  });
});
