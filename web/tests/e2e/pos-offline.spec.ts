import { expect, test } from "@playwright/test";
import { rutaAuth, vigilarCsp } from "./helpers";

// Con el proxy real: hay que tener sesión para que el precache de /pos se instale.
test.use({ storageState: rutaAuth("dueno") });

test("/pos abre y recarga sin red desde el precache, con scope solo en /pos", async ({
  page,
  context,
}) => {
  const verCsp = vigilarCsp(page);
  await page.goto("/pos");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/pos$/);
  // clientsClaim: la primera pestaña queda controlada sin recargar.
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  // El precache guardó el HTML real de /pos (con sesión), no el del login.
  const precache = await page.evaluate(async () => {
    const r = await caches.match("/pos", { ignoreSearch: true });
    return r ? { ok: r.ok, redirected: r.redirected, html: await r.text() } : null;
  });
  expect(precache?.ok).toBe(true);
  expect(precache?.redirected).toBe(false);
  expect(precache?.html).toContain("Punto de venta");

  // La guarda terminó con red: el dueño ve su negocio y el enlace al panel.
  await expect(page.getByLabel("Negocio activo")).toBeVisible();

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
  await expect(page.getByText(/Sin conexión/)).toBeVisible();
  await expect(page).toHaveURL(/\/pos$/);

  expect(failed).toEqual([]);
  expect([...fromSw.keys()].some((u) => u.endsWith(".js"))).toBe(true);
  expect([...fromSw.keys()].some((u) => u.endsWith(".css"))).toBe(true);
  expect([...fromSw.values()].every(Boolean)).toBe(true);

  // React hidrató: adjunta sus propiedades internas al nodo.
  const hydrated = await page.evaluate(() =>
    Object.keys(document.querySelector("h1") ?? {}).some((k) => k.startsWith("__reactFiber$")),
  );
  expect(hydrated).toBe(true);
  verCsp();

  await context.setOffline(false);
  await page.goto("/panel");
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
});

test("con red y la sesión borrada, la guarda de /pos redirige al login aun con el SW controlando", async ({
  page,
  context,
}) => {
  await page.goto("/pos");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.clearCookies();
  await page.reload(); // Lo sirve el SW desde el precache: el proxy no corre.
  await expect(page).toHaveURL(/\/login$/);
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
  expect(sw.status()).toBe(200);
  expect(sw.headers()["service-worker-allowed"]).toBe("/pos");
});
