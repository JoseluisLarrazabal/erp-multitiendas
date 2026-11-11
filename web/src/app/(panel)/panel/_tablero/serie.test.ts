import { describe, expect, it } from "vitest";
import { alturaRelativa, restarDias, serieSieteDias } from "./serie";

describe("serieSieteDias", () => {
  it("rellena con 0 los días sin ventas y ordena del más antiguo a hoy", () => {
    const s = serieSieteDias(
      [
        { clave: "2026-11-10", neto: 50 },
        { clave: "2026-11-08", neto: 20.5 },
      ],
      "2026-11-10",
    );
    expect(s.map((d) => d.dia)).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
    ]);
    expect(s.map((d) => d.monto)).toEqual([0, 0, 0, 0, 20.5, 0, 50]);
  });
  it("cruza el fin de mes y de año", () => {
    expect(serieSieteDias([], "2026-03-02").map((d) => d.dia)).toEqual([
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
    expect(restarDias("2026-01-03", 6)).toBe("2025-12-28");
  });
  it("con todo en 0 las alturas son 0", () => {
    const s = serieSieteDias([], "2026-11-10");
    expect(s.every((d) => d.monto === 0)).toBe(true);
    expect(alturaRelativa(0, 0)).toBe(0);
  });
  it("la altura es relativa al máximo", () => {
    expect(alturaRelativa(25, 100)).toBe(0.25);
  });
});
