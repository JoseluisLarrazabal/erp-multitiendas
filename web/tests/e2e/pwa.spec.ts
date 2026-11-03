import { expect, test } from "@playwright/test";
import { rutaAuth } from "./helpers";

// RF-TR-07: dos apps instalables. La caja tiene service worker; el panel no (decisión del 2026-10-26).

test.describe("archivos públicos sin sesión", () => {
  for (const [ruta, tipo] of [
    ["/pos.webmanifest", /manifest\+json|application\/json/],
    ["/panel.webmanifest", /manifest\+json|application\/json/],
    ["/icons/icono-192.png", /image\/png/],
    ["/icons/icono-512.png", /image\/png/],
    ["/icons/icono-maskable-512.png", /image\/png/],
    ["/icons/apple-touch-icon.png", /image\/png/],
    ["/icons/icono.svg", /image\/svg\+xml/],
    ["/favicon.ico", /image\/(x-icon|vnd\.microsoft\.icon)/],
  ] as const) {
    test(`${ruta} responde 200 sin sesión`, async ({ request }) => {
      const r = await request.get(ruta, { maxRedirects: 0 });
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toMatch(tipo);
    });
  }
});

test.describe("instalabilidad con sesión", () => {
  test.use({ storageState: rutaAuth("dueno") });

  for (const [ruta, manifiesto] of [
    ["/pos", "/pos.webmanifest"],
    ["/panel", "/panel.webmanifest"],
  ] as const) {
    test(`${ruta}: manifiesto válido e instalable según Chrome`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", manifiesto);
      const cdp = await page.context().newCDPSession(page);
      const app = await cdp.send("Page.getAppManifest");
      const errores = await cdp.send("Page.getInstallabilityErrors");
      expect(app.errors).toEqual([]);
      expect(app.url).toContain(manifiesto);
      expect(errores.installabilityErrors).toEqual([]);
    });
  }
});

test.describe("service worker", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("el de /pos sigue en /pos y no precachea manifiestos ni íconos; el panel queda fuera", async ({
    page,
  }) => {
    await page.goto("/pos");
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toMatch(/\/pos$/);
    const claves = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const n of await caches.keys())
        for (const q of await (await caches.open(n)).keys()) urls.push(new URL(q.url).pathname);
      return urls;
    });
    expect(claves.some((u) => /webmanifest|^\/icons\//.test(u))).toBe(false);

    await page.goto("/panel");
    const panel = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return {
        controlado: navigator.serviceWorker.controller !== null,
        scopes: regs.map((r) => new URL(r.scope).pathname),
      };
    });
    expect(panel.controlado).toBe(false);
    expect(panel.scopes).toEqual(["/pos"]);
  });
});
