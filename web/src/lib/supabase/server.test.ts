import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchConTope } from "./server";

// Un fetch que nunca responde y solo termina si lo abortan.
const colgado = vi.fn(
  (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener("abort", () => rej(init.signal?.reason));
    }),
);

beforeEach(() => {
  colgado.mockClear();
});

describe("fetchConTope", () => {
  it("aborta un GET que no responde al cumplirse el tope", async () => {
    const p = fetchConTope(colgado, 30)("http://x/rest", { method: "GET" });
    const visto = expect(p).rejects.toMatchObject({ name: "TimeoutError" });
    await visto;
  });

  it("aborta un HEAD igual que un GET", async () => {
    const p = fetchConTope(colgado, 30)("http://x/rest", { method: "HEAD" });
    const visto = expect(p).rejects.toMatchObject({ name: "TimeoutError" });
    await visto;
  });

  it("no pone tope a un POST", async () => {
    const p = fetchConTope(colgado, 20)("http://x/rpc", { method: "POST" });
    let termino = false;
    p.catch(() => (termino = true));
    await new Promise((r) => setTimeout(r, 100));
    expect(termino).toBe(false);
    expect(colgado.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("respeta la señal de quien llama", async () => {
    const otra = new AbortController();
    const p = fetchConTope(colgado, 30)("http://x/rest", { method: "GET", signal: otra.signal });
    const visto = expect(p).rejects.toMatchObject({ name: "AbortError" });
    otra.abort();
    await visto;
  });

  it("corta también el cuerpo si los encabezados llegaron y el cuerpo no termina", async () => {
    const conCuerpoColgado = async (_i: RequestInfo | URL, init?: RequestInit) =>
      new Response(
        new ReadableStream({
          start(c) {
            init?.signal?.addEventListener("abort", () => c.error(init.signal?.reason));
          },
        }),
      );
    const res = await fetchConTope(conCuerpoColgado, 30)("http://x/rest", { method: "GET" });
    await expect(res.text()).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
