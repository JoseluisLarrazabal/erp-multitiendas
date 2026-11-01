import { describe, expect, it } from "vitest";
import type { FilaPrecios, Lista } from "./domain";
import { borradorBase, bsDeUsd, cambiosDeFila, celdasInvalidas } from "./grilla";

const LISTAS: Lista[] = ["contado", "credito", "mayorista", "minimo"];
const fila: FilaPrecios = {
  id: "1",
  codigo: "A",
  nombre: "A",
  tipo: "producto",
  moneda: "USD",
  precios: { contado: 200, credito: 12.5 },
  costo: 150,
};

describe("cambiosDeFila", () => {
  it("sin tocar nada no hay cambios", () => {
    expect(cambiosDeFila(fila, borradorBase(fila, LISTAS), LISTAS)).toEqual({
      precios: false,
      costo: false,
    });
  });
  it("12,50 y 12,5 son el mismo monto", () => {
    const b = borradorBase(fila, LISTAS);
    b.precios.credito = "12,50";
    expect(cambiosDeFila(fila, b, LISTAS).precios).toBe(false);
  });
  it("llenar una lista vacía, o vaciar una llena, cambia los precios", () => {
    const b = borradorBase(fila, LISTAS);
    b.precios.mayorista = "10";
    expect(cambiosDeFila(fila, b, LISTAS).precios).toBe(true);
    const c = borradorBase(fila, LISTAS);
    c.precios.contado = "";
    expect(cambiosDeFila(fila, c, LISTAS).precios).toBe(true);
  });
  it("cambiar la moneda de una fila con precios cambia los precios; sin precios no", () => {
    const b = { ...borradorBase(fila, LISTAS), moneda: "BOB" as const };
    expect(cambiosDeFila(fila, b, LISTAS).precios).toBe(true);
    const sin: FilaPrecios = { ...fila, moneda: null, precios: {}, costo: null };
    expect(
      cambiosDeFila(sin, { ...borradorBase(sin, LISTAS), moneda: "USD" }, LISTAS).precios,
    ).toBe(false);
  });
  it("el costo cambia solo si se escribió algo distinto; en blanco se ignora", () => {
    const b = borradorBase(fila, LISTAS);
    b.costo = "151";
    expect(cambiosDeFila(fila, b, LISTAS).costo).toBe(true);
    b.costo = "";
    expect(cambiosDeFila(fila, b, LISTAS).costo).toBe(false);
  });
});

describe("celdasInvalidas", () => {
  it("señala montos mal escritos y acepta vacíos", () => {
    const b = borradorBase(fila, LISTAS);
    b.precios.contado = "abc";
    b.precios.minimo = "1,234";
    b.precios.mayorista = "";
    b.costo = "0";
    expect(celdasInvalidas(b, LISTAS)).toEqual(["contado", "minimo", "costo"]);
  });
});

describe("bsDeUsd", () => {
  it("redondea a 2 decimales como Postgres", () => {
    expect(bsDeUsd("200", 6.96)).toBe(1392);
    expect(bsDeUsd("0,05", 6.96)).toBe(0.35);
    expect(bsDeUsd("1,01", 6.965)).toBe(7.03);
  });
  it("sin tipo de cambio o monto inválido, null", () => {
    expect(bsDeUsd("200", null)).toBeNull();
    expect(bsDeUsd("x", 6.96)).toBeNull();
  });
});
