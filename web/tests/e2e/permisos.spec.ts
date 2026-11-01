import { expect, test } from "@playwright/test";
import { rutaAuth } from "./helpers";

// E2E-03 parcial (RF-TR-05): acceso por permiso. "Vendedor no ve costos" llega con el catálogo (fase 1).
test.describe("vendedor de tienda", () => {
  test.use({ storageState: rutaAuth("vendedor") });

  test("va a /pos, no entra a /panel y no ve el enlace al panel", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.getByRole("heading", { name: "Punto de venta" })).toBeVisible();
    await expect(page.getByText("Vendedor", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al panel" })).toHaveCount(0);
  });
});

test.describe("dueño", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("entra al panel y desde /pos ve el enlace al panel", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/panel$/);
    await page.goto("/pos");
    await expect(page.getByRole("link", { name: "Ir al panel" })).toBeVisible();
  });
});
