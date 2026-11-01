import { describe, expect, it } from "vitest";
import { formatearFechaHora, formatearHora, limitesDelDia } from "./fecha";

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
