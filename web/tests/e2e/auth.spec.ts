import { expect, test } from "@playwright/test";
import {
  CUENTA_DESACTIVABLE,
  CUENTAS,
  esperarHidratacion,
  fijarBaneo,
  iniciarSesionUI,
  rutaAuth,
  vigilarCsp,
} from "./helpers";

// E2E-01 (RF-TR-01)
test.describe("sin sesión", () => {
  test("/, /panel y /pos van al login", async ({ page }) => {
    for (const ruta of ["/", "/panel", "/pos"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("credenciales malas muestran el mismo error genérico, exista o no la cuenta", async ({
    page,
  }) => {
    const verCsp = vigilarCsp(page);
    const mensajes: string[] = [];
    for (const [correo, clave] of [
      [CUENTAS.dueno, "mala-clave-1"],
      ["no-existe@erp.test", "mala-clave-2"],
    ] as const) {
      await iniciarSesionUI(page, correo, clave);
      const alerta = page.getByRole("alert").filter({ hasText: /incorrectos/ });
      await expect(alerta).toBeVisible();
      mensajes.push((await alerta.textContent()) ?? "");
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel("Correo")).toHaveValue(correo);
    }
    expect(mensajes[0]).toBe(mensajes[1]);
    verCsp();
  });

  test("login y logout del dueño", async ({ page }) => {
    const verCsp = vigilarCsp(page);
    await iniciarSesionUI(page, CUENTAS.dueno);
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
    verCsp();

    // Tras el login completo el HTML se ve antes de hidratar: un clic en ese hueco se pierde (sin petición de logout).
    const cerrar = page.getByRole("button", { name: "Cerrar sesión" });
    await esperarHidratacion(page, cerrar);
    await cerrar.click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("la cuenta desactivada no entra y, con JWT vivo, ve Sin acceso sin bucles", async ({
    page,
  }) => {
    try {
      // Con sesión viva: se desactiva después de entrar (el JWT dura hasta 1 hora).
      await iniciarSesionUI(page, CUENTA_DESACTIVABLE);
      await expect(page).toHaveURL(/\/(panel|pos)$/);
      await fijarBaneo(CUENTA_DESACTIVABLE, true);
      await page.goto("/panel");
      await expect(page).toHaveURL(/\/sin-acceso$/);
      await expect(page.getByRole("heading", { name: "Sin acceso" })).toBeVisible();
      await page.goto("/pos");
      await expect(page).toHaveURL(/\/sin-acceso$/);
      const cerrar = page.getByRole("button", { name: "Cerrar sesión" });
      await esperarHidratacion(page, cerrar);
      await cerrar.click();
      await expect(page).toHaveURL(/\/login$/);

      // Con la cuenta ya desactivada: el login falla con el mensaje genérico.
      await iniciarSesionUI(page, CUENTA_DESACTIVABLE);
      await expect(page.getByRole("alert").filter({ hasText: /incorrectos/ })).toBeVisible();
    } finally {
      await fijarBaneo(CUENTA_DESACTIVABLE, false);
    }
  });
});

test.describe("con sesión", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("/login redirige al inicio", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/panel$/);
  });
});

test.describe("destino tras el login", () => {
  test("un vendedor entra al POS, no al panel", async ({ page }) => {
    await iniciarSesionUI(page, CUENTAS.vendedor);
    await expect(page).toHaveURL(/\/pos$/);
  });
});
