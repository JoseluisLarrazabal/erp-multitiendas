import { describe, expect, it } from "vitest";
import { clienteRapidoSchema } from "./schemas";

describe("clienteRapidoSchema", () => {
  it("nombre obligatorio; vacíos opcionales pasan a null", () => {
    expect(clienteRapidoSchema.safeParse({ nombre: " ", ci_nit: "", telefono: "" }).success).toBe(
      false,
    );
    const r = clienteRapidoSchema.parse({ nombre: " Ana ", ci_nit: "", telefono: " 7 " });
    expect(r).toEqual({ nombre: "Ana", ci_nit: null, telefono: "7" });
  });
});
