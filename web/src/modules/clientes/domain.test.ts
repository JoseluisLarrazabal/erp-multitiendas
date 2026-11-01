import { describe, expect, it } from "vitest";
import { limpiarBusqueda, normalizarDocumento } from "./domain";

describe("limpiarBusqueda", () => {
  it("elimina caracteres que alteran el filtro", () => {
    expect(limpiarBusqueda("juan,nombre.eq.x)")).toBe("juan nombre.eq.x");
    expect(limpiarBusqueda("  a%b_c  ")).toBe("a b c");
  });
});

describe("normalizarDocumento", () => {
  it("iguala al servidor: mayúsculas y sin espacios", () => {
    expect(normalizarDocumento(" 1234 567 lp ")).toBe("1234567LP");
  });
});
