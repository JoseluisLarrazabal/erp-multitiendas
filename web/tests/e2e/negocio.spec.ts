import { expect, test } from "@playwright/test";
import { NEGOCIOS, rutaAuth, vigilarCsp } from "./helpers";

const HOST = "localhost";
const cookieNegocio = (value: string) => ({
  name: "negocio_activo",
  value,
  domain: HOST,
  path: "/",
});

// E2E-02 (RF-TR-02)
test.describe("dueño con 3 negocios", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("cambiar de negocio cambia lo visible", async ({ page, context }) => {
    const verCsp = vigilarCsp(page);
    await page.goto("/panel");
    const selector = page.getByLabel("Negocio activo");
    await expect(selector).toHaveValue(NEGOCIOS.tienda.id);
    await expect(page.getByText("Tienda Demo · Dueño")).toBeVisible();
    await expect(selector.locator("option")).toHaveCount(3);

    await selector.selectOption(NEGOCIOS.lavanderia.id);
    await expect(page.getByText("Lavandería Demo · Dueño")).toBeVisible();
    await expect(selector).toHaveValue(NEGOCIOS.lavanderia.id);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "negocio_activo")?.value).toBe(NEGOCIOS.lavanderia.id);
    verCsp();
  });

  test("una cookie con UUID que no es suyo cae al primer negocio", async ({ page, context }) => {
    await context.addCookies([cookieNegocio("11111111-1111-1111-1111-111111111111")]);
    await page.goto("/panel");
    await expect(page.getByText("Tienda Demo · Dueño")).toBeVisible();
  });
});

test.describe("vendedor de una sola tienda", () => {
  test.use({ storageState: rutaAuth("vendedor") });

  test("una cookie con el negocio de otro no da acceso a ese negocio", async ({
    page,
    context,
  }) => {
    await context.addCookies([cookieNegocio(NEGOCIOS.lavanderia.id)]);
    await page.goto("/pos");
    await expect(page.getByText("Tienda Demo")).toBeVisible();
    await expect(page.getByText("Lavandería Demo")).toHaveCount(0);
  });
});

test.describe("multi en el POS", () => {
  test.use({ storageState: rutaAuth("multi") });

  test("cambia de negocio en /pos y rechaza uno ajeno", async ({ page, context }) => {
    const verCsp = vigilarCsp(page);
    await page.goto("/pos");
    const selector = page.getByLabel("Negocio activo");
    await expect(selector).toHaveValue(NEGOCIOS.tienda.id);
    await expect(page.getByText("Vendedor", { exact: true })).toBeVisible();

    await selector.selectOption(NEGOCIOS.lavanderia.id);
    await expect(page.getByText("Empleado", { exact: true })).toBeVisible();
    await expect(selector).toHaveValue(NEGOCIOS.lavanderia.id);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "negocio_activo")?.value).toBe(NEGOCIOS.lavanderia.id);

    // Un id ajeno (se inyecta en el select) no está entre los negocios leídos: se rechaza y no toca la cookie.
    await selector.evaluate((el: HTMLSelectElement) => {
      el.add(new Option("Ajeno", "99999999-9999-9999-9999-999999999999"));
    });
    await selector.selectOption("99999999-9999-9999-9999-999999999999");
    await expect(page.getByRole("alert").filter({ hasText: "No tienes acceso" })).toBeVisible();
    const despues = await context.cookies();
    expect(despues.find((c) => c.name === "negocio_activo")?.value).toBe(NEGOCIOS.lavanderia.id);
    verCsp();
  });
});
