import { describe, expect, it } from "vitest";
import { lineaCentavos, mensajeDeCompras, parsearDecimal, totalCentavos } from "./domain";

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

describe("mensajeDeCompras", () => {
  it("traduce los códigos propios de compras", () => {
    expect(mensajeDeCompras("ERP_OPERACION_REPETIDA")).toContain("recarga la página");
    expect(mensajeDeCompras("ERP_PAGO_EXCEDE_DEUDA")).toContain("proveedor");
    expect(mensajeDeCompras("ERP_SIN_PERMISO")).toContain("compras");
    expect(mensajeDeCompras("ERP_DATOS_INVALIDOS")).toBeDefined();
  });
  it("traduce los códigos de los reversos con una salida clara", () => {
    expect(mensajeDeCompras("ERP_PAGO_NO_ES_ULTIMO")).toContain("último pago");
    expect(mensajeDeCompras("ERP_PAGO_AUTOMATICO")).toContain("anulando la compra");
    expect(mensajeDeCompras("ERP_COMPRA_CON_SERIES")).toContain("serie");
    expect(mensajeDeCompras("ERP_COMPRA_CON_PAGOS")).toContain("pagos");
    expect(mensajeDeCompras("ERP_STOCK_INSUFICIENTE")).toContain("stock");
  });
  it("deja pasar lo que no es suyo", () => {
    expect(mensajeDeCompras("ERP_INTERNO")).toBeUndefined();
    expect(mensajeDeCompras(undefined)).toBeUndefined();
  });
});
