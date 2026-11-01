import { describe, expect, it } from "vitest";
import { aperturaSchema, sesionCajaSchema } from "./schemas";

describe("caja schemas", () => {
  it("apertura: monto >= 0 con 2 decimales", () => {
    expect(aperturaSchema.safeParse({ montoInicial: 0 }).success).toBe(true);
    expect(aperturaSchema.safeParse({ montoInicial: 100.5 }).success).toBe(true);
    expect(aperturaSchema.safeParse({ montoInicial: -1 }).success).toBe(false);
    expect(aperturaSchema.safeParse({ montoInicial: 1.005 }).success).toBe(false);
  });
  it("sesión: exige id y monto", () => {
    expect(
      sesionCajaSchema.safeParse({
        id: "a0000000-0000-0000-0000-000000000001",
        monto_inicial: 0,
        abierta_en: "x",
      }).success,
    ).toBe(true);
    expect(sesionCajaSchema.safeParse({ id: "no" }).success).toBe(false);
  });
});
