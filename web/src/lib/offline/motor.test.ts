import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encolar, vaciar } from "./cola";
import { baseOffline } from "./db";
import { iniciarMotor, observarFilas } from "./motor";

beforeEach(async () => {
  await baseOffline().cola.clear();
  vi.stubGlobal("window", {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});
// Espera a que no quede vaciado en curso ni repetición: `vaciar` devuelve true solo si corrió ahora (Vitest no tiene
// navigator.locks, así que usa la guarda de módulo).
const esperarLibre = () =>
  vi.waitFor(async () =>
    expect(await vaciar({ enviadores: {}, elegible: () => false })).toBe(true),
  );
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

describe("iniciarMotor: online durante un vaciado", () => {
  it("un disparar forzado mientras corre otro se repite al terminar", async () => {
    await encolar({
      id: "a0000000-0000-4000-8000-000000000002",
      tipo: "venta",
      negocioId: "n1",
      dispositivoId: "d1",
      usuarioId: "u1",
      payload: {},
      nota: null,
      numeroImpreso: null,
    });
    let soltar!: () => void;
    const primero = new Promise<void>((r) => (soltar = r));
    const enviador = vi
      .fn()
      .mockImplementationOnce(async () => {
        await primero;
        return { t: "red", error: "x" };
      })
      .mockResolvedValue({ t: "pausa" });
    const motor = iniciarMotor({ enviadores: { venta: enviador }, elegible: () => true });
    await vi.waitFor(() => expect(enviador).toHaveBeenCalledTimes(1));
    motor.disparar(true); // llega `online` con el primer vaciado en curso
    soltar();
    await vi.waitFor(() => expect(enviador).toHaveBeenCalledTimes(2));
    // Espera a que el segundo vaciado termine (la fila pasa a "pausa") antes de detener: no se filtra al siguiente test.
    await esperarLibre();
    motor.detener();
  });

  it("un disparo no forzado durante el vaciado de OTRO motor se repite al terminar", async () => {
    await encolar({
      id: "a0000000-0000-4000-8000-000000000003",
      tipo: "venta",
      negocioId: "n1",
      dispositivoId: "d1",
      usuarioId: "u1",
      payload: {},
      nota: null,
      numeroImpreso: null,
    });
    let soltar!: () => void;
    const primero = new Promise<void>((r) => (soltar = r));
    const enviador = vi
      .fn()
      .mockImplementationOnce(async () => {
        await primero;
        return { t: "pausa" };
      })
      .mockResolvedValue({ t: "pausa" });
    const viejo = iniciarMotor({ enviadores: { venta: enviador }, elegible: () => true });
    await vi.waitFor(() => expect(enviador).toHaveBeenCalledTimes(1));
    viejo.detener(); // remount: el motor viejo ya no dispara, pero su vaciado sigue
    const nuevo = iniciarMotor({ enviadores: { venta: enviador }, elegible: () => true });
    nuevo.disparar(); // no forzado (p. ej. venta recién encolada)
    soltar();
    await vi.waitFor(() => expect(enviador).toHaveBeenCalledTimes(2));
    await esperarLibre();
    nuevo.detener();
  });
});

// Stub mínimo de navigator.locks: exclusión por nombre, ifAvailable y cola de espera.
function simularLocks() {
  const tomados = new Set<string>();
  const colas = new Map<string, (() => void)[]>();
  const request = (nombre: string, a: unknown, b?: unknown) => {
    const opts = (typeof a === "function" ? {} : a) as { ifAvailable?: boolean };
    const cb = (typeof a === "function" ? a : b) as (c: unknown) => Promise<unknown>;
    const correr = async () => {
      tomados.add(nombre);
      try {
        return await cb({ name: nombre });
      } finally {
        tomados.delete(nombre);
        colas.get(nombre)?.shift()?.();
      }
    };
    if (!tomados.has(nombre)) return correr();
    if (opts.ifAvailable) return Promise.resolve(cb(null));
    return new Promise((res, rej) => {
      colas.set(nombre, [...(colas.get(nombre) ?? []), () => correr().then(res, rej)]);
    });
  };
  vi.stubGlobal("navigator", { locks: { request } });
}

describe("espera del cerrojo entre motores", () => {
  const fila = (n: number) => ({
    id: `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    tipo: "venta" as const,
    negocioId: "n1",
    dispositivoId: "d1",
    usuarioId: "u1",
    payload: {},
    nota: null,
    numeroImpreso: null,
  });

  it("la espera de un motor detenido no envía; la de uno activo sí", async () => {
    simularLocks();
    await encolar(fila(4));
    let soltar!: () => void;
    const primero = new Promise<void>((r) => (soltar = r));
    const dueno = vi.fn(async () => {
      await primero;
      return { t: "pausa" as const };
    });
    const espia = vi.fn(async () => ({ t: "pausa" as const }));
    const A = vaciar({ enviadores: { venta: dueno }, elegible: () => true });
    await vi.waitFor(() => expect(dueno).toHaveBeenCalledTimes(1));
    let activo = true;
    const B = vaciar({
      enviadores: { venta: espia },
      elegible: () => true,
      forzar: true,
      activo: () => activo,
    });
    activo = false; // el motor de B se detuvo mientras esperaba
    soltar();
    await A;
    await B;
    expect(espia).not.toHaveBeenCalled();

    // Control: con el motor activo la misma espera sí envía.
    const C = vaciar({ enviadores: { venta: dueno }, elegible: () => true });
    await vi.waitFor(() => expect(dueno).toHaveBeenCalledTimes(2));
    const D = vaciar({ enviadores: { venta: espia }, elegible: () => true, forzar: true });
    await C;
    await D;
    expect(espia).toHaveBeenCalledTimes(1);
  });

  it("un disparo que devuelve false deja igual el temporizador del motor activo", async () => {
    simularLocks();
    await encolar(fila(5));
    let soltar!: () => void;
    const primero = new Promise<void>((r) => (soltar = r));
    const dueno = async () => {
      await primero;
      return { t: "pausa" as const };
    };
    const A = vaciar({ enviadores: { venta: dueno }, elegible: () => true });
    const viejo = iniciarMotor({ enviadores: { venta: dueno }, elegible: () => true }); // deja la espera registrada
    viejo.detener();
    const set = vi.spyOn(globalThis, "setTimeout");
    const nuevo = iniciarMotor({ enviadores: { venta: dueno }, elegible: () => true }); // vaciar devuelve false
    await vi.waitFor(() => expect(set.mock.calls.some(([, ms]) => (ms ?? 0) >= 5_000)).toBe(true));
    nuevo.detener();
    soltar();
    await A;
  });
});

describe("observarFilas", () => {
  it("si la lectura falla avisa con alFallar en vez de callar", async () => {
    vi.spyOn(baseOffline().cola, "orderBy").mockImplementation(() => {
      throw new Error("IndexedDB");
    });
    const alCambiar = vi.fn();
    const alFallar = vi.fn();
    const baja = observarFilas(alCambiar, alFallar);
    await vi.waitFor(() => expect(alFallar).toHaveBeenCalled());
    expect(alCambiar).not.toHaveBeenCalled();
    baja();
  });
});
