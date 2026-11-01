import { expect, test, type Page } from "@playwright/test";
import { apiComo, NEGOCIOS, rutaAuth } from "./helpers";
import { corrida } from "./inventario-helpers";
import {
  abrirCajaApi,
  cerrarCaja,
  crearProductoConPrecio,
  equipoC1,
  estadoDeSerie,
  fijarEquipo,
  liberarCliente,
  registrarSeries,
  sesionAbierta,
  stockEn,
  tienda,
  venderApi,
  ventasDeLaCaja,
} from "./pos-helpers";
import { MAX_NUMERO_DUPLICADO } from "../../src/modules/ventas/use-envio";

// E2E-04 y E2E-08 comparten archivo a propósito: el equipo C1 y su caja son únicos, y los archivos corren en paralelo.
// Sesión guardada del vendedor (rol sin `descontar`, con `vender` y `caja`). Un solo equipo (C1) y una sola caja:
// las pruebas de este archivo corren en serie.
test.use({ storageState: rutaAuth("vendedor") });
test.describe.configure({ mode: "serial" });

let equipoId = "";
test.beforeEach(async ({ page }) => {
  const equipo = await equipoC1();
  equipoId = equipo.id;
  await cerrarCaja(equipoId);
  await fijarEquipo(page, equipoId);
  await page.addInitScript(() => {
    (window as unknown as { impresiones: number }).impresiones = 0;
    window.print = () => {
      (window as unknown as { impresiones: number }).impresiones += 1;
    };
  });
});
test.afterEach(async () => {
  await cerrarCaja(equipoId);
});

async function abrirCajaPorUI(page: Page, monto: string) {
  await page.goto("/pos");
  await page.getByLabel("Efectivo inicial (Bs)").fill(monto);
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();
  // Con el catálogo sin cargar, Enter no agrega nada: se espera antes de escanear.
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
}

test("E2E-04: venta con conexión, pago mixto, nota y stock en base", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 50, stock: 10, garantiaMeses: 6 });
  const b = await crearProductoConPrecio({ contado: 30, stock: 5 });

  await abrirCajaPorUI(page, "100");
  const buscar = page.getByRole("searchbox", { name: "Buscar producto" });
  await expect(buscar).toBeFocused();

  // Lector: código exacto + Enter agrega y deja el campo listo.
  await page.keyboard.type(a.barras);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Carrito" }).getByRole("listitem")).toHaveCount(1);
  await expect(buscar).toHaveValue("");
  await expect(buscar).toBeFocused();
  // Segundo escaneo del mismo producto suma cantidad.
  await page.keyboard.type(a.codigo);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(`Cantidad de ${a.nombre}`)).toHaveValue("2");
  // Por nombre y botón.
  await buscar.fill(b.nombre);
  await page.getByRole("button", { name: `Agregar ${b.nombre}` }).click();
  await expect(page.getByTestId("total")).toHaveText("Bs 130,00");

  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar venta" });
  await cobro.getByLabel("Pago por QR (Bs)").fill("50");
  // QR sin confirmar no cobra.
  await expect(cobro.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  await cobro.getByLabel(/Confirmo que recibí/).check();
  await cobro.getByLabel("Efectivo recibido (Bs)").fill("100");
  await expect(cobro.getByText("Bs 20,00", { exact: true })).toBeVisible(); // vuelto
  // Doble clic: una sola venta.
  await cobro.getByRole("button", { name: "Confirmar cobro" }).dblclick();

  const nota = page.getByRole("article", { name: /Nota de venta C1-\d{6}/ });
  await expect(nota).toBeVisible();
  await expect(nota.getByText("Garantía: 6 meses")).toBeVisible();
  await expect(nota.getByText("TOTAL")).toBeVisible();
  await expect(nota.getByText("Bs 130,00").first()).toBeVisible();
  await expect(nota.getByText("Vuelto")).toBeVisible();
  await page.getByRole("button", { name: "Imprimir" }).click();
  expect(
    await page.evaluate(() => (window as unknown as { impresiones: number }).impresiones),
  ).toBe(1);

  const numero = /C1-\d{6}/.exec((await nota.getAttribute("aria-label")) ?? "")![0];
  const cajaId = await sesionAbierta(equipoId);
  const ventas = await apiComo(
    "vendedor",
    `ventas?select=id,numero,total,estado,origen&caja_sesion_id=eq.${cajaId}`,
  );
  const filas = ventas.json as {
    id: string;
    numero: string;
    total: number;
    estado: string;
    origen: string;
  }[];
  expect(filas).toHaveLength(1);
  expect(filas[0]).toMatchObject({ numero, total: 130, estado: "completada", origen: "online" });
  const pagos = await apiComo(
    "vendedor",
    `venta_pagos?select=medio,monto,verificacion&venta_id=eq.${filas[0]!.id}&order=medio`,
  );
  expect(pagos.json).toEqual([
    { medio: "efectivo", monto: 80, verificacion: "no_aplica" },
    { medio: "qr", monto: 50, verificacion: "verificado" },
  ]);
  expect(await stockEn(a.id)).toBe(8);
  expect(await stockEn(b.id)).toBe(4);

  // Nueva venta: carrito limpio.
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await expect(page.getByText("El carrito está vacío.")).toBeVisible();
});

test("una falla de red conserva la venta y el reintento manda el mismo payload", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 20, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await page.keyboard.type(a.codigo);
  await page.keyboard.press("Enter");

  const cuerpos: string[] = [];
  let fallar = true;
  await page.route("**/rest/v1/rpc/registrar_venta", (route) => {
    cuerpos.push(route.request().postData() ?? "");
    if (fallar) {
      fallar = false;
      return route.abort("connectionfailed");
    }
    return route.continue();
  });

  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar venta" });
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro.getByRole("alert")).toContainText("Sin conexión");
  await expect(cobro.getByRole("alert")).toContainText("no se pierde");
  expect(await stockEn(a.id)).toBe(3);
  await cobro.getByRole("button", { name: "Reintentar envío" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();

  expect(cuerpos).toHaveLength(2);
  expect(cuerpos[1]).toBe(cuerpos[0]);
  expect(await stockEn(a.id)).toBe(2);
});

test("sin permiso de descuento el POS lo indica y no deja bajar del mínimo", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 100, minimo: 80, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await page.keyboard.type(a.codigo);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Sin permiso de descuento/)).toBeVisible();
  await expect(page.getByLabel(`Descuento de ${a.nombre}`)).toHaveCount(0);
  // Entre el piso y la lista no pide permiso.
  await page.getByLabel(`Precio de ${a.nombre}`).fill("90");
  await expect(page.getByTestId("total")).toHaveText("Bs 90,00");
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeEnabled();
  await page.getByLabel(`Precio de ${a.nombre}`).fill("70");
  await expect(page.getByText(/Bajo el mínimo/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeDisabled();
});

test("catálogo viejo: el servidor rechaza, el POS recarga y muestra los precios nuevos", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 100, minimo: 80, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await page.keyboard.type(a.codigo);
  await page.keyboard.press("Enter");
  await page.getByLabel(`Precio de ${a.nombre}`).fill("90");
  await expect(page.getByTestId("total")).toHaveText("Bs 90,00");

  // El dueño sube el mínimo a 95 mientras el cajero tiene el catálogo viejo: 90 queda bajo el piso.
  const r = await apiComo("dueno", "rpc/guardar_precios", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: tienda,
      p_items: [{ producto_id: a.id, moneda: "BOB", precios: { contado: 100, minimo: 95 } }],
    },
  });
  expect(r.status).toBeLessThan(300);

  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  await page
    .getByRole("alertdialog", { name: "Cobrar venta" })
    .getByRole("button", { name: "Confirmar cobro" })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: /permiso/ })).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  // El precio escrito no se borra: la validación local con el piso nuevo es la que lo marca. Sin venta registrada.
  await expect(page.getByLabel(`Precio de ${a.nombre}`)).toHaveValue(/^90/);
  await expect(page.getByText(/Bajo el mínimo \(95,00\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeDisabled();
  expect(await stockEn(a.id)).toBe(2);
});

test("consulta rápida muestra precios y stock sin tocar el carrito", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 45, stock: 7 });
  await abrirCajaPorUI(page, "0");
  await page.getByRole("button", { name: "Consulta rápida" }).click();
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill(a.codigo);
  const fila = page.getByRole("list", { name: "Resultados" }).getByRole("listitem");
  await expect(fila).toContainText("Bs 45,00");
  await expect(fila).toContainText("Tienda");
  await expect(fila.getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "Vender" }).click();
  await expect(page.getByText("El carrito está vacío.")).toBeVisible();
});

async function agregarPorCodigo(page: Page, codigo: string) {
  await page.keyboard.type(codigo);
  await page.keyboard.press("Enter");
}

async function abrirCobro(page: Page) {
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  return page.getByRole("alertdialog", { name: "Cobrar venta" });
}

// Tamaño de página del PDF que Chromium genera con el @page de la nota (preferCSSPageSize): puntos PDF.
async function medirPdf(page: Page) {
  const texto = (await page.pdf({ preferCSSPageSize: true })).toString("latin1");
  const caja = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(texto);
  const paginas = (texto.match(/\/Type\s*\/Page(?![\w])/g) ?? []).length;
  return { ancho: Number(caja?.[1]), alto: Number(caja?.[2]), paginas };
}

const MM = 72 / 25.4;

test("el PDF de la nota mide 80 mm (ticket) o A4 y no agrega páginas en blanco", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 15, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();

  await page.emulateMedia({ media: "print" });
  const ticket = await medirPdf(page);
  expect(ticket.ancho).toBeCloseTo(80 * MM, 0);
  expect(ticket.alto).toBeCloseTo(297 * MM, 0);
  expect(ticket.paginas).toBe(1);

  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "A4" }).click();
  await page.emulateMedia({ media: "print" });
  const a4 = await medirPdf(page);
  expect(a4.ancho).toBeCloseTo(210 * MM, 0);
  expect(a4.alto).toBeCloseTo(297 * MM, 0);
  expect(a4.paginas).toBe(1);
  console.log(`PDF ticket ${JSON.stringify(ticket)} · A4 ${JSON.stringify(a4)}`);
});

test("alta de cliente desde el POS, venta con él y duplicado al repetir el documento", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 10, stock: 5 });
  const documento = `cli${corrida.toLowerCase()}`;
  let clienteId: string | null = null;
  try {
    await abrirCajaPorUI(page, "0");
    await agregarPorCodigo(page, a.codigo);

    const abrirAlta = async () => {
      await page.getByRole("button", { name: "Elegir" }).click();
      await page.getByRole("button", { name: "Nuevo cliente" }).click();
    };
    await abrirAlta();
    await page.getByLabel("Nombre del cliente").fill(`Cliente ${corrida}`);
    await page.getByLabel("CI o NIT").fill(` ${documento} `);
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.getByText(`Cliente ${corrida} · ${documento.toUpperCase()}`)).toBeVisible();

    const cobro = await abrirCobro(page);
    await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
    const nota = page.getByRole("article", { name: /Nota de venta/ });
    await expect(nota).toBeVisible();
    await expect(nota.getByText(`Cliente ${corrida}`)).toBeVisible();

    const ventas = await ventasDeLaCaja(equipoId);
    expect(ventas).toHaveLength(1);
    clienteId = ventas[0]!.cliente_id;
    expect(clienteId).not.toBeNull();
    const fila = await apiComo(
      "dueno",
      `clientes?select=nombre,ci_nit&id=eq.${clienteId}&negocio_id=eq.${tienda}`,
    );
    expect(fila.json).toEqual([{ nombre: `Cliente ${corrida}`, ci_nit: documento.toUpperCase() }]);

    // Mismo documento escrito distinto: el servidor lo normaliza y rechaza; el POS busca por el documento normalizado.
    await page.getByRole("button", { name: "Nueva venta" }).click();
    await abrirAlta();
    await page.getByLabel("Nombre del cliente").fill(`Otro ${corrida}`);
    await page.getByLabel("CI o NIT").fill(documento.toUpperCase().replace(/(.{3})/, "$1 "));
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Ya existe un cliente/ })).toBeVisible();
    await expect(page.getByLabel("Buscar cliente")).toHaveValue(documento.toUpperCase());
    await expect(
      page.getByRole("list", { name: "Clientes encontrados" }).getByRole("button"),
    ).toContainText(`Cliente ${corrida}`);
  } finally {
    if (clienteId) await liberarCliente(clienteId);
  }
});

test("venta con serie: se elige la serie y queda vendida en base", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 200, stock: 2, controlaSerie: true });
  const series = [`S${corrida}A`, `S${corrida}B`];
  await registrarSeries(a.id, series);
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  // Sin serie no se cobra.
  await expect(page.getByText("Elige la serie")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeDisabled();
  await page.getByLabel("Serie").selectOption({ label: series[1]! });
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeEnabled();

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  const nota = page.getByRole("article", { name: /Nota de venta/ });
  await expect(nota).toBeVisible();
  await expect(nota.getByText(series[1]!)).toBeVisible();
  expect(await estadoDeSerie(a.id, series[1]!)).toBe("vendida");
  expect(await estadoDeSerie(a.id, series[0]!)).toBe("disponible");
  expect(await stockEn(a.id)).toBe(1);
});

test("venta en kg con decimales: total y stock exactos en base", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 18, stock: 5, unidad: "kg" });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  const cantidad = page.getByLabel(`Kg de ${a.nombre}`);
  await expect(cantidad).toHaveAttribute("inputmode", "decimal");
  await cantidad.fill("1,255");
  // 1,255 kg x Bs 18 = 22,59 (redondeado a centavos).
  await expect(page.getByTestId("total")).toHaveText("Bs 22,59");
  await cantidad.fill("1,2555");
  await expect(page.getByText(/Cantidad inválida/)).toBeVisible();
  await cantidad.fill("1,255");

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas).toHaveLength(1);
  expect(ventas[0]!.total).toBe(22.59);
  expect(await stockEn(a.id)).toBe(3.745);
});

test("envío en duda: el primer intento guarda pero la respuesta se corta; el segundo recibe un rechazo y no duplica", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 25, stock: 4 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);

  let llamadas = 0;
  await page.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    llamadas += 1;
    if (llamadas === 1) {
      await route.fetch(); // la base guarda la venta...
      return route.abort("connectionfailed"); // ...pero la respuesta no llega
    }
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: "P0001",
        message: "ERP_OPERACION_REPETIDA",
        details: null,
        hint: null,
      }),
    });
  });

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro.getByRole("alert")).toContainText("no se pierde");
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  await cobro.getByRole("button", { name: "Reintentar envío" }).click();

  // El rechazo con código de una venta en duda se comprueba contra la base: existe, así que es éxito, no error.
  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();
  expect(llamadas).toBe(2);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  expect(await stockEn(a.id)).toBe(3);
});

const cuerpoDuplicado = JSON.stringify({
  code: "P0001",
  message: "ERP_NUMERO_DUPLICADO",
  details: null,
  hint: null,
});
const ventaDe = (cuerpo: string) =>
  (JSON.parse(cuerpo) as { p_venta: { id: string; numero: string } }).p_venta;

test("número duplicado: el reintento conserva el id, toma el número siguiente y deja una sola venta", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 25, stock: 4 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);

  const cuerpos: string[] = [];
  await page.route("**/rest/v1/rpc/registrar_venta", (route) => {
    cuerpos.push(route.request().postData() ?? "");
    if (cuerpos.length === 1)
      return route.fulfill({ status: 400, contentType: "application/json", body: cuerpoDuplicado });
    return route.continue();
  });

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();

  expect(cuerpos).toHaveLength(2);
  const v1 = ventaDe(cuerpos[0] ?? "");
  const v2 = ventaDe(cuerpos[1] ?? "");
  expect(v2.id).toBe(v1.id);
  expect(Number(v2.numero.split("-")[1])).toBe(Number(v1.numero.split("-")[1]) + 1);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas).toHaveLength(1);
  expect(ventas[0]?.numero).toBe(v2.numero);
});

test("envío en duda con número duplicado: la venta ya se guardó, el reintento no renumera ni duplica", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 25, stock: 4 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);

  let llamadas = 0;
  await page.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    llamadas += 1;
    if (llamadas === 1) {
      await route.fetch(); // la base guarda la venta...
      return route.abort("connectionfailed"); // ...pero la respuesta no llega
    }
    return route.fulfill({ status: 400, contentType: "application/json", body: cuerpoDuplicado });
  });

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro.getByRole("alert")).toContainText("no se pierde");
  await cobro.getByRole("button", { name: "Reintentar envío" }).click();

  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();
  expect(llamadas).toBe(2);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  expect(await stockEn(a.id)).toBe(3);
});

test("número duplicado sin salida: agotados los reintentos el POS rechaza con el mensaje de numeración y no manda más", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 25, stock: 4 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);

  let llamadas = 0;
  await page.route("**/rest/v1/rpc/registrar_venta", (route) => {
    llamadas += 1;
    return route.fulfill({ status: 400, contentType: "application/json", body: cuerpoDuplicado });
  });

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro.getByRole("alert")).toContainText("No se pudo asignar un número de nota");
  expect(llamadas).toBe(MAX_NUMERO_DUPLICADO + 1);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(0);
});

test("descartar una venta que sí llegó al servidor termina como éxito con nota y no la duplica", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 25, stock: 4 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);

  await page.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    await route.fetch(); // la base guarda la venta...
    return route.abort("connectionfailed"); // ...pero la respuesta no llega
  });

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro.getByRole("alert")).toContainText("no se pierde");
  await cobro.getByRole("button", { name: "Descartar" }).click();

  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  expect(await stockEn(a.id)).toBe(3);
});

test("QR: cualquier cambio del monto borra la confirmación", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 40, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  const cobro = await abrirCobro(page);
  const confirmar = cobro.getByRole("button", { name: "Confirmar cobro" });
  const recibi = cobro.getByLabel(/Confirmo que recibí/);

  await cobro.getByLabel("Pago por QR (Bs)").fill("10");
  await recibi.check();
  await expect(confirmar).toBeEnabled();
  await cobro.getByLabel("Pago por QR (Bs)").fill("12");
  await expect(recibi).not.toBeChecked();
  await expect(confirmar).toBeDisabled();

  await recibi.check();
  await cobro.getByRole("button", { name: "Todo QR" }).click();
  await expect(cobro.getByLabel("Pago por QR (Bs)")).toHaveValue("40,00");
  await expect(recibi).not.toBeChecked();
  await expect(confirmar).toBeDisabled();
});

test("caja cerrada al cobrar: el POS pide abrirla y conserva el carrito", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 12, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await cerrarCaja(equipoId); // otra pestaña o un encargado la cierra

  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("heading", { name: /Abrir caja/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Carrito" }).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeDisabled();

  await page.getByLabel("Efectivo inicial (Bs)").fill("0");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByRole("heading", { name: /Abrir caja/ })).toHaveCount(0);
  const cobro2 = await abrirCobro(page);
  await cobro2.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();
  expect(await stockEn(a.id)).toBe(2);
});

test("un re-chequeo de sesión que falla no desmonta la venta en curso", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 9, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await page.route("**/auth/v1/user", (route) => route.abort("connectionfailed"));
  const fallo = page.waitForEvent("requestfailed", (r) => r.url().includes("/auth/v1/user"));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await fallo;
  await expect(page.getByText("No pudimos verificar tu sesión.")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Carrito" }).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();
});

test.describe("re-chequeo de fondo con varios negocios", () => {
  test.use({ storageState: rutaAuth("dueno") });
  test("conserva el negocio y el carrito aunque la cookie apunte a otro negocio", async ({
    page,
  }) => {
    const a = await crearProductoConPrecio({ contado: 9, stock: 2 });
    await abrirCajaPorUI(page, "0");
    await agregarPorCodigo(page, a.codigo);
    // Otra pestaña cambió la preferencia: el re-chequeo no debe seguirla ni remontar la venta.
    await page.evaluate((id) => {
      document.cookie = `negocio_activo=${id}; path=/`;
      window.dispatchEvent(new Event("online"));
    }, NEGOCIOS.lavanderia.id);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("list", { name: "Carrito" }).getByRole("listitem")).toHaveCount(1);
  });
});

// E2E-08 (RF-CAT-03, RNF-01): lector simulado por teclado con 2.000 productos activos y búsqueda bajo 200 ms.
// Los productos extra se crean con la sesión del dueño y se desactivan al terminar (el kardex impide borrarlos): un
// producto inactivo no entra al catálogo del POS.
const TOTAL = 2000;

test("E2E-08: lector por teclado y búsqueda bajo 200 ms con 2.000 productos", async ({
  page,
}, info) => {
  await abrirCajaApi(equipoId);

  // Tres productos vendibles con código de barras (los que se escanean) + relleno hasta 2.000.
  const escaneados = [
    await crearProductoConPrecio({ contado: 10, stock: 5 }),
    await crearProductoConPrecio({ contado: 20, stock: 5 }),
    await crearProductoConPrecio({ contado: 30, stock: 5 }),
  ];
  const ids: string[] = escaneados.map((p) => p.id);
  try {
    const relleno = async (n: number) => {
      const sufijo = String(n).padStart(4, "0");
      const r = await apiComo("dueno", "rpc/guardar_producto", {
        metodo: "POST",
        cuerpo: {
          p_negocio_id: tienda,
          p_datos: {
            codigo: `E8-${corrida}-${sufijo}`,
            nombre: `Relleno ${corrida} ${sufijo}`,
            tipo: "producto",
          },
        },
      });
      if (r.status >= 300) throw new Error(`No se creó el producto ${sufijo}: ${r.status}`);
      ids.push(r.json as string);
    };
    for (let n = 1; n <= TOTAL - escaneados.length; n += 20)
      await Promise.all(
        Array.from({ length: Math.min(20, TOTAL - escaneados.length - n + 1) }, (_, i) =>
          relleno(n + i),
        ),
      );

    await page.goto("/pos");
    const buscar = page.getByRole("searchbox", { name: "Buscar producto" });
    await expect(buscar).toBeVisible();
    await expect(page.getByText(/\d[\d.]* productos en el catálogo/)).toBeVisible();
    const enCatalogo = Number(
      (await page.getByText(/productos en el catálogo/).innerText()).replace(/\D+/g, ""),
    );
    expect(enCatalogo).toBeGreaterThanOrEqual(TOTAL);

    // Lector: tres códigos seguidos con Enter, sin tocar el ratón.
    for (const p of escaneados) {
      await page.keyboard.type(p.barras, { delay: 0 });
      await page.keyboard.press("Enter");
      await expect(buscar).toHaveValue("");
      await expect(buscar).toBeFocused();
    }
    await expect(page.getByRole("list", { name: "Carrito" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByTestId("total")).toHaveText("Bs 60,00");

    // Tiempo de búsqueda: desde el evento de entrada hasta que la lista está pintada (dos frames).
    const consultas = [
      `Relleno ${corrida} 1997`,
      `relleno ${corrida} 07`,
      `E8-${corrida}-1500`,
      "relleno",
      `Producto POS ${corrida}`,
    ];
    const tiempos = await page.evaluate(async (qs) => {
      const input = document.querySelector<HTMLInputElement>('input[type="search"]')!;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      const salida: number[] = [];
      for (const q of qs) {
        const t0 = performance.now();
        set.call(input, q);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        salida.push(performance.now() - t0);
        if (!document.querySelector('ul[aria-label="Resultados"] li'))
          throw new Error(`Sin resultados para ${q}`);
      }
      return salida;
    }, consultas);
    const maximo = Math.max(...tiempos);
    info.annotations.push({
      type: "busqueda-ms",
      description: tiempos.map((t) => t.toFixed(1)).join(", "),
    });
    console.log(
      `Búsqueda con ${enCatalogo} productos (ms): ${tiempos.map((t) => t.toFixed(1)).join(", ")}`,
    );
    expect(maximo).toBeLessThan(200);
  } finally {
    for (let i = 0; i < ids.length; i += 20)
      await Promise.all(
        ids.slice(i, i + 20).map((id) =>
          apiComo("dueno", "rpc/desactivar_producto", {
            metodo: "POST",
            cuerpo: { p_producto_id: id, p_activo: false },
          }),
        ),
      );
  }
});

// PR 4 de la fase 2: caja en /pos y ventas, devoluciones, cajas y clientes en /panel. Comparten el equipo C1 y su caja
// con todo lo de arriba, por eso viven en este archivo (en serie).
test("caja en /pos: movimientos, error por falta de efectivo y cierre con la diferencia correcta en base", async ({
  page,
}) => {
  await abrirCajaPorUI(page, "100");
  const sesionId = (await sesionAbierta(equipoId))!;
  await page.getByRole("button", { name: "Caja", exact: true }).click();

  const registrar = async (tipo: string, monto: string, motivo: string) => {
    await page.getByLabel("Tipo", { exact: true }).selectOption(tipo);
    await page.getByLabel("Monto (Bs)").fill(monto);
    await page.getByLabel("Motivo", { exact: true }).fill(motivo);
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
  };
  await registrar("ingreso", "20", "Cambio del banco");
  await expect(page.getByRole("status").filter({ hasText: "Ingreso registrado." })).toBeVisible();
  await registrar("gasto", "5,50", "Limpieza");
  await expect(
    page.getByRole("list", { name: "Movimientos registrados" }).getByRole("listitem"),
  ).toHaveCount(2);

  // Sin motivo o con monto 0 no se envía; un retiro mayor al efectivo lo rechaza el servidor.
  await registrar("retiro", "0", "x");
  await expect(page.getByRole("alert").filter({ hasText: "monto mayor a 0" })).toBeVisible();
  await registrar("retiro", "500", "Retiro excesivo");
  await expect(page.getByRole("alert").filter({ hasText: "efectivo suficiente" })).toBeVisible();

  // Esperado: 100 + 20 - 5,50 = 114,50. Contado 120 -> sobrante de 5,50.
  await page.getByLabel("Efectivo contado (Bs)").fill("120");
  await page.getByRole("button", { name: "Cerrar caja" }).first().click();
  const dialogo = page.getByRole("alertdialog");
  await expect(dialogo).toContainText("Bs 120,00");
  await dialogo.getByRole("button", { name: "Cerrar caja" }).click();

  await expect(page.getByTestId("cierre-esperado")).toHaveText("Bs 114,50");
  await expect(page.getByTestId("cierre-diferencia")).toHaveText("Bs 5,50");
  await expect(page.getByTestId("cierre-qr")).toHaveText("Bs 0,00");
  const fila = await apiComo(
    "vendedor",
    `caja_sesiones?select=monto_esperado,monto_contado,diferencia,cerrada_en&id=eq.${sesionId}`,
  );
  const s = (
    fila.json as {
      monto_esperado: number;
      monto_contado: number;
      diferencia: number;
      cerrada_en: string | null;
    }[]
  )[0]!;
  expect([Number(s.monto_esperado), Number(s.monto_contado), Number(s.diferencia)]).toEqual([
    114.5, 120, 5.5,
  ]);
  expect(s.cerrada_en).not.toBeNull();

  // Queda en apertura.
  await expect(page.getByLabel("Efectivo inicial (Bs)")).toBeVisible();
  expect(await sesionAbierta(equipoId)).toBeNull();
});

test.describe("panel: ventas, cajas, clientes y descuento", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("anular una venta desde el panel devuelve el stock", async ({ page }) => {
    const p = await crearProductoConPrecio({ contado: 40, stock: 10 });
    await abrirCajaApi(equipoId);
    const cajaId = (await sesionAbierta(equipoId))!;
    const venta = await venderApi({
      equipoId,
      cajaId,
      items: [{ producto: p, cantidad: 2, precio: 40 }],
      efectivo: 80,
    });
    expect(await stockEn(p.id)).toBe(8);

    await page.goto(`/panel/ventas?q=${venta.numero}`);
    await page.getByRole("link", { name: new RegExp(venta.numero) }).click();
    await expect(page.getByRole("heading", { name: `Venta ${venta.numero}` })).toBeVisible();
    // El motivo es obligatorio.
    await page.getByRole("button", { name: "Anular venta" }).click();
    await expect(page.getByText("Escribe el motivo de la anulación.")).toBeVisible();
    await page.getByLabel("Motivo de la anulación").fill("Error de cobro");
    await page.getByRole("button", { name: "Anular venta" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Anular venta" }).click();

    await expect(page.getByText(/Anulada .*Motivo: Error de cobro/)).toBeVisible();
    await expect(page.getByRole("form", { name: "Anular venta" })).toHaveCount(0);
    expect(await stockEn(p.id)).toBe(10);
    const r = await apiComo("dueno", `ventas?select=estado&id=eq.${venta.id}`);
    expect((r.json as { estado: string }[])[0]?.estado).toBe("anulada");
  });

  test("devolución parcial con reparto mixto: monto, efectivo y QR, y el stock vuelve", async ({
    page,
  }) => {
    const p = await crearProductoConPrecio({ contado: 50, stock: 10 });
    await abrirCajaApi(equipoId);
    const cajaId = (await sesionAbierta(equipoId))!;
    const venta = await venderApi({
      equipoId,
      cajaId,
      items: [{ producto: p, cantidad: 3, precio: 50 }],
      efectivo: 60,
      qr: 90,
    });

    await page.goto(`/panel/ventas/${venta.id}`);
    const form = page.getByRole("form", { name: "Devolver venta" });
    // Más de lo vendido no pasa.
    await form.getByLabel(`Cantidad a devolver de ${p.nombre}`).fill("4");
    await form.getByLabel("Motivo de la devolución").fill("Defecto de fábrica");
    await form.getByRole("button", { name: "Devolver" }).click();
    await expect(form.getByText(/entero de 1 a 3/)).toBeVisible();

    await form.getByLabel(`Cantidad a devolver de ${p.nombre}`).fill("2");
    await form.getByRole("button", { name: "Devolver" }).click();
    // 2 de 3 = Bs 100; el efectivo cobrado era 60, el resto sale por QR.
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Bs 100,00 en total, Bs 60,00 en efectivo y Bs 40,00 por QR" }),
    ).toBeVisible();
    await expect(page.getByRole("list", { name: "Devoluciones" })).toContainText(
      "Defecto de fábrica",
    );
    await expect(page.getByText("queda 1")).toBeVisible();
    expect(await stockEn(p.id)).toBe(9);
    const r = await apiComo(
      "dueno",
      `devoluciones?select=monto,monto_efectivo&venta_id=eq.${venta.id}`,
    );
    const d = r.json as { monto: number; monto_efectivo: number }[];
    expect(d).toHaveLength(1);
    expect([Number(d[0]!.monto), Number(d[0]!.monto_efectivo)]).toEqual([100, 60]);
    // Con devoluciones ya no se anula.
    await expect(page.getByText(/ya tiene devoluciones/)).toBeVisible();
  });

  test("devolución total: el reparto queda a la vista aunque la venta ya no tenga nada por devolver", async ({
    page,
  }) => {
    const p = await crearProductoConPrecio({ contado: 30, stock: 10 });
    await abrirCajaApi(equipoId);
    const cajaId = (await sesionAbierta(equipoId))!;
    const venta = await venderApi({
      equipoId,
      cajaId,
      items: [{ producto: p, cantidad: 2, precio: 30 }],
      efectivo: 60,
    });

    await page.goto(`/panel/ventas/${venta.id}`);
    const form = page.getByRole("form", { name: "Devolver venta" });
    await form.getByLabel(`Cantidad a devolver de ${p.nombre}`).fill("2");
    await form.getByLabel("Motivo de la devolución").fill("Cliente se arrepintió");
    await form.getByRole("button", { name: "Devolver" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Bs 60,00 en total, Bs 60,00 en efectivo y Bs 0,00 por QR" }),
    ).toBeVisible();
    await expect(form.getByText("No queda nada por devolver")).toBeVisible();
    await expect(page.getByRole("list", { name: "Devoluciones" })).toContainText(
      "Cliente se arrepintió",
    );
    expect(await stockEn(p.id)).toBe(10);
  });

  test("detalle de una caja cerrada: esperado, contado, diferencia y QR", async ({ page }) => {
    const p = await crearProductoConPrecio({ contado: 25, stock: 10 });
    await abrirCajaApi(equipoId);
    const cajaId = (await sesionAbierta(equipoId))!;
    await venderApi({
      equipoId,
      cajaId,
      items: [{ producto: p, cantidad: 2, precio: 25 }],
      efectivo: 30,
      qr: 20,
    });
    const mov = await apiComo("vendedor", "rpc/registrar_movimiento_caja", {
      metodo: "POST",
      cuerpo: {
        p_id: crypto.randomUUID(),
        p_sesion_id: cajaId,
        p_tipo: "ingreso",
        p_monto: 10,
        p_motivo: "Prueba panel",
      },
    });
    expect(mov.status).toBeLessThan(300);
    // Esperado: 100 + 30 + 10 = 140. Contado 150 -> diferencia 10; QR 20.
    const cierre = await apiComo("vendedor", "rpc/cerrar_caja", {
      metodo: "POST",
      cuerpo: { p_sesion_id: cajaId, p_monto_contado: 150 },
    });
    expect(cierre.status).toBeLessThan(300);

    await page.goto(`/panel/cajas/${cajaId}`);
    await expect(page.getByTestId("sesion-esperado")).toHaveText("Bs 140,00");
    await expect(page.getByTestId("sesion-diferencia")).toHaveText("Bs 10,00");
    await expect(page.getByTestId("sesion-qr")).toHaveText("Bs 20,00");
    await expect(page.getByRole("list", { name: "Movimientos" })).toContainText("Prueba panel");
    await expect(
      page.getByRole("list", { name: "Ventas de la sesión" }).getByRole("listitem"),
    ).toHaveCount(1);

    await page.goto("/panel/cajas");
    await expect(page.getByRole("link", { name: /Caja 1/ }).first()).toBeVisible();
  });

  test("tope de descuento: se fija, se valida y queda en base", async ({ page }) => {
    const leer = async () => {
      const r = await apiComo("dueno", `negocios?select=tope_descuento&id=eq.${tienda}`);
      return Number((r.json as { tope_descuento: number }[])[0]!.tope_descuento);
    };
    const original = await leer();
    try {
      await page.goto("/panel/descuento");
      await page.getByLabel("Tope (%)").fill("101");
      await page.getByRole("button", { name: "Guardar tope" }).click();
      await expect(page.getByText(/de 0 a 100/)).toBeVisible();
      await page.getByLabel("Tope (%)").fill("12,5");
      await page.getByRole("button", { name: "Guardar tope" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Tope guardado." })).toBeVisible();
      await expect(page.getByTestId("tope-vigente")).toHaveText("12,5 %");
      expect(await leer()).toBe(12.5);
    } finally {
      await apiComo("dueno", "rpc/fijar_tope_descuento", {
        metodo: "POST",
        cuerpo: { p_negocio_id: tienda, p_tope: original },
      });
    }
    expect(await leer()).toBe(original);
  });

  test("clientes: alta, búsqueda, edición y documento duplicado", async ({ page }) => {
    const doc = `PNL${corrida}`;
    const nombre = `Cliente Panel ${corrida}`;
    await page.goto("/panel/clientes");
    const nuevo = page.getByRole("form", { name: "Cliente nuevo" });
    await nuevo.getByLabel("Nombre").fill(nombre);
    await nuevo.getByLabel("CI o NIT").fill(doc.toLowerCase());
    await nuevo.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cliente guardado." })).toBeVisible();

    await nuevo.getByLabel("Nombre").fill("Otro cliente");
    await nuevo.getByLabel("CI o NIT").fill(doc);
    await nuevo.getByRole("button", { name: "Guardar cliente" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Ya existe un cliente con ese documento" }),
    ).toBeVisible();

    try {
      await page.goto(`/panel/clientes?q=${doc}`);
      const lista = page.getByRole("list", { name: "Clientes" });
      await expect(lista.getByRole("listitem")).toHaveCount(1);
      await expect(lista).toContainText(nombre);
      await page.getByRole("button", { name: `Editar a ${nombre}` }).click();
      const edicion = page.getByRole("form", { name: "Editar cliente" });
      await edicion.getByLabel("Nombre").fill(`${nombre} editado`);
      await edicion.getByLabel("Teléfono").fill("70000000");
      await edicion.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(lista).toContainText(`${nombre} editado`);
    } finally {
      const r = await apiComo(
        "dueno",
        `clientes?select=id&negocio_id=eq.${tienda}&ci_nit=eq.${doc}`,
      );
      for (const c of r.json as { id: string }[]) await liberarCliente(c.id);
    }
  });
});

test.describe("panel: permisos", () => {
  test.use({ storageState: rutaAuth("contador") });

  test("el contador ve la venta pero no anula ni devuelve, y no tiene caja en /pos", async ({
    page,
  }) => {
    const p = await crearProductoConPrecio({ contado: 10, stock: 5 });
    await abrirCajaApi(equipoId);
    const cajaId = (await sesionAbierta(equipoId))!;
    const venta = await venderApi({
      equipoId,
      cajaId,
      items: [{ producto: p, cantidad: 1, precio: 10 }],
      efectivo: 10,
    });

    await page.goto(`/panel/ventas/${venta.id}`);
    await expect(page.getByRole("heading", { name: `Venta ${venta.numero}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Anular venta" })).toHaveCount(0);
    await expect(page.getByRole("form", { name: "Devolver venta" })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Ventas" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Descuento" })).toHaveCount(0);

    // El servidor lo rechaza aunque se intente por API.
    const anular = await apiComo("contador", "rpc/anular_venta", {
      metodo: "POST",
      cuerpo: { p_venta_id: venta.id, p_motivo: "intento" },
    });
    expect(anular.status).toBeGreaterThanOrEqual(400);
    const caja = await apiComo("contador", "rpc/caja_sesion_abierta", {
      metodo: "POST",
      cuerpo: { p_dispositivo_id: equipoId },
    });
    expect(caja.status).toBeGreaterThanOrEqual(400);

    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await expect(page.getByRole("alert").filter({ hasText: "no puede vender" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Caja", exact: true })).toHaveCount(0);

    await page.goto("/panel/descuento");
    await expect(page).toHaveURL(/\/panel$/);
  });
});
