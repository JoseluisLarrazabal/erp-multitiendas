import { describe, expect, it } from "vitest";
import { precacheGuardPlugin } from "./sw-precache-guard";

const request = new Request("http://localhost/pos");
const withUrl = (res: Response, url: string, redirected: boolean) => {
  Object.defineProperty(res, "url", { value: url });
  Object.defineProperty(res, "redirected", { value: redirected });
  return res;
};

describe("precacheGuardPlugin", () => {
  it("acepta una respuesta 200 directa", async () => {
    const res = withUrl(new Response("ok"), "http://localhost/pos", false);
    await expect(precacheGuardPlugin.cacheWillUpdate({ request, response: res })).resolves.toBe(
      res,
    );
  });

  it("rechaza una respuesta redirigida", async () => {
    const res = withUrl(new Response("login"), "http://localhost/login", true);
    await expect(precacheGuardPlugin.cacheWillUpdate({ request, response: res })).rejects.toThrow(
      /rechazado/,
    );
  });

  it("rechaza una URL final distinta aunque redirected sea false", async () => {
    const res = withUrl(new Response("x"), "http://localhost/otra", false);
    await expect(precacheGuardPlugin.cacheWillUpdate({ request, response: res })).rejects.toThrow();
  });

  it("rechaza respuestas de error", async () => {
    const res = withUrl(new Response("no", { status: 404 }), "http://localhost/pos", false);
    await expect(precacheGuardPlugin.cacheWillUpdate({ request, response: res })).rejects.toThrow();
  });
});
