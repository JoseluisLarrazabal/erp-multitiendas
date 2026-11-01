import { expect, test } from "@playwright/test";

test("/pos abre y recarga sin red desde el precache, con scope solo en /pos", async ({
  page,
  context,
}) => {
  await page.goto("/pos");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/pos$/);
  // clientsClaim: la primera pestaña queda controlada sin recargar.
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  const failed: string[] = [];
  const fromSw = new Map<string, boolean>();
  page.on("requestfailed", (r) => {
    if (r.url().includes("/_next")) failed.push(r.url());
  });
  page.on("response", (r) => {
    if (/\/_next\/static\/.*\.(js|css)$/.test(r.url())) fromSw.set(r.url(), r.fromServiceWorker());
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Punto de venta" })).toBeVisible();

  expect(failed).toEqual([]);
  expect([...fromSw.keys()].some((u) => u.endsWith(".js"))).toBe(true);
  expect([...fromSw.keys()].some((u) => u.endsWith(".css"))).toBe(true);
  expect([...fromSw.values()].every(Boolean)).toBe(true);

  // React hidrató: adjunta sus propiedades internas al nodo.
  const hydrated = await page.evaluate(() =>
    Object.keys(document.querySelector("h1") ?? {}).some((k) => k.startsWith("__reactFiber$")),
  );
  expect(hydrated).toBe(true);

  await context.setOffline(false);
  await page.goto("/");
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
});

test("si el precache de /pos recibe un redirect, el service worker no se instala", async ({
  page,
  context,
}) => {
  // Solo las peticiones del SW: la navegación normal a /pos sigue su curso.
  await context.route("**/pos", (route) =>
    route.request().serviceWorker()
      ? route.fulfill({ status: 302, headers: { location: "/" } })
      : route.continue(),
  );
  await page.goto("/pos");
  await page.waitForTimeout(3000);
  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/pos");
    const keys = await caches.keys();
    return { active: reg?.active !== null && reg?.active !== undefined, keys: keys.length };
  });
  expect(state.active).toBe(false);
});

test("el service worker se sirve con el alcance permitido solo a /pos", async ({ request }) => {
  const sw = await request.get("/sw-pos/sw.js");
  expect(sw.headers()["service-worker-allowed"]).toBe("/pos");
});
