import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conFila,
  encolar,
  esperaReintento,
  leerFilas,
  marcarRechazada,
  marcarRed,
  quitarIlegibles,
  reabrir,
  vaciar,
  type Enviador,
  type FilaNueva,
} from "./cola";
import { baseOffline } from "./db";

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const nueva = (n: number, extra: Partial<FilaNueva> = {}): FilaNueva => ({
  id: uuid(n),
  tipo: "venta",
  negocioId: "n1",
  dispositivoId: "d1",
  usuarioId: "u1",
  payload: { n },
  nota: null,
  numeroImpreso: `C1-00000${n}`,
  ...extra,
});
const todas = () => ({ elegible: () => true });
const ok: Enviador = async () => ({ t: "ok" });

beforeEach(async () => {
  await baseOffline().cola.clear();
});

describe("vaciar", () => {
  it("envía en orden y borra lo enviado", async () => {
    for (const n of [1, 2, 3]) await encolar(nueva(n));
    const vistos: unknown[] = [];
    await vaciar({
      ...todas(),
      enviadores: {
        venta: async (f) => {
          vistos.push(f.payload);
          return { t: "ok" };
        },
      },
    });
    expect(vistos).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect((await leerFilas()).filas).toHaveLength(0);
  });

  it("un error de red corta, programa backoff y no avanza a las siguientes", async () => {
    await encolar(nueva(1));
    await encolar(nueva(2));
    const enviador = vi.fn<Enviador>(async () => ({ t: "red", error: "sin red" }));
    const antes = Date.now();
    await vaciar({ ...todas(), enviadores: { venta: enviador } });
    expect(enviador).toHaveBeenCalledTimes(1);
    const { filas } = await leerFilas();
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ intentos: 1, estado: "pendiente", error: "sin red" });
    expect(filas[0]!.proximoIntento).toBeGreaterThanOrEqual(antes + 5_000);

    // Aún en espera: un vaciado normal no la toca; forzado (volvió la red) sí.
    await vaciar({ ...todas(), enviadores: { venta: enviador } });
    expect(enviador).toHaveBeenCalledTimes(1);
    await vaciar({ ...todas(), forzar: true, enviadores: { venta: ok } });
    expect((await leerFilas()).filas).toHaveLength(0);
  });

  it("el backoff crece de 5 s hasta 5 min", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(esperaReintento)).toEqual([
      5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000,
    ]);
  });

  it("un rechazo con código deja la fila rechazada, sigue con la próxima y no borra", async () => {
    await encolar(nueva(1));
    await encolar(nueva(2));
    await vaciar({
      ...todas(),
      enviadores: {
        venta: async (f) =>
          (f.payload as { n: number }).n === 1 ? { t: "rechazo", error: "no" } : { t: "ok" },
      },
    });
    const { filas } = await leerFilas();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ id: uuid(1), estado: "rechazada", error: "no" });
    // Una rechazada no se reenvía sola, pero Reintentar la deja pendiente de nuevo.
    const enviador = vi.fn<Enviador>(ok);
    await vaciar({ ...todas(), enviadores: { venta: enviador } });
    expect(enviador).not.toHaveBeenCalled();
    await reabrir(uuid(1));
    await vaciar({ ...todas(), enviadores: { venta: enviador } });
    expect(enviador).toHaveBeenCalledTimes(1);
  });

  it("una fila ilegible no rompe el vaciado y no se borra", async () => {
    await encolar(nueva(1));
    await baseOffline().cola.add({ id: "no-es-uuid", tipo: 7 } as never);
    await encolar(nueva(2));
    const enviador = vi.fn<Enviador>(ok);
    await vaciar({ ...todas(), enviadores: { venta: enviador } });
    expect(enviador).toHaveBeenCalledTimes(2);
    const r = await leerFilas();
    expect(r.filas).toHaveLength(0);
    expect(r.ilegibles).toBe(1);
    expect(await baseOffline().cola.count()).toBe(1);
  });

  it("dos vaciados simultáneos envían cada fila una sola vez", async () => {
    await encolar(nueva(1));
    await encolar(nueva(2));
    const enviador = vi.fn<Enviador>(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { t: "ok" };
    });
    await Promise.all([
      vaciar({ ...todas(), enviadores: { venta: enviador } }),
      vaciar({ ...todas(), enviadores: { venta: enviador } }),
    ]);
    expect(enviador).toHaveBeenCalledTimes(2);
  });

  it("un tipo sin enviador se conserva y no bloquea al resto", async () => {
    await encolar(nueva(1, { tipo: "desconocido" }));
    await encolar(nueva(2));
    await vaciar({ ...todas(), enviadores: { venta: ok } });
    const { filas } = await leerFilas();
    expect(filas.map((f) => f.tipo)).toEqual(["desconocido"]);
  });

  it("no toca filas de otro negocio", async () => {
    await encolar(nueva(1, { negocioId: "otro" }));
    await encolar(nueva(2));
    const enviador = vi.fn<Enviador>(ok);
    await vaciar({
      enviadores: { venta: enviador },
      elegible: (f) => f.negocioId === "n1",
      forzar: true,
    });
    expect(enviador).toHaveBeenCalledTimes(1);
    expect((await leerFilas()).filas.map((f) => f.id)).toEqual([uuid(1)]);
  });

  it("una fila con el cerrojo tomado (su primer intento) no se envía y corta el recorrido", async () => {
    await encolar(nueva(1));
    await encolar(nueva(2));
    const enviador = vi.fn<Enviador>(ok);
    let soltar!: () => void;
    const dentro = new Promise<void>((r) => (soltar = r));
    const tomada = conFila(uuid(1), () => dentro);
    await vaciar({ ...todas(), forzar: true, enviadores: { venta: enviador } });
    expect(enviador).not.toHaveBeenCalled();
    expect((await leerFilas()).filas).toHaveLength(2);

    soltar();
    await tomada;
    await vaciar({ ...todas(), enviadores: { venta: enviador } });
    expect(enviador).toHaveBeenCalledTimes(2);
  });

  it("no reenvía una fila que otra pestaña ya quitó después de leerla", async () => {
    await encolar(nueva(1));
    await encolar(nueva(2));
    const vistos: unknown[] = [];
    await vaciar({
      ...todas(),
      enviadores: {
        venta: async (f) => {
          vistos.push(f.payload);
          if ((f.payload as { n: number }).n === 1)
            await baseOffline().cola.where("id").equals(uuid(2)).delete();
          return { t: "ok" };
        },
      },
    });
    expect(vistos).toEqual([{ n: 1 }]);
  });

  it("Reintentar conserva los intentos: la duda no se borra", async () => {
    await encolar(nueva(1));
    await marcarRed(uuid(1), "sin red");
    await marcarRed(uuid(1), "sin red");
    await marcarRechazada(uuid(1), "no");
    await reabrir(uuid(1));
    expect((await leerFilas()).filas[0]).toMatchObject({
      estado: "pendiente",
      error: null,
      intentos: 2,
      proximoIntento: 0,
    });
  });

  it("quitarIlegibles borra solo las ilegibles que se pidieron", async () => {
    await encolar(nueva(1));
    await baseOffline().cola.add({ id: "no-es-uuid", tipo: 7 } as never);
    await baseOffline().cola.add({ id: "otro-roto", tipo: 8 } as never);
    const { ordenesIlegibles, filas } = await leerFilas();
    expect(ordenesIlegibles).toHaveLength(2);
    // Una orden de fila legible nunca se borra, aunque venga en la lista.
    await quitarIlegibles([ordenesIlegibles[0]!, filas[0]!.orden]);
    const r = await leerFilas();
    expect(r.filas).toHaveLength(1);
    expect(r.ordenesIlegibles).toEqual([ordenesIlegibles[1]]);
  });

  it("la misma operación no entra dos veces", async () => {
    await encolar(nueva(1));
    await expect(encolar(nueva(1))).rejects.toThrow();
  });
});
