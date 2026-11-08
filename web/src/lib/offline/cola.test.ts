import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conCerrojo,
  conFila,
  encolar,
  esperaReintento,
  leerFilas,
  marcarRechazada,
  marcarRed,
  quitarIlegibles,
  quitarSiRechazada,
  reabrir,
  vaciar,
  type Enviador,
  type FilaNueva,
} from "./cola";
import { baseOffline } from "./db";
import { resultadoDeError } from "./envio";
import { avisarRed, leerSinRed } from "./red";

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

  it("solo un red sin respuesta marca la app sin red; si el servidor contestó o el enviador lanzó, no", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    await encolar(nueva(1));
    await vaciar({
      ...todas(),
      forzar: true,
      enviadores: { venta: async () => ({ t: "red", error: "x", respondio: true }) },
    });
    expect(leerSinRed()).toBe(false);
    await vaciar({
      ...todas(),
      forzar: true,
      enviadores: {
        venta: async () => {
          throw new Error("boom");
        },
      },
    });
    expect(leerSinRed()).toBe(false);
    await vaciar({
      ...todas(),
      forzar: true,
      enviadores: { venta: async () => ({ t: "red", error: "x" }) },
    });
    expect(leerSinRed()).toBe(true);
    avisarRed(true);
    vi.unstubAllGlobals();
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

  it("los fallos de red no gastan el tope de errores inesperados; tras 5 errores con respuesta el siguiente rechaza; reabrir lo reinicia", async () => {
    await encolar(nueva(1));
    for (let i = 0; i < 5; i++) await marcarRed(uuid(1), "sin red");
    expect((await leerFilas()).filas[0]).toMatchObject({ intentos: 5, inesperados: 0 });
    const enviador = vi.fn<Enviador>(async (f) =>
      resultadoDeError({ message: "boom", code: "PGRST000" }, f.inesperados),
    );
    await vaciar({ ...todas(), forzar: true, enviadores: { venta: enviador } });
    expect((await leerFilas()).filas[0]).toMatchObject({ estado: "pendiente", inesperados: 1 });
    for (let i = 0; i < 5; i++)
      await vaciar({ ...todas(), forzar: true, enviadores: { venta: enviador } });
    expect((await leerFilas()).filas[0]).toMatchObject({ estado: "rechazada", inesperados: 5 });
    await reabrir(uuid(1));
    expect((await leerFilas()).filas[0]).toMatchObject({
      estado: "pendiente",
      inesperados: 0,
      intentos: 10,
    });
  });

  it("una fila vieja sin `inesperados` sigue legible tras marcarRed con respuesta", async () => {
    await encolar(nueva(1));
    await baseOffline()
      .cola.where("id")
      .equals(uuid(1))
      .modify((f) => {
        delete (f as { inesperados?: number }).inesperados;
      });
    await marcarRed(uuid(1), "x", true);
    const r = await leerFilas();
    expect(r.ilegibles).toBe(0);
    expect(r.filas[0]).toMatchObject({ inesperados: 1, intentos: 1 });
  });

  it("tras un error con respuesta la espera sale de `inesperados`, no de los intentos de red", async () => {
    await encolar(nueva(1));
    await baseOffline().cola.where("id").equals(uuid(1)).modify({ intentos: 40 });
    const antes = Date.now();
    await marcarRed(uuid(1), "x", true);
    const f = (await leerFilas()).filas[0]!;
    expect(f.proximoIntento - antes).toBeLessThan(esperaReintento(1) + 1_000);
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

describe("primer intento interrumpido", () => {
  it("una fila no entregada con el cerrojo libre se rechaza sin enviarla y sigue con la próxima", async () => {
    await encolar(nueva(1, { entregada: false }));
    await encolar(nueva(2));
    const enviador = vi.fn<Enviador>(ok);
    await vaciar({ ...todas(), forzar: true, enviadores: { venta: enviador } });
    expect(enviador).toHaveBeenCalledTimes(1);
    const { filas } = await leerFilas();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ id: uuid(1), estado: "rechazada" });
    expect(filas[0]?.error).toContain("El cobro se interrumpió antes de la nota");
  });

  it("con el cerrojo tomado (primer intento vivo) no se toca", async () => {
    await encolar(nueva(1, { entregada: false }));
    let soltar!: () => void;
    const tomada = conFila(uuid(1), () => new Promise<void>((r) => (soltar = r)));
    await vaciar({ ...todas(), forzar: true, enviadores: { venta: ok } });
    expect((await leerFilas()).filas[0]).toMatchObject({ estado: "pendiente", entregada: false });
    soltar();
    await tomada;
  });

  it("Reintentar la deja entregada y se envía; una fila guardada sin el campo cuenta como entregada", async () => {
    await encolar(nueva(1, { entregada: false }));
    await vaciar({ ...todas(), enviadores: { venta: ok } });
    await reabrir(uuid(1));
    expect((await leerFilas()).filas[0]).toMatchObject({ entregada: true });
    await vaciar({ ...todas(), enviadores: { venta: ok } });
    expect((await leerFilas()).filas).toHaveLength(0);

    await baseOffline().cola.clear();
    const { entregada, ...vieja } = {
      ...nueva(3),
      estado: "pendiente",
      intentos: 0,
      proximoIntento: 0,
      error: null,
      entregada: true,
    };
    expect(entregada).toBe(true);
    await baseOffline().cola.add(vieja as never);
    expect((await leerFilas()).filas[0]).toMatchObject({ entregada: true });
    const enviador = vi.fn<Enviador>(ok);
    await vaciar({ ...todas(), enviadores: { venta: enviador } });
    expect(enviador).toHaveBeenCalledTimes(1);
  });
});

describe("quitarSiRechazada y conCerrojo", () => {
  it("solo borra una fila rechazada: si se reabrió, la deja", async () => {
    await encolar(nueva(1));
    await marcarRechazada(uuid(1), "no");
    await reabrir(uuid(1));
    expect(await quitarSiRechazada(uuid(1))).toBe(false);
    expect((await leerFilas()).filas).toHaveLength(1);
    await marcarRechazada(uuid(1), "no");
    expect(await quitarSiRechazada(uuid(1))).toBe(true);
    expect((await leerFilas()).filas).toHaveLength(0);
    expect(await quitarSiRechazada(uuid(1))).toBe(false);
  });

  it("no borra una fila que otro está enviando", async () => {
    await encolar(nueva(1));
    await marcarRechazada(uuid(1), "no");
    let soltar!: () => void;
    const tomada = conFila(uuid(1), () => new Promise<void>((r) => (soltar = r)));
    expect(await quitarSiRechazada(uuid(1))).toBe(false);
    soltar();
    await tomada;
  });

  it("conCerrojo serializa las secciones del mismo nombre y sigue tras un fallo", async () => {
    const orden: string[] = [];
    const seccion = (n: string, falla = false) =>
      conCerrojo("x", async () => {
        orden.push(`${n}+`);
        await new Promise((r) => setTimeout(r, 10));
        orden.push(`${n}-`);
        if (falla) throw new Error(n);
      });
    const r = await Promise.allSettled([seccion("a", true), seccion("b"), seccion("c")]);
    expect(orden).toEqual(["a+", "a-", "b+", "b-", "c+", "c-"]);
    expect(r.map((x) => x.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
  });
});
