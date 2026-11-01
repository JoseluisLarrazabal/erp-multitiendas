import { describe, expect, it } from "vitest";
import type { FilaPrecios, Lista } from "./domain";
import {
  borradorBase,
  bsDeUsd,
  cambiosDeFila,
  celdasInvalidas,
  mensajeDeGuardado,
  mensajeDeMontoInvalido,
} from "./grilla";

const LISTAS: Lista[] = ["contado", "credito", "mayorista", "minimo"];
const fila: FilaPrecios = {
  id: "1",
  codigo: "A",
  nombre: "A",
  tipo: "producto",
  moneda: "USD",
  precios: { contado: 200, credito: 12.5 },
  costo: 150,
  costoVaria: false,
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
    b.costo = "0,5x";
    expect(celdasInvalidas(fila, b, LISTAS)).toEqual(["contado", "minimo", "costo"]);
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

describe("celdasInvalidas: solo las celdas cambiadas", () => {
  it("el costo 0 es válido; el precio 0 no", () => {
    const b = borradorBase(fila, LISTAS);
    b.costo = "0";
    b.precios.mayorista = "0";
    expect(celdasInvalidas(fila, b, LISTAS)).toEqual(["mayorista"]);
  });
  it("0 en una celda vacía cuenta como cambio y se valida", () => {
    const sin: FilaPrecios = { ...fila, moneda: null, precios: {}, costo: null };
    const b = borradorBase(sin, LISTAS);
    b.precios.contado = "0";
    b.precios.credito = "abc";
    b.costo = "abc";
    expect(cambiosDeFila(sin, b, LISTAS)).toEqual({ precios: true, costo: true });
    expect(celdasInvalidas(sin, b, LISTAS)).toEqual(["contado", "credito", "costo"]);
  });
  it("lo que no se tocó no se valida", () => {
    const raro: FilaPrecios = { ...fila, precios: { contado: 12.345 } };
    expect(celdasInvalidas(raro, borradorBase(raro, LISTAS), LISTAS)).toEqual([]);
  });
  it("costo 1.500 se rechaza por el punto de miles", () => {
    const b = borradorBase(fila, LISTAS);
    b.costo = "1.500";
    expect(celdasInvalidas(fila, b, LISTAS)).toEqual(["costo"]);
    expect(mensajeDeMontoInvalido("1.500")).toMatch(/sin puntos de miles/);
    expect(mensajeDeMontoInvalido("abc")).toBe("Monto inválido");
  });
});

describe("costo que varía por ubicación", () => {
  const varia: FilaPrecios = { ...fila, costo: null, costoVaria: true };
  it("la celda arranca vacía y sin cambio; escribir un costo es un cambio", () => {
    const b = borradorBase(varia, LISTAS);
    expect(b.costo).toBe("");
    expect(cambiosDeFila(varia, b, LISTAS).costo).toBe(false);
    b.costo = "8";
    expect(cambiosDeFila(varia, b, LISTAS).costo).toBe(true);
  });
});

describe("mensajeDeGuardado", () => {
  const costo = { productoId: "1", error: "x", campos: ["costo" as const] };
  it("sin fallas", () => {
    expect(mensajeDeGuardado(1, [], true)).toBe("Se guardaron 1 fila.");
    expect(mensajeDeGuardado(3, [], true)).toBe("Se guardaron 3 filas.");
  });
  it("precios guardados y costos fallidos se distinguen", () => {
    expect(mensajeDeGuardado(0, [costo, { ...costo, productoId: "2" }], true)).toMatch(
      /^Precios guardados\. 2 costos no se guardaron/,
    );
  });
  it("sin precios enviados o con precios fallidos, mensaje general", () => {
    expect(mensajeDeGuardado(0, [costo], false)).toMatch(/No se guardaron 1 costo:/);
    const precios = { productoId: "3", error: "x", campos: ["precios" as const] };
    expect(mensajeDeGuardado(2, [precios, costo], true)).toMatch(
      /Se guardaron 2 filas\. No se guardaron 1 precio y 1 costo/,
    );
  });
});
