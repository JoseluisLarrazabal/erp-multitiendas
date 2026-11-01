import { expect, test } from "@playwright/test";

test("la portada abre con el nombre del sistema", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("ERP Multitiendas");
  await expect(page.getByRole("heading", { name: "ERP Multitiendas" })).toBeVisible();
});
