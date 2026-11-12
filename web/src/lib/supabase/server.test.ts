import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchConTope } from "./server";

// Un fetch que nunca responde y solo termina si lo abortan.
const colgado = vi.fn(
  (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener("abort", () => rej(init.signal?.reason));
    }),
);

beforeEach(() => {
  vi.useFakeTimers();
  colgado.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("fetchConTope", () => {
  it("aborta un GET que no responde al cumplirse el tope", async () => {
    const p = fetchConTope(colgado, 1000)("http://x/rest", { method: "GET" });
    const visto = expect(p).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(1000);
    await visto;
  });

  it("aborta un HEAD igual que un GET", async () => {
    const p = fetchConTope(colgado, 1000)("http://x/rest", { method: "HEAD" });
    const visto = expect(p).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(1000);
    await visto;
  });

  it("no pone tope a un POST", async () => {
    const p = fetchConTope(colgado, 1000)("http://x/rpc", { method: "POST" });
    let termino = false;
    p.catch(() => (termino = true));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(termino).toBe(false);
    expect(colgado.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("respeta la señal de quien llama", async () => {
    const otra = new AbortController();
    const p = fetchConTope(colgado, 1000)("http://x/rest", { method: "GET", signal: otra.signal });
    const visto = expect(p).rejects.toMatchObject({ name: "AbortError" });
    otra.abort();
    await visto;
  });

  it("no deja temporizadores vivos si la lectura responde", async () => {
    const ok = vi.fn(async () => new Response("{}"));
    await fetchConTope(ok, 1000)("http://x/rest", { method: "GET" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
