import { describe, expect, it } from "vitest";
import { parsearMontoInicial, parsearMontoPositivo, textoTardias } from "./domain";

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

describe("textoTardias", () => {
  it("nombra solo lo que llegó, con singular y plural", () => {
    expect(textoTardias(2, 50, 0)).toMatch(
      /^Después del cierre llegaron 2 ventas sin conexión por .*50,00\. El arqueo del cierre no cambia\.$/,
    );
    expect(textoTardias(1, 10, 0)).toContain("llegaron 1 venta sin conexión por");
    expect(textoTardias(0, 0, 1)).toBe(
      "Después del cierre llegaron 1 movimiento de caja sin conexión. El arqueo del cierre no cambia.",
    );
    expect(textoTardias(0, 0, 3)).toContain("llegaron 3 movimientos de caja sin conexión.");
    expect(textoTardias(1, 10, 2)).toMatch(
      /1 venta sin conexión por .*10,00 y 2 movimientos de caja\. El arqueo/,
    );
    expect(textoTardias(0, 0, 0)).toContain("hubo cambios");
  });
});
