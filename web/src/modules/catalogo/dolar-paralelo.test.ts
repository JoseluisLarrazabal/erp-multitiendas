import { afterEach, describe, expect, it, vi } from "vitest";
import { estaDesactualizado, obtenerParalelo, parsearParalelo } from "./dolar-paralelo";

const OK = {
  timestamp: "2026-11-04T18:30:01.365Z",
  buy: 12.06,
  sell: 11.99,
  median: 12.03,
  spreadPct: -0.5391,
  sourceCount: 4,
  methodologyVersion: "ec2-backend",
};

afterEach(() => vi.unstubAllGlobals());

describe("parsearParalelo", () => {
  it("toma median y timestamp de una respuesta válida", () => {
    expect(parsearParalelo(OK)).toEqual({
      disponible: true,
      valor: 12.03,
      leidoEn: OK.timestamp,
    });
  });
  it.each([
    ["sin median", { ...OK, median: undefined }],
    ["median como texto", { ...OK, median: "12.03" }],
    ["median 0", { ...OK, median: 0 }],
    ["median negativo", { ...OK, median: -1 }],
    ["timestamp inválido", { ...OK, timestamp: "ayer" }],
    ["no es objeto", null],
  ])("rechaza %s", (_n, json) => {
    expect(parsearParalelo(json)).toEqual({ disponible: false });
  });
});

describe("obtenerParalelo", () => {
  it("respuesta válida", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(OK)));
    expect(await obtenerParalelo()).toEqual({
      disponible: true,
      valor: 12.03,
      leidoEn: OK.timestamp,
    });
  });
  it("forma inválida", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ foo: 1 })));
    expect(await obtenerParalelo()).toEqual({ disponible: false });
  });
  it("HTTP 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 500 })));
    expect(await obtenerParalelo()).toEqual({ disponible: false });
  });
  it("error de red o timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    expect(await obtenerParalelo()).toEqual({ disponible: false });
  });
  it("JSON roto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>")));
    expect(await obtenerParalelo()).toEqual({ disponible: false });
  });
});

describe("estaDesactualizado", () => {
  const t = Date.parse("2026-11-04T18:30:00Z");
  it("hasta 15 min no", () => expect(estaDesactualizado("2026-11-04T18:15:00Z", t)).toBe(false));
  it("más de 15 min sí", () => expect(estaDesactualizado("2026-11-04T18:14:59Z", t)).toBe(true));
});
