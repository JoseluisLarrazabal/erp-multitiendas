import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({ rpc }) }));

function entorno(sobre: { onLine?: boolean } = {}) {
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { onLine: sobre.onLine ?? true });
  vi.stubGlobal("location", { pathname: "/panel/ventas", search: "?q=juan", href: "x" });
  vi.stubGlobal("document", { cookie: "a=1; negocio_activo=neg-1" });
}

// Cada prueba usa un módulo nuevo: el mapa de deduplicación es estado del módulo.
async function cargar() {
  vi.resetModules();
  return (await import("./registro-errores")).registrarError;
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  entorno();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("registrarError", () => {
  it("nunca lanza aunque la RPC rechace o lance", async () => {
    const registrar = await cargar();
    rpc.mockRejectedValueOnce(new Error("x"));
    expect(() => registrar("rpc", "XX000", "uno")).not.toThrow();
    rpc.mockImplementationOnce(() => {
      throw new Error("sync");
    });
    expect(() => registrar("rpc", "XX000", "dos")).not.toThrow();
    await Promise.resolve();
  });
  it("no hace nada sin window ni sin red", async () => {
    const registrar = await cargar();
    vi.unstubAllGlobals();
    registrar("rpc", null, "a");
    entorno({ onLine: false });
    registrar("rpc", null, "b");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("deduplica el mismo origen y mensaje dentro de 10 min", async () => {
    vi.useFakeTimers();
    const registrar = await cargar();
    registrar("rpc", null, "igual");
    registrar("rpc", null, "igual");
    registrar("cola", null, "igual");
    expect(rpc).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(601_000);
    registrar("rpc", null, "igual");
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it("distingue por código y agrupa mensajes que solo difieren en dígitos", async () => {
    const registrar = await cargar();
    registrar("rpc", "A1", "mismo");
    registrar("rpc", "B2", "mismo");
    expect(rpc).toHaveBeenCalledTimes(2);
    rpc.mockClear();
    registrar("rpc", null, "fila 12 falló");
    registrar("rpc", null, "fila 345 falló");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("envía la ruta sin query y el negocio guardado", async () => {
    const registrar = await cargar();
    registrar("accion", "XX000", "m");
    const args = rpc.mock.calls[0]!;
    expect(args[0]).toBe("registrar_error");
    expect(args[1]).toMatchObject({
      p_origen: "accion",
      p_codigo: "XX000",
      p_negocio_id: "neg-1",
      p_contexto: { ruta: "/panel/ventas" },
    });
    expect(JSON.stringify(args[1])).not.toContain("juan");
  });
});
