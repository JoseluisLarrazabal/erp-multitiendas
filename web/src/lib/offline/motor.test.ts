import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encolar } from "./cola";
import { baseOffline } from "./db";
import { iniciarMotor } from "./motor";

beforeEach(async () => {
  await baseOffline().cola.clear();
  vi.stubGlobal("window", {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("iniciarMotor", () => {
  it("dos disparar solapados dejan un solo temporizador", async () => {
    await encolar({
      id: "a0000000-0000-4000-8000-000000000001",
      tipo: "venta",
      negocioId: "n1",
      dispositivoId: "d1",
      usuarioId: "u1",
      payload: {},
      nota: null,
      numeroImpreso: null,
    });
    const puestos = new Map<unknown, number>();
    const set = vi.spyOn(globalThis, "setTimeout");
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const motor = iniciarMotor({
      enviadores: { venta: async () => ({ t: "pausa" }) },
      elegible: () => true,
    });
    motor.disparar();
    motor.disparar();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 100));

    for (const [i, llamada] of set.mock.calls.entries()) {
      if ((llamada[1] ?? 0) >= 5_000) puestos.set(set.mock.results[i]?.value, i);
    }
    for (const [h] of clear.mock.calls) puestos.delete(h);
    expect(puestos.size).toBe(1);
    motor.detener();
  });
});
