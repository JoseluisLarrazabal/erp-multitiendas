import { expect, test, type Page } from "@playwright/test";
import { rutaAuth } from "./helpers";
import {
  abrirCajaL1Api,
  anularOrdenApi,
  cerrarCajaL1,
  crearOrdenApi,
  equipoL1,
  eventosDeOrden,
  fijarEquipoL1,
  ordenesPorId,
  resumenCajaL1,
  revisarPendientesL1,
  sesionAbiertaL1,
  ventasDeLaCajaL1,
} from "./pos-helpers";

// Fase 4, PR 2: POS de lavandería. El encargado opera la caja del equipo L1 (única): las pruebas corren en serie.
test.use({ storageState: rutaAuth("encargadoLavanderia") });
test.describe.configure({ mode: "serial" });

let equipoId = "";
let creadas: string[] = [];
test.beforeEach(async ({ page }) => {
  equipoId = (await equipoL1()).id;
  creadas = [];
  await cerrarCajaL1(equipoId);
  await fijarEquipoL1(page, equipoId);
});
test.afterEach(async () => {
  await cerrarCajaL1(equipoId);
  // Con la caja cerrada la anulación no toca la venta, y la revisión (que una venta anulada no admite) va antes.
  await revisarPendientesL1();
  // Las órdenes de prueba no se borran: se anulan para que no se acumulen entre corridas.
  for (const id of creadas) await anularOrdenApi(id);
});

async function abrirCajaPorUI(page: Page, monto: string) {
  await page.goto("/pos");
  await page.getByLabel("Efectivo inicial (Bs)").fill(monto);
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
}

async function agregarPorCodigo(page: Page, codigo: string) {
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill(codigo);
  await page.keyboard.press("Enter");
}

async function ficha(page: Page, datos: { prendas: string; casillero?: string }) {
  await page.getByLabel("Prendas", { exact: true }).fill(datos.prendas);
  if (datos.casillero) await page.getByLabel("Casillero (opcional)").fill(datos.casillero);
}

async function abrirCobro(page: Page) {
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  return page.getByRole("alertdialog", { name: "Cobrar venta" });
}

const boleta = (page: Page) => page.getByRole("article", { name: /^Boleta L1-\d{6}$/ });
const filaOrden = (page: Page, numero: string) =>
  page.getByRole("listitem", { name: `Orden ${numero}`, exact: true });

test("E2E-09: recepción con cliente, cobro mixto, boleta, en lavado, lista y entrega con carnet", async ({
  page,
}) => {
  await abrirCajaPorUI(page, "100");
  await expect(page.getByRole("tab", { name: "Nueva orden" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Cliente obligatorio: sin él, el cobro dice por qué.
  await agregarPorCodigo(page, "SRV-001");
  await agregarPorCodigo(page, "SRV-001");
  await expect(page.getByLabel("Cantidad de Lavado de prenda")).toHaveValue("2");
  await expect(page.getByTestId("total")).toHaveText("Bs 30,00");
  await expect(page.getByText("Esta venta necesita un cliente.")).toBeVisible();
  await page.getByRole("button", { name: "Elegir" }).click();
  await page.getByRole("textbox", { name: "Buscar cliente" }).fill("Cliente Lavandería");
  await page.getByRole("button", { name: /Cliente Lavandería Demo/ }).click();

  // Express reprecia todas las líneas (2 x 25). Sin prendas todavía no se cobra.
  await page.getByRole("switch", { name: "Express" }).check();
  await expect(page.getByTestId("total")).toHaveText("Bs 50,00");
  await expect(page.getByText("Indica cuántas prendas son (de 1 a 999).")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeDisabled();
  await ficha(page, { prendas: "3", casillero: "A1" });

  const cobro = await abrirCobro(page);
  await cobro.getByLabel("Pago por QR (Bs)").fill("20");
  await cobro.getByLabel(/Confirmo que recibí/).check();
  await cobro.getByLabel("Efectivo recibido (Bs)").fill("30");
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();

  const b = boleta(page);
  await expect(b).toBeVisible();
  await expect(b).toContainText("BOLETA L1-");
  await expect(b).toContainText("Cliente Lavandería Demo");
  await expect(b).toContainText("Casillero:A1");
  await expect(b).toContainText("Prendas:3");
  await expect(b).toContainText("Express:Sí");
  await expect(b).toContainText("Bs 50,00");
  const numero = (await b.getAttribute("aria-label"))!.replace("Boleta ", "");

  const [venta] = await ventasDeLaCajaL1(equipoId);
  expect(venta).toMatchObject({ numero, total: 50, estado: "completada", origen: "online" });
  creadas.push(venta!.id);
  const resumen = await resumenCajaL1(equipoId);
  expect(resumen).toMatchObject({ esperado: 130, qr_neto: 20, cantidad_ventas: 1 });
  expect(await ordenesPorId(venta!.id)).toMatchObject([
    {
      estado: "recibida",
      cliente_nombre: "Cliente Lavandería Demo",
      prendas: 3,
      casillero: "A1",
      express: true,
    },
  ]);

  // Órdenes: avanzar, avanzar, entregar con carnet.
  await page.getByRole("tab", { name: "Órdenes" }).click();
  const fila = filaOrden(page, numero);
  await expect(fila).toContainText("Recibida");
  await fila.getByRole("button", { name: /^Pasar a En lavado/ }).click();
  await expect(fila).toContainText("En lavado");
  await fila.getByRole("button", { name: /^Pasar a Lista/ }).click();
  await expect(fila).toContainText("Lista");
  await expect(fila.getByRole("button", { name: /^Pasar a/ })).toHaveCount(0);
  await fila.getByRole("button", { name: /^Entregar/ }).click();

  const dialogo = page.getByRole("alertdialog", { name: `Entregar ${numero}` });
  await dialogo.getByLabel("Quién retira", { exact: true }).fill("Pedro Pérez");
  await dialogo.getByLabel("Con carnet").check();
  // El carnet exige el documento.
  await dialogo.getByRole("button", { name: "Entregar" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("Escribe el documento");
  await dialogo.getByLabel("Documento").fill("1234567");
  await dialogo.getByRole("button", { name: "Entregar" }).click();
  await expect(page.getByText(`Orden ${numero} entregada.`)).toBeVisible();
  await expect(filaOrden(page, numero)).toHaveCount(0);

  expect(await ordenesPorId(venta!.id)).toMatchObject([
    {
      estado: "entregada",
      retirada_por: "Pedro Pérez",
      retiro_con: "carnet",
      documento_retiro: "1234567",
    },
  ]);
  expect(await eventosDeOrden(venta!.id)).toEqual(["recibida", "en_lavado", "lista", "entregada"]);
});

test("orden sin conexión: nombre escrito, boleta con aviso y al volver la red queda una sola con sin_cliente", async ({
  page,
  context,
}) => {
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, "SRV-002");
  await expect(page.getByTestId("total")).toHaveText("Bs 10,00");
  await context.setOffline(true);

  // Sin red no hay selector: nombre y teléfono escritos, y sin nombre no se cobra.
  await expect(page.getByText("Sin conexión: escribe los datos del cliente.")).toBeVisible();
  await ficha(page, { prendas: "2" });
  await expect(page.getByText("Escribe el nombre del cliente.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeDisabled();
  await page.getByLabel("Nombre", { exact: true }).fill("Ana Mostrador");
  await page.getByLabel("Teléfono (opcional)").fill("71234567");
  await (await abrirCobro(page)).getByRole("button", { name: "Confirmar cobro" }).click();

  const b = boleta(page);
  await expect(b).toBeVisible();
  await expect(b).toContainText("Ana Mostrador");
  await expect(b).toContainText("71234567");
  await expect(
    page.getByRole("status").filter({ hasText: /guardada en este equipo/ }),
  ).toBeVisible();
  await expect(page.getByText("1 venta sin enviar")).toBeVisible();

  // Las órdenes necesitan conexión.
  await page.getByRole("tab", { name: "Órdenes" }).click();
  await expect(page.getByText("Las órdenes necesitan conexión.")).toBeVisible();

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();
  await expect(page.getByText("1 venta sin enviar")).toHaveCount(0, { timeout: 15_000 });

  const ventas = await ventasDeLaCajaL1(equipoId);
  expect(ventas).toHaveLength(1);
  const [venta] = ventas;
  expect(venta).toMatchObject({ total: 10, origen: "offline" });
  expect(venta!.motivos_revision).toContain("sin_cliente");
  creadas.push(venta!.id);
  expect(await ordenesPorId(venta!.id)).toMatchObject([
    {
      estado: "recibida",
      cliente_nombre: "Ana Mostrador",
      cliente_telefono: "71234567",
      prendas: 2,
    },
  ]);
});

test("orden con nombre escrito sin red, red de vuelta antes de confirmar: el servidor la acepta como offline", async ({
  page,
  context,
}) => {
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, "SRV-002");
  await context.setOffline(true);
  await ficha(page, { prendas: "2" });
  await page.getByLabel("Nombre", { exact: true }).fill("Ana Mostrador");
  const cobro = await abrirCobro(page);
  await context.setOffline(false);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();

  await expect(boleta(page)).toContainText("Ana Mostrador");
  await expect(page.getByText(/rechazada/i)).toHaveCount(0);
  await expect(page.getByText("1 venta sin enviar")).toHaveCount(0, { timeout: 15_000 });
  const ventas = await ventasDeLaCajaL1(equipoId);
  expect(ventas).toHaveLength(1);
  const [venta] = ventas;
  expect(venta).toMatchObject({ total: 10, origen: "offline" });
  expect(venta!.motivos_revision).toContain("sin_cliente");
  creadas.push(venta!.id);
  expect(await ordenesPorId(venta!.id)).toHaveLength(1);
});

test("anular con la caja abierta devuelve el efectivo y lo dice", async ({ page }) => {
  await abrirCajaL1Api(equipoId);
  const cajaId = (await sesionAbiertaL1(equipoId))!;
  const id = await crearOrdenApi({ equipoId, cajaId });
  creadas.push(id);
  expect(await resumenCajaL1(equipoId)).toMatchObject({ esperado: 115 });
  const [venta] = await ventasDeLaCajaL1(equipoId);

  await page.goto("/pos");
  await page.getByRole("tab", { name: "Órdenes" }).click();
  const fila = filaOrden(page, venta!.numero);
  await fila.getByRole("button", { name: /^Anular/ }).click();
  const dialogo = page.getByRole("alertdialog", { name: `¿Anular la orden ${venta!.numero}?` });
  await dialogo.getByRole("button", { name: "Anular orden" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("Escribe el motivo");
  await dialogo.getByLabel("Motivo").fill("Cliente se arrepintió");
  await dialogo.getByRole("button", { name: "Anular orden" }).click();

  await expect(page.getByText("Se devolvió el efectivo de la caja.")).toBeVisible();
  await expect(filaOrden(page, venta!.numero)).toHaveCount(0);
  expect(await ordenesPorId(id)).toMatchObject([
    { estado: "cancelada", motivo_anulacion: "Cliente se arrepintió" },
  ]);
  expect(await resumenCajaL1(equipoId)).toMatchObject({ esperado: 100 });
});

test("anular con la caja ya cerrada no toca el dinero y manda a Ventas", async ({ page }) => {
  await abrirCajaL1Api(equipoId);
  const id = await crearOrdenApi({ equipoId, cajaId: (await sesionAbiertaL1(equipoId))! });
  creadas.push(id);
  const [venta] = await ventasDeLaCajaL1(equipoId);
  await cerrarCajaL1(equipoId);
  await abrirCajaL1Api(equipoId);

  await page.goto("/pos");
  await page.getByRole("tab", { name: "Órdenes" }).click();
  await filaOrden(page, venta!.numero)
    .getByRole("button", { name: /^Anular/ })
    .click();
  const dialogo = page.getByRole("alertdialog", { name: `¿Anular la orden ${venta!.numero}?` });
  await dialogo.getByLabel("Motivo").fill("Duplicada");
  await dialogo.getByRole("button", { name: "Anular orden" }).click();
  await expect(page.getByText(/La caja de esa orden ya cerró/)).toBeVisible();
  expect(await ordenesPorId(id)).toMatchObject([{ estado: "cancelada" }]);
});
