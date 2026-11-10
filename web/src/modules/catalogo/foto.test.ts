import { describe, expect, it } from "vitest";
import { medidasDestino } from "./foto";

describe("medidasDestino", () => {
  it("achica el lado mayor a 1.200 y conserva la proporción", () => {
    expect(medidasDestino(2400, 1600, 1200)).toEqual({ ancho: 1200, alto: 800 });
    expect(medidasDestino(1600, 2400, 1200)).toEqual({ ancho: 800, alto: 1200 });
  });
  it("lo que ya cabe queda igual", () => {
    expect(medidasDestino(800, 600, 1200)).toEqual({ ancho: 800, alto: 600 });
    expect(medidasDestino(1200, 1200, 1200)).toEqual({ ancho: 1200, alto: 1200 });
  });
});
