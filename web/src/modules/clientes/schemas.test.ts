import { describe, expect, it } from "vitest";
import { clientePanelSchema, clienteRapidoSchema, leerFiltrosClientes } from "./schemas";

describe("clienteRapidoSchema", () => {
  it("nombre obligatorio; vacíos opcionales pasan a null", () => {
    expect(clienteRapidoSchema.safeParse({ nombre: " ", ci_nit: "", telefono: "" }).success).toBe(
      false,
    );
    const r = clienteRapidoSchema.parse({ nombre: " Ana ", ci_nit: "", telefono: " 7 " });
    expect(r).toEqual({ nombre: "Ana", ci_nit: null, telefono: "7" });
  });
});

describe("clientePanelSchema y filtros", () => {
  const G = "a0000000-0000-0000-0000-000000000001";
  it("edición lleva id; los cuatro campos vacíos pasan a null salvo el nombre", () => {
    const r = clientePanelSchema.parse({
      negocioId: G,
      id: G,
      nombre: " Ana ",
      ci_nit: "",
      telefono: "",
      direccion: "",
    });
    expect(r).toMatchObject({ nombre: "Ana", ci_nit: null, telefono: null, direccion: null });
    expect(
      clientePanelSchema.safeParse({
        negocioId: G,
        nombre: "",
        ci_nit: "",
        telefono: "",
        direccion: "",
      }).success,
    ).toBe(false);
    expect(
      clientePanelSchema.safeParse({
        negocioId: G,
        nombre: "A",
        ci_nit: "x".repeat(31),
        telefono: "",
        direccion: "",
      }).success,
    ).toBe(false);
  });
  it("filtros: lo inválido cae al valor por defecto y se avisa", () => {
    expect(leerFiltrosClientes({ q: " ana ", pagina: "0" })).toEqual({
      filtros: { q: "ana", pagina: 1 },
      invalido: true,
    });
    expect(leerFiltrosClientes({ q: " ana ", pagina: "2" }).invalido).toBe(false);
    expect(leerFiltrosClientes({ q: "x".repeat(81) }).invalido).toBe(true);
  });
});
