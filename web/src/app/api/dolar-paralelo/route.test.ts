import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));

import { GET } from "./route";

beforeEach(() => vi.unstubAllGlobals());

describe("GET /api/dolar-paralelo", () => {
  it("sin sesión: 401 JSON y no consulta a paralelo.bo", async () => {
    getClaims.mockResolvedValue({ data: null });
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await GET();
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "sin sesión" });
    expect(f).not.toHaveBeenCalled();
  });
  it("con sesión y paralelo.bo caído: 200 disponible false", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ disponible: false });
  });
  it("con sesión y respuesta válida", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ median: 12.03, timestamp: "2026-11-04T18:30:01Z" })),
    );
    expect(await (await GET()).json()).toEqual({
      disponible: true,
      valor: 12.03,
      leidoEn: "2026-11-04T18:30:01Z",
    });
  });
});
