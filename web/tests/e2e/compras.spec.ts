import { expect, test } from "@playwright/test";
import { apiComo, ir, rutaAuth } from "./helpers";
import { corrida, crearProducto } from "./inventario-helpers";

// RF-COM-01 a 03: proveedor, compra a crédito, deuda y pago. Datos únicos por worker (corrida).
test.describe("dueño", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("compra a crédito: sube la deuda y un pago parcial la reduce", async ({ page }) => {
    const nombre = `Proveedor ${corrida}`;
    const producto = await crearProducto();

    await ir(page, "/panel/proveedores");
    await page.getByRole("form", { name: "Proveedor nuevo" }).getByLabel("Nombre").fill(nombre);
    await page.getByRole("button", { name: "Guardar proveedor" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Proveedor guardado." })).toBeVisible();

    await ir(page, "/panel/compras/nueva");
    await page.getByLabel("Proveedor", { exact: true }).selectOption({ label: nombre });
    await page.getByRole("combobox", { name: "Producto" }).fill(producto.codigo);
    await page.getByRole("option", { name: new RegExp(producto.nombre) }).click();
    await page.getByLabel("Cantidad").fill("4");
    await page.getByLabel("Costo unitario (Bs)").fill("12,5");
    await expect(page.getByText("Total: Bs 50,00")).toBeVisible();
    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Compra registrada por Bs 50,00." }),
    ).toBeVisible();

    const stock = await apiComo("dueno", `stock?select=cantidad&producto_id=eq.${producto.id}`);
    expect(stock.json).toEqual([{ cantidad: 4 }]);

    await ir(page, "/panel/proveedores");
    const fila = page.getByRole("listitem").filter({ hasText: nombre });
    await expect(fila).toContainText("Deuda Bs 50,00");
    await fila.getByRole("button", { name: `Registrar pago a ${nombre}` }).click();
    const pago = page.getByRole("form", { name: `Registrar pago a ${nombre}` });
    await pago.getByLabel("Monto en Bs").fill("51");
    await pago.getByRole("button", { name: "Registrar pago", exact: true }).click();
    await expect(pago).toContainText("supera la deuda");
    await pago.getByLabel("Monto en Bs").fill("20");
    await pago.getByRole("button", { name: "Registrar pago", exact: true }).click();
    await expect(fila).toContainText("Deuda Bs 30,00");

    await ir(page, "/panel/compras");
    await expect(
      page.getByRole("listitem").filter({ hasText: nombre }).filter({ hasText: "Bs 50,00" }),
    ).toBeVisible();
  });
});

test.describe("sin permiso", () => {
  test.describe("vendedor", () => {
    test.use({ storageState: rutaAuth("vendedor") });
    test("no entra a compras ni proveedores", async ({ page }) => {
      for (const ruta of ["/panel/compras", "/panel/compras/nueva", "/panel/proveedores"]) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/pos$/);
      }
    });
  });
  test.describe("contador", () => {
    test.use({ storageState: rutaAuth("contador") });
    test("entra al panel pero vuelve al inicio desde compras", async ({ page }) => {
      await page.goto("/panel/compras");
      await expect(page).toHaveURL(/\/panel$/);
      await expect(page.getByRole("link", { name: "Compras" })).toHaveCount(0);
    });
  });
});
