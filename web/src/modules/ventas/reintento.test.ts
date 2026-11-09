import { describe, expect, it, vi } from "vitest";
import { reintentarHastaConfirmar, type Intento } from "./reintento";

const sinEspera = () => Promise.resolve();

describe("reintentarHastaConfirmar", () => {
  it("devuelve el primer resultado con respuesta, hecho o definitivo", async () => {
    const hecho = await reintentarHastaConfirmar<string>({
      intentar: async () => ({ t: "hecho", valor: "ok" }),
      existe: async () => null,
      alDuda: vi.fn(),
      esperar: sinEspera,
    });
    expect(hecho).toEqual({ t: "hecho", valor: "ok" });
    const definitivo = await reintentarHastaConfirmar<string>({
      intentar: async () => ({ t: "definitivo", valor: "no" }),
      existe: async () => null,
      alDuda: vi.fn(),
      esperar: sinEspera,
    });
    expect(definitivo).toEqual({ t: "definitivo", valor: "no" });
  });
  it("sin respuesta reintenta 4 veces, avisa cada vez y luego pregunta si existe", async () => {
    const intentar = vi.fn<(i: number) => Promise<Intento<string>>>(async () => ({ t: "duda" }));
    const alDuda = vi.fn();
    const r = await reintentarHastaConfirmar<string>({
      intentar,
      existe: async () => "quedó",
      alDuda,
      esperar: sinEspera,
    });
    expect(r).toEqual({ t: "hecho", valor: "quedó" });
    expect(intentar.mock.calls.map((c) => c[0])).toEqual([0, 1, 2, 3]);
    expect(alDuda).toHaveBeenCalledTimes(4);
  });
  it("si tampoco existe, queda sin confirmar", async () => {
    const r = await reintentarHastaConfirmar<string>({
      intentar: async () => ({ t: "duda" }),
      existe: async () => null,
      alDuda: vi.fn(),
      esperar: sinEspera,
    });
    expect(r).toEqual({ t: "sin-confirmar" });
  });
});
