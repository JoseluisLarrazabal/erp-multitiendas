import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { abrirCaja, cerrarCaja, equipoPropio, ir, rutaAuth } from "./helpers";
import { ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, fijarEquipo, tienda } from "./pos-helpers";

// RNF-14: axe-core con WCAG 2 A y AA en las pantallas principales. Solo bloquean `serious` y `critical`; lo menor
// queda fuera a propósito para que la prueba no sea ruido. Cada exclusión lleva su porqué.
async function violaciones(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test("el escáner sí detecta una violación (una imagen sin texto alternativo)", async ({ page }) => {
  await page.setContent('<main><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main>');
  expect(await violaciones(page)).toContainEqual(expect.stringContaining("image-alt"));
});

test.describe("sin sesión", () => {
  test("/login no tiene violaciones serias ni críticas", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
    expect(await violaciones(page)).toEqual([]);
  });
});

test.describe("dueño", () => {
  test.use({ storageState: rutaAuth("dueno") });

  for (const ruta of [
    "/panel",
    "/panel/productos",
    "/panel/reportes",
    "/panel/cajas",
    "/panel/tipo-cambio",
  ]) {
    test(`${ruta} no tiene violaciones serias ni críticas`, async ({ page }) => {
      await ir(page, ruta);
      expect(await violaciones(page)).toEqual([]);
    });
  }
});

// Equipo propio (A1, que ningún otro spec usa) con la caja abierta y un producto en el carrito: se escanea el POS en uso.
test.describe("vendedor", () => {
  test.use({ storageState: rutaAuth("vendedor") });
  let equipoId = "";
  let cajaId = "";
  test.beforeAll(async () => {
    const u = await ubicaciones();
    const equipo = await equipoPropio(tienda, u.tienda, "A1", "Caja de accesibilidad");
    equipoId = equipo.id;
    cajaId = await abrirCaja(tienda, equipo);
  });
  test.afterAll(async () => {
    await cerrarCaja(cajaId);
  });

  test("/pos con caja abierta y carrito no tiene violaciones serias ni críticas", async ({
    page,
  }) => {
    const producto = await crearProductoConPrecio({ contado: 10, stock: 3 });
    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
    await page.keyboard.type(producto.codigo);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("total")).toHaveText("Bs 10,00");
    expect(await violaciones(page)).toEqual([]);
  });
});
