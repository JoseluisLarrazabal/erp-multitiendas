import { expect, test } from "@playwright/test";
import { rutaAuth } from "./helpers";

test.use({ storageState: rutaAuth("dueno") });

test("con Auth respondiendo 500, /pos no redirige en bucle y muestra error con reintento", async ({
  page,
}) => {
  await page.route("**/auth/v1/user*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "boom" }),
    }),
  );
  const aLogin: string[] = [];
  page.on(
    "request",
    (r) => r.isNavigationRequest() && r.url().includes("/login") && aLogin.push(r.url()),
  );

  await page.goto("/pos");
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos verificar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/pos$/);
  expect(aLogin).toEqual([]);

  // Al volver Auth, reintentar deja la sesión lista sin recargar.
  await page.unroute("**/auth/v1/user*");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByLabel("Negocio activo")).toBeVisible();
});

test("/pos abierto sin red pasa a lista al volver la red, sin recargar", async ({
  page,
  context,
}) => {
  await page.goto("/pos");
  await expect(page.getByLabel("Negocio activo")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Sin conexión/)).toBeVisible();
  await expect(page.getByText(/Cerrar sesión necesita conexión/)).toBeVisible();
  await page.evaluate(() => ((window as unknown as { marca: number }).marca = 1));

  await context.setOffline(false);
  await expect(page.getByLabel("Negocio activo")).toBeVisible();
  await expect(page.getByText(/Sin conexión/)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { marca?: number }).marca)).toBe(1);
});
