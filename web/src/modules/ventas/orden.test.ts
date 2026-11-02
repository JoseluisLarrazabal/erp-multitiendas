import { describe, expect, it } from "vitest";
import { armarOrden, fichaInicial, hoyLaPaz, sumarDias, type FichaTexto } from "./orden";

const ficha = (c: Partial<FichaTexto> = {}): FichaTexto => ({
  ...fichaInicial(new Date("2026-11-03T12:00:00Z")),
  prendas: "3",
  ...c,
});
const base = { express: true, conCliente: true, hoy: "2026-11-03" };

describe("fechas de la orden", () => {
  it("hoy se cuenta en La Paz, no en UTC", () => {
    expect(hoyLaPaz(new Date("2026-11-04T02:00:00Z"))).toBe("2026-11-03");
    expect(hoyLaPaz(new Date("2026-11-04T05:00:00Z"))).toBe("2026-11-04");
  });
  it("suma días cruzando mes y año", () => {
    expect(sumarDias("2026-12-31", 2)).toBe("2027-01-02");
  });
  it("la fecha inicial es hoy + 2", () => {
    expect(fichaInicial(new Date("2026-11-03T12:00:00Z")).fecha).toBe("2026-11-05");
  });
});

describe("armarOrden", () => {
  it("con cliente no manda nombre ni teléfono y omite los vacíos", () => {
    const r = armarOrden(ficha({ nombre: "X", telefono: "1" }), base);
    expect(r).toEqual({
      ok: true,
      orden: { express: true, prendas: 3, fecha_prometida: "2026-11-05" },
    });
    // Claves ausentes, no undefined: la cola guarda el payload como JSON.
    expect(Object.keys((r as { orden: object }).orden).sort()).toEqual([
      "express",
      "fecha_prometida",
      "prendas",
    ]);
  });
  it("sin cliente exige nombre y manda el teléfono recortado", () => {
    expect(armarOrden(ficha(), { ...base, conCliente: false })).toMatchObject({ ok: false });
    const r = armarOrden(ficha({ nombre: " Ana ", telefono: " 700 ", casillero: " A1 " }), {
      ...base,
      conCliente: false,
    });
    expect(r).toMatchObject({
      ok: true,
      orden: { cliente_nombre: "Ana", cliente_telefono: "700", casillero: "A1" },
    });
  });
  it.each(["", "0", "1000", "2,5", "abc"])("rechaza prendas %j", (prendas) => {
    expect(armarOrden(ficha({ prendas }), base).ok).toBe(false);
  });
  it("rechaza fecha anterior a hoy y largos pasados", () => {
    expect(armarOrden(ficha({ fecha: "2026-11-02" }), base).ok).toBe(false);
    expect(armarOrden(ficha({ casillero: "x".repeat(21) }), base).ok).toBe(false);
    expect(armarOrden(ficha({ nota: "x".repeat(501) }), base).ok).toBe(false);
  });
});
