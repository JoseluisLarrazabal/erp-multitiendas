import { expect, test, type Page } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, fijarEquipo, tienda } from "./pos-helpers";

// RNF-16: un error inesperado de RPC se registra (sin query en la ruta); un rechazo ERP_* no.
// Equipo propio (E1): ningún otro spec usa su caja. La RPC interceptada es crear_reserva, que corre en el navegador.
test.use({ storageState: rutaAuth("vendedor") });
test.describe.configure({ mode: "serial" });

let equipoId = "";
let cajaId = "";
const nombreCliente = `Cliente errores ${corrida}`;

test.beforeAll(async () => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "E1", "Caja de errores");
  equipoId = equipo.id;
  cajaId = await abrirCaja(tienda, equipo);
  await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_datos: { nombre: nombreCliente } },
  });
});
test.afterAll(async () => {
  await apiComo("dueno", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
  });
});

async function llenarReserva(page: Page) {
  const producto = await crearProductoConPrecio({ contado: 50, minimo: 40, stock: 10 });
  await fijarEquipo(page, equipoId);
  await page.goto("/pos");
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
  await page.getByRole("button", { name: "Reservas" }).click();
  const form = page.getByRole("form", { name: "Nueva reserva" });
  await form.getByRole("button", { name: "Elegir" }).click();
  await form.getByRole("textbox", { name: "Buscar cliente" }).fill(nombreCliente);
  await form.getByRole("button", { name: new RegExp(nombreCliente) }).click();
  await form.getByRole("searchbox", { name: "Producto" }).fill(producto.codigo);
  await form.getByRole("button", { name: new RegExp(producto.nombre) }).click();
  await form.getByLabel("Cantidad").fill("1");
  await form.getByLabel("Precio acordado (Bs)").fill("50");
  await form.getByLabel("Anticipo (Bs)").fill("10");
  return form;
}

test("un error inesperado de RPC se registra con origen rpc y sin query en la ruta", async ({
  page,
}) => {
  const form = await llenarReserva(page);
  await page.route("**/rest/v1/rpc/crear_reserva", (route) =>
    route.fulfill({
      status: 500,
      json: { code: "XX000", message: "fallo simulado", details: null, hint: null },
    }),
  );
  const registro = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/rpc/registrar_error") && r.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  const respuesta = await registro;
  expect(respuesta.status()).toBeLessThan(300);
  const cuerpo = respuesta.request().postDataJSON() as {
    p_origen: string;
    p_contexto: { ruta: string };
  };
  expect(cuerpo.p_origen).toBe("rpc");
  expect(cuerpo.p_contexto.ruta).toBe("/pos");
  expect(cuerpo.p_contexto.ruta).not.toContain("?");
});

test("un rechazo ERP_ no se registra", async ({ page }) => {
  const registros: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/rpc/registrar_error")) registros.push(r.url());
  });
  const form = await llenarReserva(page);
  await page.route("**/rest/v1/rpc/crear_reserva", (route) =>
    route.fulfill({ status: 400, json: { code: "P0001", message: "ERP_STOCK_INSUFICIENTE" } }),
  );
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(form.getByRole("alert")).toContainText("No hay stock suficiente para reservar");
  // Margen para que una petición de registro, si existiera, llegue a salir.
  await page.waitForTimeout(1000);
  expect(registros).toHaveLength(0);
});
