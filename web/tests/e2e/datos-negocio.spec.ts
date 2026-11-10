import { expect, test } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, fijarEquipo, tienda } from "./pos-helpers";

// RF-VEN-05 / RF-LAV-03: el NIT y los datos del negocio se editan en /panel/negocio y salen en la nota.
// Equipo propio (W7): ningún otro spec usa su caja. Se restituye el negocio a sin datos al terminar.
test.describe.configure({ mode: "serial" });

let equipoId = "";
let cajaId = "";
const nit = `NIT${corrida}`.slice(0, 20);
const direccion = `Av. Prueba ${corrida}`;

test.beforeAll(async () => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W7", "Caja de datos del negocio");
  equipoId = equipo.id;
  cajaId = await abrirCaja(tienda, equipo);
});
test.afterAll(async () => {
  await apiComo("dueno", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
  });
  await apiComo("dueno", "rpc/guardar_datos_negocio", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_nit: null, p_datos_nota: null },
  });
});

test.describe("dueño", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("guarda NIT y dirección, y la nota de una venta los muestra", async ({ page, browser }) => {
    await page.goto("/panel/negocio");
    await page.getByLabel("NIT", { exact: true }).fill("x".repeat(21));
    await page.getByRole("button", { name: "Guardar datos" }).click();
    await expect(page.getByText(/hasta 20 caracteres/)).toBeVisible();

    await page.getByLabel("NIT", { exact: true }).fill(nit);
    await page.getByLabel("Datos para la nota").fill(`${direccion}\nTel. 70000000`);
    await page.getByRole("button", { name: "Guardar datos" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Datos guardados." })).toBeVisible();

    const producto = await crearProductoConPrecio({ contado: 20, stock: 5 });
    const contexto = await browser.newContext({ storageState: rutaAuth("vendedor") });
    try {
      const caja = await contexto.newPage();
      await fijarEquipo(caja, equipoId);
      await caja.goto("/pos");
      await expect(caja.getByText(/productos en el catálogo/)).toBeVisible();
      const buscar = caja.getByRole("searchbox", { name: "Buscar producto" });
      await buscar.fill(producto.nombre);
      await caja.getByRole("button", { name: `Agregar ${producto.nombre}` }).click();
      await caja
        .getByRole("button", { name: /^Cobrar/ })
        .first()
        .click();
      const cobro = caja.getByRole("alertdialog", { name: "Cobrar venta" });
      await cobro.getByLabel("Efectivo recibido (Bs)").fill("20");
      await cobro.getByRole("button", { name: "Confirmar cobro" }).click();

      const nota = caja.getByRole("article", { name: /Nota de venta/ });
      await expect(nota).toBeVisible();
      await expect(nota.getByText(`NIT ${nit}`)).toBeVisible();
      await expect(nota.getByText(direccion)).toBeVisible();
    } finally {
      await contexto.close();
    }
  });
});

test.describe("encargado sin permiso `usuarios`", () => {
  test.use({ storageState: rutaAuth("encargadoTienda") });

  test("no entra a la página y vuelve al inicio del panel", async ({ page }) => {
    await page.goto("/panel/negocio");
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole("link", { name: "Datos del negocio" })).toHaveCount(0);
  });
});
