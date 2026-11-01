import { expect, test } from "@playwright/test";
import { apiComo, ir, rutaAuth } from "./helpers";
import {
  crearProducto,
  entradaApi,
  fila,
  tienda,
  ubicaciones,
  type Producto,
} from "./inventario-helpers";

// E2E-03, parte de la cuenta contador: ve costos pero no edita productos. Corre en un proyecto aparte, al final:
// auth.spec desactiva esta cuenta un rato y, mientras tanto, su sesión no sirve.
test.use({ storageState: rutaAuth("contador") });

let p: Producto;
test.beforeAll(async () => {
  p = await crearProducto();
  expect((await entradaApi(p, (await ubicaciones()).tienda, 5, 12.5)).status).toBeLessThan(300);
});

test("ve el valor del stock y el costo en el kardex", async ({ page }) => {
  await ir(page, `/panel/inventario?q=${p.codigo}`);
  await expect(fila(page, p)).toContainText("Bs 62,50");
  await ir(page, `/panel/inventario/${p.id}`);
  await expect(page.getByRole("list", { name: "Movimientos" })).toContainText("Costo Bs 12,50");
});

test("lee los costos por API", async () => {
  const r = await apiComo("contador", "rpc/costos_stock", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_producto_ids: [p.id] },
  });
  expect(r.status).toBe(200);
  expect(JSON.stringify(r.json)).toContain("12.5");
});

test("ve Inventario y Productos, no Precios ni Tipo de cambio, y la URL se rechaza", async ({
  page,
}) => {
  await page.goto("/panel");
  const menu = page.getByRole("navigation", { name: "Principal" });
  await expect(menu.getByRole("link", { name: "Inventario" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Productos" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Precios" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Tipo de cambio" })).toHaveCount(0);
  for (const ruta of [
    "/panel/precios",
    "/panel/tipo-cambio",
    "/panel/productos/nuevo",
    "/panel/inventario/entrada",
    "/panel/inventario/conteo",
  ]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/panel$/);
  }
});

test("en Inventario no hay acciones de escritura", async ({ page }) => {
  await page.goto("/panel/inventario");
  await expect(page.getByRole("heading", { name: "Inventario", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrada" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Conteo" })).toHaveCount(0);
});
