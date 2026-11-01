import { describe, expect, it } from "vitest";
import { formatearBs } from "./moneda";

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

  it("rechaza valores no finitos", () => {
    expect(() => formatearBs(NaN)).toThrow(RangeError);
    expect(() => formatearBs(Infinity)).toThrow(RangeError);
  });
});
