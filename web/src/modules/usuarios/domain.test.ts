import { describe, expect, it } from "vitest";
import {
  destinoInicial,
  elegirNegocioActivo,
  tieneAccesoPanel,
  type NegocioUsuario,
} from "./domain";

const a: NegocioUsuario = { negocioId: "a", nombre: "A", tipo: "tienda", rol: "dueno" };
const b: NegocioUsuario = { negocioId: "b", nombre: "B", tipo: "frial", rol: "dueno" };

describe("elegirNegocioActivo", () => {
  it("usa la preferencia si es un negocio del usuario", () => {
    expect(elegirNegocioActivo([a, b], "b")).toBe(b);
  });
  it("cae al primero si la cookie es ajena, vacía o forjada", () => {
    expect(elegirNegocioActivo([a, b], "otro")).toBe(a);
    expect(elegirNegocioActivo([a, b], undefined)).toBe(a);
  });
  it("devuelve null sin negocios", () => {
    expect(elegirNegocioActivo([], "a")).toBeNull();
  });
});

describe("destinoInicial", () => {
  it("manda al panel con ver_reportes, editar_productos o usuarios", () => {
    for (const p of ["ver_reportes", "editar_productos", "usuarios"]) {
      expect(tieneAccesoPanel([p])).toBe(true);
      expect(destinoInicial(a, ["vender", p])).toBe("/panel");
    }
  });
  it("manda al POS al resto y a sin-acceso sin negocio", () => {
    expect(destinoInicial(a, ["vender", "caja"])).toBe("/pos");
    expect(destinoInicial(null, [])).toBe("/sin-acceso");
  });
});
