import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { apiComo, ir, rutaAuth } from "./helpers";
import {
  corrida,
  crearProducto,
  entradaApi,
  fila,
  tienda,
  ubicaciones,
  type Producto,
} from "./inventario-helpers";

// RF-INV-*, RF-CAT-03 y E2E-03 (costos por rol). Cada prueba crea sus propios productos por PostgREST con la sesión
// guardada del dueño (código, nombre y barras únicos por corrida): no depende del orden ni de lo que dejó otra.
// Reutilizan las sesiones de auth.setup, sin logins nuevos.
async function elegirProducto(page: Page, p: Producto) {
  await page.getByRole("combobox", { name: "Producto" }).fill(p.codigo);
  await page.getByRole("option", { name: new RegExp(p.nombre) }).click();
  await expect(page.getByLabel("Cantidad")).toBeFocused();
}

test.describe("dueño: inventario", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("entrada con costo sube el stock y aparece en el kardex; el lector elige el producto exacto", async ({
    page,
  }) => {
    const p = await crearProducto();
    await ir(page, "/panel/inventario/entrada");
    // Lector simulado: el selector arranca enfocado, se teclea el código de barras y Enter pasa a la cantidad.
    await expect(page.getByRole("combobox", { name: "Producto" })).toBeFocused();
    await page.keyboard.type(p.barras);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Cantidad")).toBeFocused();
    await expect(page.getByRole("form", { name: "Registrar entrada" })).toContainText(p.nombre);

    await page.getByLabel("Ubicación").selectOption({ label: "Tienda" });
    await page.getByLabel("Cantidad").fill("5");
    await page.getByLabel("Costo unitario en Bs (opcional)").fill("12,5");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Entrada registrada: 5" }),
    ).toBeVisible();

    await ir(page, `/panel/inventario?q=${p.codigo}`);
    const f = fila(page, p);
    await expect(f).toHaveCount(1);
    await expect(f).toContainText("5");
    await expect(f).toContainText("Bs 62,50");

    await f.getByRole("link", { name: p.nombre }).click();
    await expect(page.getByRole("heading", { name: p.nombre, level: 1 })).toBeVisible();
    const kardex = page.getByRole("list", { name: "Movimientos" });
    await expect(kardex.getByRole("listitem")).toHaveCount(1);
    await expect(kardex).toContainText("Entrada");
    await expect(kardex).toContainText("+5");
    await expect(kardex).toContainText("Costo Bs 12,50");
    // Solo lectura: nada para editar o borrar un movimiento.
    await expect(kardex.getByRole("button")).toHaveCount(0);
    await expect(kardex.getByRole("link")).toHaveCount(0);
  });

  test("la salida exige motivo y descuenta el stock", async ({ page }) => {
    const p = await crearProducto();
    const u = await ubicaciones();
    await entradaApi(p, u.tienda, 5);
    await ir(page, "/panel/inventario/salida");
    await elegirProducto(page, p);
    await page.getByLabel("Ubicación").selectOption({ label: "Tienda" });
    await page.getByLabel("Cantidad").fill("2");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page.getByText("El motivo es obligatorio.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Motivo")).toBeFocused();

    await page.getByLabel("Motivo").fill("Se cayó al piso");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Movimiento registrado" }),
    ).toBeVisible();

    await ir(page, `/panel/inventario?q=${p.codigo}`);
    await expect(fila(page, p)).toContainText("3");
    await ir(page, `/panel/inventario/${p.id}`);
    await expect(page.getByRole("list", { name: "Movimientos" })).toContainText("Dañado");
    await expect(page.getByRole("list", { name: "Movimientos" })).toContainText("Se cayó al piso");
  });

  test("el traslado conserva el total y avisa antes de pasarse del origen", async ({ page }) => {
    const p = await crearProducto();
    const u = await ubicaciones();
    await entradaApi(p, u.tienda, 10);
    await ir(page, "/panel/inventario/traslado");
    await elegirProducto(page, p);
    await page.getByLabel("Origen").selectOption({ label: "Tienda" });
    await page.getByLabel("Destino").selectOption({ label: "Depósito" });
    await page.getByLabel("Cantidad").fill("4");
    await page.getByRole("button", { name: "Registrar traslado" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Traslado registrado" })).toBeVisible();
    await ir(page, `/panel/inventario?q=${p.codigo}`);
    // Tienda 6, Depósito 4, Total 10.
    for (const [etiqueta, n] of [
      ["Tienda", "6"],
      ["Depósito", "4"],
      ["Total", "10"],
    ]) {
      await expect(fila(page, p).locator("p").filter({ hasText: etiqueta })).toContainText(n!);
    }

    // Pasarse del origen (queda con 6): se avisa, se permite y el stock queda negativo con texto.
    await ir(page, "/panel/inventario/traslado");
    await elegirProducto(page, p);
    await page.getByLabel("Origen").selectOption({ label: "Tienda" });
    await page.getByLabel("Destino").selectOption({ label: "Depósito" });
    await page.getByLabel("Cantidad").fill("9");
    await page.getByRole("button", { name: "Registrar traslado" }).click();
    const aviso = page.getByRole("alertdialog");
    await expect(aviso).toContainText("supera el stock del origen");
    await aviso.getByRole("button", { name: "Trasladar igual" }).click();
    await expect(aviso).toBeHidden();
    await ir(page, `/panel/inventario?q=${p.codigo}`);
    await expect(fila(page, p)).toContainText("negativo");
    await expect(fila(page, p).locator("p").filter({ hasText: "Total" })).toContainText("10");
  });

  test("el conteo genera ajuste solo donde hay diferencia", async ({ page }) => {
    const a = await crearProducto();
    const b = await crearProducto();
    const u = await ubicaciones();
    await entradaApi(a, u.tienda, 5);
    await entradaApi(b, u.tienda, 3);
    await ir(page, "/panel/inventario/conteo");
    await page.getByLabel("Ubicación a contar").selectOption({ label: "Tienda" });
    await page.getByRole("searchbox", { name: "Buscar" }).fill(corrida);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByLabel(`Contado de ${a.nombre}`).fill("5");
    await page.getByLabel(`Contado de ${b.nombre}`).fill("2");
    await page.getByRole("button", { name: /Revisar diferencias \(2\)/ }).click();

    const diferencias = page.getByRole("list", { name: "Diferencias" });
    await expect(diferencias.getByRole("listitem")).toHaveCount(1);
    await expect(diferencias).toContainText(b.nombre);
    await expect(diferencias).toContainText("Faltan −1");
    await page.getByRole("button", { name: "Confirmar conteo" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1 ajuste(s)" })).toBeVisible();

    await ir(page, `/panel/inventario/${b.id}`);
    await expect(page.getByRole("list", { name: "Movimientos" })).toContainText("Ajuste");
    // M-13: el movimiento dice de qué conteo viene.
    await expect(page.getByRole("list", { name: "Movimientos" })).toContainText(
      /Ref\.: Conteo del \d{2}\/\d{2}\/\d{4}/,
    );
    await ir(page, `/panel/inventario/${a.id}`);
    await expect(page.getByRole("list", { name: "Movimientos" }).getByRole("listitem")).toHaveCount(
      1,
    );
  });

  test("un producto desactivado con stock se puede sacar y contar; sin stock no aparece", async ({
    page,
  }) => {
    const conStock = await crearProducto();
    const sinStock = await crearProducto();
    const u = await ubicaciones();
    await entradaApi(conStock, u.tienda, 3);
    for (const p of [conStock, sinStock]) {
      const r = await apiComo("dueno", "rpc/desactivar_producto", {
        metodo: "POST",
        cuerpo: { p_producto_id: p.id, p_activo: false },
      });
      expect(r.status).toBeLessThan(300);
    }
    await ir(page, "/panel/inventario/salida");
    const selector = page.getByRole("combobox", { name: "Producto" });
    await selector.fill(sinStock.codigo);
    await expect(page.getByText("Ningún producto coincide.")).toBeVisible();
    await selector.fill(conStock.codigo);
    await page
      .getByRole("option", { name: new RegExp(`${conStock.nombre} \\(inactivo\\)`) })
      .click();
    await page.getByLabel("Ubicación").selectOption({ label: "Tienda" });
    await page.getByLabel("Cantidad").fill("1");
    await page.getByLabel("Motivo").fill("Baja de producto inactivo");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Movimiento registrado" }),
    ).toBeVisible();

    await ir(page, "/panel/inventario/conteo");
    await page.getByLabel("Ubicación a contar").selectOption({ label: "Tienda" });
    await page.getByRole("searchbox", { name: "Buscar" }).fill(conStock.codigo);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByLabel(`Contado de ${conStock.nombre}`)).toBeVisible();
    await expect(page.getByText("(inactivo)").first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar" }).fill(sinStock.codigo);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByLabel(`Contado de ${sinStock.nombre}`)).toHaveCount(0);
  });

  test("stock bajo lista el producto bajo su mínimo y no el que está sobre él", async ({
    page,
  }) => {
    const bajo = await crearProducto({ stockMinimo: 5 });
    const sano = await crearProducto({ stockMinimo: 5 });
    const u = await ubicaciones();
    await entradaApi(bajo, u.tienda, 2);
    await entradaApi(sano, u.tienda, 9);
    await ir(page, `/panel/inventario?bajo=1&q=INV-${corrida}`);
    await expect(fila(page, bajo)).toContainText("Stock bajo");
    await expect(fila(page, sano)).toHaveCount(0);
  });

  test("reintento con el mismo UUID no duplica; el mismo UUID con otros datos se rechaza", async ({
    page,
  }) => {
    const p = await crearProducto();
    await ir(page, "/panel/inventario/entrada");
    await elegirProducto(page, p);
    await page.getByLabel("Ubicación").selectOption({ label: "Tienda" });
    // Se pierde la respuesta de la primera entrada (el servidor sí la procesó): el botón reintenta con el mismo UUID.
    let primera = true;
    await page.route("**/panel/inventario/entrada", async (route) => {
      if (route.request().method() === "POST" && primera) {
        primera = false;
        await route.fetch();
        return route.abort("connectionreset");
      }
      return route.continue();
    });
    await page.getByLabel("Cantidad").fill("5");
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos conectar" })).toBeVisible();
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Entrada registrada: 5" }),
    ).toBeVisible();

    await ir(page, `/panel/inventario/${p.id}`);
    await expect(page.getByRole("list", { name: "Movimientos" }).getByRole("listitem")).toHaveCount(
      1,
    );
    await ir(page, `/panel/inventario?q=${p.codigo}`);
    await expect(fila(page, p).locator("p").filter({ hasText: "Total" })).toContainText("5");

    // En la API: misma operación dos veces no suma; con otros datos da ERP_OPERACION_REPETIDA.
    const q = await crearProducto();
    const u = await ubicaciones();
    const operacion = randomUUID();
    expect((await entradaApi(q, u.tienda, 5, null, operacion)).status).toBeLessThan(300);
    expect((await entradaApi(q, u.tienda, 5, null, operacion)).status).toBeLessThan(300);
    const otra = await entradaApi(q, u.tienda, 7, null, operacion);
    expect(JSON.stringify(otra.json)).toContain("ERP_OPERACION_REPETIDA");
    const stock = await apiComo("dueno", `stock?select=cantidad&producto_id=eq.${q.id}`);
    expect(stock.json).toEqual([{ cantidad: 5 }]);
  });
});

// E2E-03: quién ve costos y quién entra a qué. Los datos los crea el dueño por API; cada cuenta usa su sesión guardada.
test.describe("E2E-03: costos y acceso por rol", () => {
  let p: Producto;
  test.beforeAll(async () => {
    p = await crearProducto();
    expect((await entradaApi(p, (await ubicaciones()).tienda, 5, 12.5)).status).toBeLessThan(300);
  });

  for (const cuenta of ["dueno"] as const) {
    test.describe(`${cuenta}`, () => {
      test.use({ storageState: rutaAuth(cuenta) });

      test("ve el valor del stock y el costo en el kardex", async ({ page }) => {
        await ir(page, `/panel/inventario?q=${p.codigo}`);
        await expect(fila(page, p)).toContainText("Bs 62,50");
        await ir(page, `/panel/inventario/${p.id}`);
        await expect(page.getByRole("list", { name: "Movimientos" })).toContainText(
          "Costo Bs 12,50",
        );
      });

      test("lee los costos por API", async () => {
        const r = await apiComo(cuenta, "rpc/costos_stock", {
          metodo: "POST",
          cuerpo: { p_negocio_id: tienda, p_producto_ids: [p.id] },
        });
        expect(r.status).toBe(200);
        expect(JSON.stringify(r.json)).toContain("12.5");
      });
    });
  }

  test.describe("vendedor", () => {
    test.use({ storageState: rutaAuth("vendedor") });

    test("/panel/inventario lo manda al POS", async ({ page }) => {
      await page.goto("/panel/inventario");
      await expect(page).toHaveURL(/\/pos$/);
    });

    test("no lee costos ni por API", async () => {
      for (const ruta of [
        "stock?select=costo_promedio&limit=1",
        "movimientos_inventario?select=costo_unitario&limit=1",
        "stock?select=*&limit=1",
      ]) {
        const r = await apiComo("vendedor", ruta);
        expect(r.status, ruta).toBeGreaterThanOrEqual(400);
        expect(JSON.stringify(r.json), ruta).toContain("42501");
      }
      const costos = await apiComo("vendedor", "rpc/costos_stock", {
        metodo: "POST",
        cuerpo: { p_negocio_id: tienda, p_producto_ids: [p.id] },
      });
      expect(JSON.stringify(costos.json)).toContain("ERP_SIN_PERMISO");
      const kardex = await apiComo("vendedor", "rpc/kardex_producto", {
        metodo: "POST",
        cuerpo: { p_producto_id: p.id, p_limite: 5 },
      });
      expect(JSON.stringify(kardex.json)).toContain("ERP_SIN_PERMISO");
    });
  });
});
