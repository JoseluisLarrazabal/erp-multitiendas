import { describe, expect, it } from "vitest";
import { parsearMontoInicial, parsearMontoPositivo } from "./domain";

describe("parsearMontoInicial", () => {
  it("vacío es cero; acepta coma y punto; rechaza el resto", () => {
    expect(parsearMontoInicial("")).toBe(0);
    expect(parsearMontoInicial("100,5")).toBe(10050);
    expect(parsearMontoInicial("100.25")).toBe(10025);
    expect(parsearMontoInicial("1,234")).toBeNull();
    expect(parsearMontoInicial("-5")).toBeNull();
    expect(parsearMontoInicial("abc")).toBeNull();
    expect(parsearMontoInicial("9999999,99")).toBe(999_999_999);
    expect(parsearMontoInicial("10000000")).toBeNull();
  });
});

describe("parsearMontoPositivo", () => {
  it("exige monto mayor a cero", () => {
    expect(parsearMontoPositivo("")).toBeNull();
    expect(parsearMontoPositivo("0")).toBeNull();
    expect(parsearMontoPositivo("0,00")).toBeNull();
    expect(parsearMontoPositivo("25,5")).toBe(2550);
    expect(parsearMontoPositivo("-1")).toBeNull();
    expect(parsearMontoPositivo("9999999,99")).toBe(999_999_999);
    expect(parsearMontoPositivo("10000000")).toBeNull();
  });
});
