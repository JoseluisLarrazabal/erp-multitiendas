import { expect, test as setup } from "@playwright/test";
import { CUENTAS, iniciarSesionUI, rutaAuth } from "./helpers";

// Un login por cuenta, guardado como storageState: respeta el límite de inicios de sesión de Auth
// y deja a cada prueba un contexto propio (las cookies se copian, no se comparten).
for (const cuenta of ["dueno", "vendedor", "multi"] as const) {
  setup(`sesión de ${cuenta}`, async ({ page }) => {
    await iniciarSesionUI(page, CUENTAS[cuenta]);
    await expect(page).toHaveURL(/\/(panel|pos)$/);
    await page.context().storageState({ path: rutaAuth(cuenta) });
  });
}
