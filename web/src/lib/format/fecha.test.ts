import { describe, expect, it } from "vitest";
import { formatearFechaHora, formatearHace, formatearHora, limitesDelDia } from "./fecha";

describe("fechas en hora de Bolivia", () => {
  it("convierte de UTC a UTC-4", () => {
    expect(formatearFechaHora("2026-11-02T02:30:00Z")).toBe("01/11/2026 22:30");
    expect(formatearHora("2026-11-01T15:05:00Z")).toBe("11:05");
  });
  it("el día va de las 00:00 de Bolivia a las 00:00 del siguiente", () => {
    expect(limitesDelDia("2026-11-01")).toEqual({
      inicio: "2026-11-01T04:00:00.000Z",
      fin: "2026-11-02T04:00:00.000Z",
    });
  });
  it("rechaza fechas que no existen o mal formadas", () => {
    expect(limitesDelDia("2026-02-31")).toBeNull();
    expect(limitesDelDia("01/11/2026")).toBeNull();
    expect(limitesDelDia("")).toBeNull();
  });
});

describe("formatearHace", () => {
  const ahora = Date.parse("2026-11-01T12:00:00Z");
  it.each([
    [0, "hace un momento"],
    [5 * 60_000, "hace 5 min"],
    [3 * 3_600_000, "hace 3 h"],
    [24 * 3_600_000, "hace 1 día"],
    [50 * 3_600_000, "hace 2 días"],
  ])("%d ms", (ms, texto) => {
    expect(formatearHace(ahora - ms, ahora)).toBe(texto);
  });
});
