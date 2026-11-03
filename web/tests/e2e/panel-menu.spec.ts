import { expect, test } from "@playwright/test";
import { rutaAuth } from "./helpers";

test.use({ storageState: rutaAuth("dueno"), viewport: { width: 390, height: 844 } });

// Teclado real: foco al abrir, Tab llega a los enlaces, Escape cierra y devuelve el foco.
test("menú móvil: Enter abre, Tab recorre, Escape cierra y devuelve el foco", async ({ page }) => {
  await page.goto("/panel");
  await page.waitForLoadState("networkidle"); // hidratado: si no, Enter no abre nada
  const abrir = page.getByRole("button", { name: "Abrir menú" });
  const cerrar = page.getByRole("button", { name: "Cerrar menú" });
  await abrir.focus();
  await page.keyboard.press("Enter");

  await expect(cerrar).toBeFocused();
  await expect(page.locator("div[inert]")).toHaveCount(1);

  const enlace = page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Inicio" });
  for (let i = 0; i < 6 && !(await enlace.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(enlace).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(abrir).toBeFocused();
  await expect(page.locator("div[inert]")).toHaveCount(0);
  await expect(cerrar).toBeHidden();
});
