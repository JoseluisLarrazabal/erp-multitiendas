import { expect, test, type Page } from "@playwright/test";
import { apiComo, ir, rutaAuth } from "./helpers";
import {
  corrida,
  crearProducto,
  entradaApi,
  ubicaciones,
  type Producto,
} from "./inventario-helpers";

// Flujo con lector USB y datos frescos de las pantallas de operación (RF-CAT-03, RF-INV-*). Son pruebas de
// comportamiento de foco y de carga: corren contra el build de producción, donde StrictMode no repite los efectos.
test.use({ storageState: rutaAuth("dueno") });

const combo = (page: Page) => page.getByRole("combobox", { name: "Producto" });

async function elegir(page: Page, p: Producto) {
  await combo(page).fill(p.codigo);
  await page.getByRole("option", { name: new RegExp(p.nombre) }).click();
  await expect(page.getByLabel("Cantidad")).toBeFocused();
}

// La acción de servidor que lee el stock de un producto lleva `productoId` y ninguna otra de la pantalla antes de enviar.
const esLecturaDeStock = (postData: string | null) => !!postData?.includes('"productoId"');

test("entrada con lector: dos escaneos seguidos sin clic y la ubicación se conserva", async ({
  page,
}) => {
  const a = await crearProducto();
  const b = await crearProducto();
  const u = await ubicaciones();
  await ir(page, "/panel/inventario/entrada");
  // Con el formulario sin tocar, el resumen de stock ya existe como región viva (selector, resumen y pie).
  await expect(page.locator('form [role="status"]')).toHaveCount(3);
  await page.getByLabel("Ubicación").selectOption({ label: "Depósito" });
  await combo(page).click();
  for (const [p, n] of [
    [a, "3"],
    [b, "4"],
  ] as const) {
    await expect(combo(page)).toBeFocused();
    await page.keyboard.type(p.barras);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Cantidad")).toBeFocused();
    await page.keyboard.type(n);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: `Entrada registrada: ${n}` }),
    ).toBeVisible();
  }
  await expect(page.getByLabel("Ubicación")).toHaveValue(u.deposito);
  for (const [p, n] of [
    [a, 3],
    [b, 4],
  ] as const) {
    const r = await apiComo("dueno", `stock?select=ubicacion_id,cantidad&producto_id=eq.${p.id}`);
    expect(r.json).toEqual([{ ubicacion_id: u.deposito, cantidad: n }]);
  }
});

test("la búsqueda del inventario arranca enfocada y con el texto seleccionado", async ({
  page,
}) => {
  await ir(page, "/panel/inventario?q=algo");
  const q = page.getByRole("searchbox", { name: "Buscar" });
  await expect(q).toBeFocused();
  expect(await q.evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd])).toEqual([
    0, 4,
  ]);
});

test.describe("conteo", () => {
  test("escaneo en cadena, errores con foco, revisión con foco y datos frescos", async ({
    page,
  }) => {
    const a = await crearProducto();
    const b = await crearProducto();
    const u = await ubicaciones();
    await entradaApi(a, u.tienda, 5);
    await entradaApi(b, u.tienda, 3);
    await ir(page, "/panel/inventario/conteo");
    await page.getByLabel("Ubicación a contar").selectOption({ label: "Tienda" });
    const q = page.getByRole("searchbox", { name: "Buscar" });
    await q.fill(corrida);
    await q.press("Enter");
    await expect(page.getByLabel(`Contado de ${a.nombre}`)).toBeVisible();
    await expect(page.getByLabel(`Contado de ${b.nombre}`)).toBeVisible();
    // Tras buscar, el texto queda seleccionado: el siguiente escaneo lo reemplaza sin clic.
    await expect(q).toBeFocused();
    await page.keyboard.type(a.barras);
    await page.keyboard.press("Enter");
    // Un solo resultado: la cantidad de esa fila recibe el foco.
    const cantidad = page.getByLabel(`Contado de ${a.nombre}`);
    await expect(cantidad).toBeFocused();
    await expect(page.getByLabel(`Contado de ${b.nombre}`)).toHaveCount(0);

    // Cantidad inválida: foco en el primer campo inválido, descrito por un texto corto.
    await page.keyboard.type("x");
    await page.getByRole("button", { name: /Revisar diferencias/ }).click();
    await expect(cantidad).toBeFocused();
    await expect(cantidad).toHaveAttribute("aria-invalid", "true");
    await expect(cantidad).toHaveAccessibleDescription("Entero, o con coma si es kg");

    // Revisión: el foco va al encabezado; al volver, al botón.
    await cantidad.fill("4");
    await page.getByRole("button", { name: /Revisar diferencias/ }).click();
    const titulo = page.getByRole("heading", { name: "Revisión del conteo" });
    await expect(titulo).toBeFocused();
    await page.getByRole("button", { name: "Volver a contar" }).click();
    await expect(page.getByRole("button", { name: /Revisar diferencias/ })).toBeFocused();
    await page.getByRole("button", { name: /Revisar diferencias/ }).click();
    await expect(titulo).toBeFocused();

    // Enter en el motivo envía; el foco va al mensaje de éxito y "Sistema" muestra lo recién contado.
    await page.getByLabel("Motivo").fill("Cierre del día");
    await page.getByLabel("Motivo").press("Enter");
    const exito = page.getByRole("status").filter({ hasText: "Conteo registrado: 1 ajuste(s)" });
    await expect(exito).toBeVisible();
    await expect(exito).toBeFocused();
    await expect(page.getByRole("list", { name: "Productos a contar" })).toContainText(
      "Sistema: 4",
    );
  });

  test("Buscar con el mismo texto reintenta tras un error de carga", async ({ page }) => {
    const a = await crearProducto();
    await ir(page, "/panel/inventario/conteo");
    let fallar = true;
    await page.route("**/panel/inventario/conteo", (route) => {
      const pideLista =
        route.request().method() === "POST" && route.request().postData()?.includes('"pagina"');
      return pideLista && fallar ? route.abort("connectionreset") : route.continue();
    });
    await page.getByRole("searchbox", { name: "Buscar" }).fill(a.codigo);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos conectar" })).toBeVisible();
    fallar = false;
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByLabel(`Contado de ${a.nombre}`)).toBeVisible();
  });

  test("al volver a una ubicación no muestra la lista vieja mientras llega la nueva", async ({
    page,
  }) => {
    await ir(page, "/panel/inventario/conteo");
    const lista = page.getByRole("list", { name: "Productos a contar" });
    const cargando = page.getByRole("status").filter({ hasText: "Cargando productos" });
    await page.getByLabel("Ubicación a contar").selectOption({ label: "Tienda" });
    await expect(lista).toBeVisible();
    await expect(cargando).toHaveCount(0);
    // Las acciones de servidor se encolan: Depósito queda en vuelo y Tienda espera detrás.
    let retener = false;
    let soltar!: () => void;
    const puerta = new Promise<void>((r) => (soltar = r));
    await page.route("**/panel/inventario/conteo", async (route) => {
      if (retener && route.request().postData()?.includes('"pagina"')) await puerta;
      return route.continue();
    });
    retener = true;
    await page.getByLabel("Ubicación a contar").selectOption({ label: "Depósito" });
    await page.getByLabel("Ubicación a contar").selectOption({ label: "Tienda" });
    await expect(cargando).toBeVisible();
    await expect(lista).toHaveCount(0);
    soltar();
    await expect(lista).toBeVisible();
  });
});

test.describe("traslado: stock del origen", () => {
  async function conStock() {
    const p = await crearProducto();
    await entradaApi(p, (await ubicaciones()).tienda, 2);
    return p;
  }

  test("si no se pudo leer el stock, avisa y deja trasladar sin inventar un 0", async ({
    page,
  }) => {
    const p = await conStock();
    await ir(page, "/panel/inventario/traslado");
    // Solo la lectura falla: el traslado en sí también lleva `productoId`.
    let fallar = true;
    await page.route("**/panel/inventario/traslado", (route) =>
      fallar && route.request().method() === "POST" && esLecturaDeStock(route.request().postData())
        ? route.abort("connectionreset")
        : route.continue(),
    );
    await elegir(page, p);
    await expect(
      page.getByRole("status").filter({ hasText: "No se pudo leer el stock del origen" }),
    ).toBeVisible();
    fallar = false;
    await page.getByLabel("Origen").selectOption({ label: "Tienda" });
    await page.getByLabel("Destino").selectOption({ label: "Depósito" });
    await page.getByLabel("Cantidad").fill("9"); // más que el stock real (2): sin dato no hay aviso de sobre-stock
    await page.getByRole("button", { name: "Registrar traslado" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Traslado registrado" })).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("mientras lee el stock no se puede enviar", async ({ page }) => {
    const p = await conStock();
    await ir(page, "/panel/inventario/traslado");
    let soltar!: () => void;
    const puerta = new Promise<void>((r) => (soltar = r));
    await page.route("**/panel/inventario/traslado", async (route) => {
      if (route.request().method() === "POST" && esLecturaDeStock(route.request().postData()))
        await puerta;
      return route.continue();
    });
    await elegir(page, p);
    await expect(page.getByRole("status").filter({ hasText: "Leyendo el stock" })).toBeVisible();
    await page.getByLabel("Origen").selectOption({ label: "Tienda" });
    await page.getByLabel("Destino").selectOption({ label: "Depósito" });
    await page.getByLabel("Cantidad").fill("1");
    await expect(page.getByRole("button", { name: "Registrar traslado" })).toBeDisabled();
    await page.getByLabel("Cantidad").press("Enter");
    soltar();
    await expect(page.getByRole("status").filter({ hasText: "Stock actual" })).toBeVisible();
    const r = await apiComo("dueno", `stock?select=cantidad&producto_id=eq.${p.id}`);
    expect(r.json).toEqual([{ cantidad: 2 }]);
  });
});

test.describe("negocio con una sola ubicación", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("el traslado pide al menos 2 ubicaciones y no muestra el formulario", async ({ page }) => {
    await ir(page, "/panel/inventario/traslado");
    await expect(page.getByText("Hace falta al menos 2 ubicaciones")).toBeVisible();
    await expect(page.getByRole("form", { name: "Registrar traslado" })).toHaveCount(0);
    await ir(page, "/panel/inventario/entrada");
    await expect(page.getByRole("form", { name: "Registrar entrada" })).toBeVisible();
  });
});
