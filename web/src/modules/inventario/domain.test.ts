import { describe, expect, it } from "vitest";
import {
  formatearCantidad,
  formatearCantidadConSigno,
  formatearCostoUnitario,
  formatearFechaHora,
  hrefStock,
  parsearCantidad,
  textoDias,
  valorDeStock,
} from "./domain";

describe("formatearCantidad", () => {
  it("unidad: entera, con puntos de miles", () => {
    expect(formatearCantidad(5)).toBe("5");
    expect(formatearCantidad(1234)).toBe("1.234");
  });
  it("kg: hasta 3 decimales con coma, sin ceros de más", () => {
    expect(formatearCantidad(35.25, "kg")).toBe("35,25");
    expect(formatearCantidad(2, "kg")).toBe("2");
    expect(formatearCantidad(1234.5, "kg")).toBe("1.234,5");
    expect(formatearCantidad(0.005, "kg")).toBe("0,005");
  });
  it("negativo con menos tipográfico; cero nunca lleva signo", () => {
    expect(formatearCantidad(-3)).toBe("−3");
    expect(formatearCantidad(-0.0001, "kg")).toBe("0");
  });
  it("con signo explícito en lo positivo", () => {
    expect(formatearCantidadConSigno(2)).toBe("+2");
    expect(formatearCantidadConSigno(-2)).toBe("−2");
    expect(formatearCantidadConSigno(0)).toBe("0");
  });
});

describe("parsearCantidad", () => {
  it("unidad: solo enteros mayores a 0", () => {
    expect(parsearCantidad("5", "unidad")).toBe(5);
    expect(parsearCantidad("2,5", "unidad")).toBeNull();
    expect(parsearCantidad("0", "unidad")).toBeNull();
    expect(parsearCantidad("-1", "unidad")).toBeNull();
  });
  it("kg: coma o punto, hasta 3 decimales; no adivina miles", () => {
    expect(parsearCantidad("2,5", "kg")).toBe(2.5);
    expect(parsearCantidad("2.5", "kg")).toBe(2.5);
    expect(parsearCantidad("1,2345", "kg")).toBeNull();
    expect(parsearCantidad("1.500", "kg")).toBeNull();
  });
  it("con signo y con cero", () => {
    expect(parsearCantidad("-2", "unidad", { conSigno: true })).toBe(-2);
    expect(parsearCantidad("−2", "unidad", { conSigno: true })).toBe(-2);
    expect(parsearCantidad("+2", "unidad", { conSigno: true })).toBe(2);
    expect(parsearCantidad("0", "unidad", { conSigno: true })).toBeNull();
    expect(parsearCantidad("0", "unidad", { admiteCero: true })).toBe(0);
    expect(parsearCantidad("abc", "kg")).toBeNull();
  });
});

describe("formatearCostoUnitario", () => {
  it("mínimo 2 decimales, hasta 4", () => {
    expect(formatearCostoUnitario(12.5)).toBe("Bs 12,50");
    expect(formatearCostoUnitario(1200)).toBe("Bs 1.200,00");
    expect(formatearCostoUnitario(0.1234)).toBe("Bs 0,1234");
  });
});

describe("formatearFechaHora", () => {
  it("dd/mm/aaaa hh:mm en hora de Bolivia (UTC-4)", () => {
    expect(formatearFechaHora("2026-11-01T03:30:00Z")).toBe("31/10/2026 23:30");
  });
});

describe("valorDeStock", () => {
  it("suma cantidad por costo de las ubicaciones con stock y costo", () => {
    expect(
      valorDeStock([
        { cantidad: 2, costo: 10 },
        { cantidad: 3, costo: 5 },
      ]),
    ).toBe(35);
  });
  it("negativo y filas en 0 no cuentan; sin costo conocido es null", () => {
    expect(
      valorDeStock([
        { cantidad: -4, costo: 10 },
        { cantidad: 0, costo: 10 },
      ]),
    ).toBeNull();
    expect(valorDeStock([{ cantidad: 4, costo: null }])).toBeNull();
    expect(valorDeStock([])).toBeNull();
  });
});

describe("hrefStock", () => {
  it("omite lo vacío", () => {
    expect(hrefStock({})).toBe("/panel/inventario");
    expect(hrefStock({ q: "a b", bajo: true, pagina: 2 })).toBe(
      "/panel/inventario?q=a+b&bajo=1&pagina=2",
    );
    expect(hrefStock({ pagina: 1 })).toBe("/panel/inventario");
  });
});

describe("textoDias", () => {
  it("vencido, hoy y por vencer, en singular y plural", () => {
    expect(textoDias(-1)).toBe("Vencido hace 1\u00a0día");
    expect(textoDias(-3)).toBe("Vencido hace 3\u00a0días");
    expect(textoDias(0)).toBe("Vence hoy");
    expect(textoDias(1)).toBe("En 1\u00a0día");
    expect(textoDias(5)).toBe("En 5\u00a0días");
  });
});
