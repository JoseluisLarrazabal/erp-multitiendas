import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { apiComo, CUENTAS, iniciarSesionUI, NEGOCIOS, rutaAuth } from "./helpers";
import { corrida } from "./inventario-helpers";
import {
  abrirCajaApi,
  cerrarCaja,
  crearProductoConPrecio,
  enIndexedDb,
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
import { MAX_NUMERO_DUPLICADO } from "../../src/modules/ventas/domain";

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
  await expect(
    page.getByRole("status").filter({ hasText: /Venta C1-\d{6} registrada/ }),
  ).toBeVisible();
  await expect(page.getByText("guardada en este equipo")).toHaveCount(0);
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
  // El anuncio de lectores de pantalla no queda con el "Agregado: ..." de la venta anterior.
  await expect(page.getByRole("status").filter({ hasText: /Agregado:/ })).toHaveCount(0);
});

test("una falla de red deja la venta en la cola con su nota y el reenvío manda la misma venta con p_offline", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 20, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);

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

  await confirmarVenta(page);
  // La venta ya se entregó al cliente: nota y aviso, sin diálogo de reintento ni de descarte.
  await expect(notaVisible(page)).toBeVisible();
  await expect(notaEnCola(page)).toBeVisible();
  await expect(sinEnviar(page, 1)).toBeVisible();
  expect(await stockEn(a.id)).toBe(3);
  await volverLaRed(page);
  await expect(sinEnviar(page, 1)).toHaveCount(0);

  expect(cuerpos).toHaveLength(2);
  const [primero, reenvio] = cuerpos.map((c) => JSON.parse(c) as Record<string, unknown>);
  expect(primero).not.toHaveProperty("p_offline");
  expect(reenvio?.p_venta).toEqual(primero?.p_venta);
  expect(reenvio?.p_offline).toMatchObject({
    numero_impreso: (primero?.p_venta as { numero: string }).numero,
  });
  expect(await stockEn(a.id)).toBe(2);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas).toHaveLength(1);
  expect(ventas[0]?.origen).toBe("offline");
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

async function pagosDe(ventaId: string) {
  const r = await apiComo(
    "vendedor",
    `venta_pagos?select=medio,monto,verificacion&venta_id=eq.${ventaId}&order=medio`,
  );
  return r.json as { medio: string; monto: number; verificacion: string }[];
}

// Vuelve la conexión: el motor de la cola reenvía lo pendiente sin esperar la espera del reintento.
async function volverLaRed(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}
const sinEnviar = (page: Page, n: number) =>
  page.getByText(n === 1 ? "1 venta sin enviar" : `${n} ventas sin enviar`);
const notaVisible = (page: Page) => page.getByRole("article", { name: /Nota de venta/ });
// Con la venta en la cola, la nota no dice "registrada": aún no llegó al servidor.
const notaEnCola = (page: Page) =>
  page.getByRole("status").filter({
    hasText: /Venta C1-\d{6} guardada en este equipo\. Se enviará al volver la conexión\./,
  });

async function confirmarVenta(page: Page) {
  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
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

test("un código que coincide con dos productos no agrega y pide elegir", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 20, stock: 5 });
  // El código de barras de b es el código interno de a.
  const b = await crearProductoConPrecio({ contado: 30, stock: 5, barras: a.codigo });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await expect(page.getByText("Ese código coincide con 2 productos: elige uno.")).toBeVisible();
  await expect(page.getByText("El carrito está vacío.")).toBeVisible();
  const lista = page.getByRole("list", { name: "Resultados" }).getByRole("listitem");
  await expect(lista).toHaveCount(2);
  await expect(lista.nth(0)).toContainText(b.nombre);
  await expect(lista.nth(1)).toContainText(a.nombre);
  await lista
    .nth(1)
    .getByRole("button", { name: /Agregar/ })
    .click();
  await expect(page.getByText("El carrito está vacío.")).toBeHidden();
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

// RNF-02: venta confirmada en menos de 2 s. Se mide solo "Confirmar cobro" -> nota visible, con la red real al Supabase
// local y la página ya tibia (una primera venta calienta la ruta, la conexión y el catálogo en memoria).
test("RNF-02: una venta en línea se confirma en menos de 2 s", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 10, stock: 5 });
  await abrirCajaPorUI(page, "0");
  const nota = page.getByRole("article", { name: /Nota de venta/ });
  const vender = async () => {
    await agregarPorCodigo(page, a.codigo);
    const cobro = await abrirCobro(page);
    const confirmar = cobro.getByRole("button", { name: "Confirmar cobro" });
    await expect(confirmar).toBeEnabled();
    // El reloj corre del clic al evento de la nota visible, no a un sondeo de expect.
    const visible = nota.waitFor({ state: "visible", timeout: 10_000 });
    const inicio = performance.now();
    await confirmar.click();
    await visible;
    return performance.now() - inicio;
  };
  await vender(); // calentamiento
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await expect(page.getByText("El carrito está vacío.")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeFocused();
  const ms = await vender();
  console.log(`RNF-02: venta confirmada en ${Math.round(ms)} ms`);
  expect(ms, `la venta tardó ${Math.round(ms)} ms`).toBeLessThan(2000);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(2);
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

test("respuesta perdida: la venta ya estaba guardada, el reenvío recibe un rechazo, se comprueba y no duplica", async ({
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

  await confirmarVenta(page);
  await expect(notaVisible(page)).toBeVisible();
  await expect(sinEnviar(page, 1)).toBeVisible();
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  await volverLaRed(page);

  // El rechazo con código de una venta en duda se comprueba contra la base: existe, así que sale de la cola sin error.
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Operaciones rechazadas" })).toHaveCount(0);
  expect(llamadas).toBe(2);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas).toHaveLength(1);
  expect(ventas[0]?.origen).toBe("online");
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

  await confirmarVenta(page);
  await expect(notaVisible(page)).toBeVisible();
  await volverLaRed(page);

  await expect(sinEnviar(page, 1)).toHaveCount(0);
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

// Fase 3, PR 2: la cola persistente. Comparten el equipo C1 y su caja con todo lo de arriba (en serie).
test("E2E-05: venta sin conexión, nota y aviso; al volver la red se envía una vez como offline", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 30, stock: 4 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await context.setOffline(true);

  await confirmarVenta(page);
  await expect(notaVisible(page)).toBeVisible();
  await expect(notaEnCola(page)).toBeVisible();
  await expect(page.getByText(/registrada$/)).toHaveCount(0);
  await expect(sinEnviar(page, 1)).toBeVisible();
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(0);
  expect(await stockEn(a.id)).toBe(4);

  // La cola está en IndexedDB: sobrevive a la recarga, y al montar vuelve a intentar.
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas).toHaveLength(1);
  expect(ventas[0]).toMatchObject({ total: 30, estado: "completada", origen: "offline" });
  expect(await stockEn(a.id)).toBe(3);
});

test("primer intento colgado: a los 8 s la venta queda en la cola y el reenvío la entrega una vez", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 15, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  // La ruta nunca responde: solo el tiempo máximo del intento lo corta.
  await page.route("**/rest/v1/rpc/registrar_venta", () => new Promise<void>(() => undefined));

  const inicio = Date.now();
  await confirmarVenta(page);
  await expect(notaVisible(page)).toBeVisible({ timeout: 20_000 });
  expect(Date.now() - inicio).toBeGreaterThanOrEqual(7_500);
  await expect(sinEnviar(page, 1)).toBeVisible();

  await page.unroute("**/rest/v1/rpc/registrar_venta");
  await volverLaRed(page);
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas).toHaveLength(1);
  expect(await stockEn(a.id)).toBe(2);
});

test("cerrar la pestaña en un primer intento colgado: al reabrir la venta sale en la lista y no se envió sola", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 17, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  // La petición nunca sale: la pestaña muere con el primer intento en curso.
  await page.route("**/rest/v1/rpc/registrar_venta", () => new Promise<void>(() => undefined));
  await confirmarVenta(page);
  await expect(page.getByRole("button", { name: "Enviando…" })).toBeVisible();
  // Cerrar antes de que la fila llegue a IndexedDB no probaría nada.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const abrir = indexedDB.open("erp-pos");
            abrir.onerror = () => reject(abrir.error);
            abrir.onsuccess = () => {
              const contar = abrir.result.transaction("cola").objectStore("cola").count();
              contar.onsuccess = () => resolve(contar.result);
              contar.onerror = () => reject(contar.error);
            };
          }),
      ),
    )
    .toBe(1);
  await page.close();

  const nueva = await context.newPage();
  await fijarEquipo(nueva, equipoId);
  await nueva.goto("/pos");
  const lista = nueva.getByRole("region", { name: "Operaciones rechazadas" });
  await expect(lista).toContainText("El cobro se interrumpió antes de la nota");
  await expect(lista).toContainText("Bs 17,00");
  await nueva.waitForTimeout(1500); // el motor ya corrió al montar: no la reenvía
  // La petición retenida puede escaparse al cerrar la pestaña; solo un reenvío de la cola llevaría origen offline.
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas.length).toBeLessThanOrEqual(1);
  expect(ventas.filter((v) => v.origen !== "online")).toHaveLength(0);
  expect(await stockEn(a.id)).toBe(3 - ventas.length);
});

test("respuesta perdida con la venta ya guardada: el reenvío no duplica y conserva origen online", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 18, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  let llamadas = 0;
  await page.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    llamadas += 1;
    if (llamadas > 1) return route.continue();
    await route.fetch(); // la base guarda la venta...
    return route.abort("connectionfailed"); // ...pero la respuesta no llega
  });

  await confirmarVenta(page);
  await expect(notaVisible(page)).toBeVisible();
  await expect(sinEnviar(page, 1)).toBeVisible();
  await volverLaRed(page);
  await expect(sinEnviar(page, 1)).toHaveCount(0);

  expect(llamadas).toBe(2);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas).toHaveLength(1);
  expect(ventas[0]?.origen).toBe("online");
  expect(await stockEn(a.id)).toBe(2);
});

const cuerpoCajaCerrada = JSON.stringify({
  code: "P0001",
  message: "ERP_CAJA_CERRADA",
  details: null,
  hint: null,
});

// Deja una venta rechazada en la cola: el primer intento no llega y el reenvío recibe un rechazo con código.
async function ventaRechazada(page: Page, contado: number) {
  const a = await crearProductoConPrecio({ contado, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  let llamadas = 0;
  await page.route("**/rest/v1/rpc/registrar_venta", (route) => {
    llamadas += 1;
    if (llamadas === 1) return route.abort("connectionfailed");
    return route.fulfill({ status: 400, contentType: "application/json", body: cuerpoCajaCerrada });
  });
  await confirmarVenta(page);
  await expect(notaVisible(page)).toBeVisible();
  await volverLaRed(page);
  const lista = page.getByRole("region", { name: "Operaciones rechazadas" });
  await expect(lista).toBeVisible();
  await expect(lista).toContainText("La caja de este equipo está cerrada");
  await expect(lista).toContainText(`Bs ${contado},00`);
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  return { a, lista };
}

test("rechazo al reenviar: la fila queda visible y Reintentar la entrega cuando el servidor la acepta", async ({
  page,
}) => {
  const { a, lista } = await ventaRechazada(page, 21);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(0);
  // Descartar exige `devolver_fuera_plazo` (encargado y dueño): el vendedor solo ve el aviso.
  await expect(lista.getByRole("button", { name: /^Descartar/ })).toHaveCount(0);
  await expect(lista).toContainText("avisa al encargado");

  await page.unroute("**/rest/v1/rpc/registrar_venta");
  await lista.getByRole("button", { name: /^Reintentar la venta/ }).click();
  await expect(lista).toHaveCount(0);
  // La fila sale de la lista antes de que la base confirme: con carga en paralelo la lectura llega antes que el insert.
  await expect.poll(async () => (await ventasDeLaCaja(equipoId)).length).toBe(1);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas[0]).toMatchObject({ total: 21, origen: "offline" });
  expect(await stockEn(a.id)).toBe(2);
});

test("M-11: con una venta rechazada el cierre no se bloquea, avisa, y al reintentar entra como tardía", async ({
  page,
}) => {
  await ventaRechazada(page, 24);
  const cajaId = (await sesionAbierta(equipoId))!;
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await page.getByLabel("Efectivo contado (Bs)").fill("24");
  const cerrar = page.getByRole("button", { name: "Cerrar caja" }).first();
  await expect(cerrar).toBeEnabled();
  await expect(
    page.getByText(
      /Hay 1 operación rechazada sin resolver \(ventas por Bs 24,00\)\. El esperado no las cuenta/,
    ),
  ).toBeVisible();
  await cerrar.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.getByTestId("cierre-esperado")).toHaveText("Bs 0,00");
  await expect(page.getByTestId("cierre-diferencia")).toHaveText("Bs 24,00");

  // El encargado la reintenta: entra en la sesión cerrada, marcada, y el resumen la cuenta como tardía.
  await page.unroute("**/rest/v1/rpc/registrar_venta");
  await page
    .getByRole("region", { name: "Operaciones rechazadas" })
    .getByRole("button", { name: /^Reintentar la venta/ })
    .click();
  await expect
    .poll(async () => {
      const r = await apiComo("dueno", "rpc/resumen_caja", {
        metodo: "POST",
        cuerpo: { p_sesion_id: cajaId },
      });
      return (r.json as { tardias_ventas: number }).tardias_ventas;
    })
    .toBe(1);
  const ventas = await apiComo(
    "vendedor",
    `ventas?select=total,motivos_revision&caja_sesion_id=eq.${cajaId}`,
  );
  expect((ventas.json as { motivos_revision: string[] }[])[0]!.motivos_revision).toContain(
    "caja_cerrada",
  );
});

test.describe("descartar con permiso de encargado", () => {
  test.use({ storageState: rutaAuth("dueno") });
  test("rechazo al reenviar: Descartar exige escribir DESCARTAR y no deja rastro en la base", async ({
    page,
  }) => {
    const { a, lista } = await ventaRechazada(page, 22);
    await lista.getByRole("button", { name: /^Descartar la venta/ }).click();
    const dialogo = page.getByRole("alertdialog");
    const confirmar = dialogo.getByRole("button", { name: "Descartar venta" });
    await expect(dialogo).toContainText("Bs 22,00");
    await expect(confirmar).toBeDisabled();
    await dialogo.getByLabel(/Escribe DESCARTAR/).fill("descartar");
    await expect(confirmar).toBeDisabled();
    await dialogo.getByLabel(/Escribe DESCARTAR/).fill("DESCARTAR");
    await confirmar.click();
    await expect(lista).toHaveCount(0);
    expect(await ventasDeLaCaja(equipoId)).toHaveLength(0);
    expect(await stockEn(a.id)).toBe(3);
  });
});

test("E2E-07: con la cola pendiente el cierre de caja está bloqueado y se habilita al vaciarse", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 12, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await context.setOffline(true);
  await confirmarVenta(page);
  await expect(sinEnviar(page, 1)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta" }).click();

  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await page.getByLabel("Efectivo contado (Bs)").fill("12");
  const cerrar = page.getByRole("button", { name: "Cerrar caja" }).first();
  await expect(cerrar).toBeDisabled();
  await expect(
    page.getByText(
      "Hay operaciones sin enviar, una apertura de caja rechazada o cobros sin confirmar",
    ),
  ).toBeVisible();

  await context.setOffline(false);
  await volverLaRed(page);
  await expect(cerrar).toBeEnabled({ timeout: 15_000 });
  await cerrar.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.getByTestId("cierre-esperado")).toHaveText("Bs 12,00");
  expect(await sesionAbierta(equipoId)).toBeNull();
});

test("dos pestañas con la misma cola: una sola venta en la base", async ({ page, context }) => {
  const a = await crearProductoConPrecio({ contado: 14, stock: 3 });
  await abrirCajaPorUI(page, "0");
  const otra = await context.newPage();
  await fijarEquipo(otra, equipoId);
  await otra.goto("/pos");
  await expect(otra.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();

  let envios = 0;
  await context.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    envios += 1;
    await new Promise((r) => setTimeout(r, 500)); // da tiempo a que la otra pestaña intente a la vez
    return route.continue();
  });
  await agregarPorCodigo(page, a.codigo);
  await context.setOffline(true);
  await confirmarVenta(page);
  await expect(sinEnviar(page, 1)).toBeVisible();

  await context.setOffline(false);
  await Promise.all([volverLaRed(page), volverLaRed(otra)]);
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  expect(envios).toBe(1);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  expect(await stockEn(a.id)).toBe(2);
});

test("dos pestañas, cerrojo real: B espera mientras A tiene un envío colgado y luego repite sin esperar el backoff", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 21, stock: 3 });
  await abrirCajaPorUI(page, "0");
  const otra = await context.newPage();
  await fijarEquipo(otra, equipoId);
  await otra.goto("/pos");
  await expect(otra.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();

  // Sin cambiar la red del contexto (su evento `online` llegaría a las dos pestañas a la vez): el primer envío falla y
  // la venta queda en la cola; el segundo, el vaciado de A, queda retenido; los demás pasan.
  const retenidos: Route[] = [];
  let envios = 0;
  await context.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    envios += 1;
    if (envios === 1) return route.abort("failed");
    if (envios === 2) {
      retenidos.push(route);
      return;
    }
    return route.continue();
  });
  await agregarPorCodigo(page, a.codigo);
  await confirmarVenta(page);
  await expect(sinEnviar(page, 1)).toBeVisible();

  // A toma el cerrojo real y su envío queda colgado.
  await volverLaRed(page);
  await expect.poll(() => retenidos.length).toBe(1);

  // B fuerza un vaciado: no obtiene el cerrojo y queda en espera, sin enviar nada. A también deja su propia repetición.
  await volverLaRed(otra);
  await expect
    .poll(() =>
      otra.evaluate(async () => {
        const { held, pending } = await navigator.locks.query();
        const de = (l: LockInfo[] | undefined) => l?.filter((x) => x.name === "erp:cola") ?? [];
        return [de(held).length, new Set(de(pending).map((x) => x.clientId)).size];
      }),
    )
    .toEqual([1, 2]);
  expect(envios).toBe(2);

  // A suelta el cerrojo con un fallo de red (la fila queda con 10 s de espera): B repite forzado, sin esa espera.
  const suelta = Date.now();
  await retenidos[0]!.abort("failed");
  await expect.poll(() => ventasDeLaCaja(equipoId), { timeout: 4_000 }).toHaveLength(1);
  expect(Date.now() - suelta).toBeLessThan(4_000);
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  expect(envios).toBe(3);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  expect(await stockEn(a.id)).toBe(2);
});

test("sin conexión el QR se cobra como pendiente de verificar, sin casilla, y llega como pendiente", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 40, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await context.setOffline(true);
  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Todo QR" }).click();
  await expect(cobro.getByLabel(/Confirmo que recibí/)).toHaveCount(0);
  await expect(cobro.getByText("QR pendiente de verificar")).toBeVisible();
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(notaVisible(page)).toContainText("QR pendiente de verificar");
  await expect(notaEnCola(page)).toBeVisible();
  await expect(sinEnviar(page, 1)).toBeVisible();

  await context.setOffline(false);
  await volverLaRed(page);
  await expect(sinEnviar(page, 1)).toHaveCount(0, { timeout: 15_000 });
  const [venta] = await ventasDeLaCaja(equipoId);
  expect(venta?.origen).toBe("offline");
  expect(await pagosDe(venta!.id)).toEqual([{ medio: "qr", monto: 40, verificacion: "pendiente" }]);
});

test("navigator.onLine dice sin red pero el servidor responde: el QR pendiente salta el primer intento y viaja con p_offline", async ({
  page,
}) => {
  const a = await crearProductoConPrecio({ contado: 22, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  const cuerpos: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    cuerpos.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.continue();
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
  });
  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Todo QR" }).click();
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(notaVisible(page)).toBeVisible();
  await expect.poll(() => cuerpos.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(cuerpos.every((c) => "p_offline" in c)).toBe(true);
  await expect.poll(async () => (await ventasDeLaCaja(equipoId)).length).toBe(1);
  const [venta] = await ventasDeLaCaja(equipoId);
  expect(venta?.origen).toBe("offline");
  expect((await pagosDe(venta!.id))[0]?.verificacion).toBe("pendiente");
});

test("otra cuenta en otra pestaña: el cobro se rechaza, no se encola y el carrito queda", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 33, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  const cobro = await abrirCobro(page);
  // Otra pestaña del mismo navegador entra con otra cuenta: las cookies de sesión son las de esa cuenta.
  const otra = JSON.parse(readFileSync(rutaAuth("encargadoTienda"), "utf8")) as {
    cookies: Parameters<typeof context.addCookies>[0];
  };
  await context.clearCookies();
  await context.addCookies(otra.cookies);

  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro.getByRole("alert")).toContainText("La sesión caducó o es de otra cuenta");
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(0);
  expect(await stockEn(a.id)).toBe(2);
  await cobro.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByRole("list", { name: "Carrito" }).getByRole("listitem")).toHaveCount(1);
});

test("con una venta en la cola y el equipo sin elegir, el aviso sale y la venta se envía", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 17, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await context.setOffline(true);
  await confirmarVenta(page);
  await expect(sinEnviar(page, 1)).toBeVisible();
  // La nota solo sale con la fila entregada: recargar antes interrumpiría el primer intento.
  await expect(notaEnCola(page)).toBeVisible();

  // Vuelve la red pero el envío sigue sin llegar, y la lista de equipos trae otros: ninguno es el guardado.
  await context.route("**/rest/v1/rpc/registrar_venta", (route) => route.abort("connectionfailed"));
  await context.route("**/rest/v1/dispositivos*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        ["Caja X", "Caja Y"].map((nombre, i) => ({
          id: crypto.randomUUID(),
          nombre,
          prefijo: `X${i}`,
          ubicacion_id: crypto.randomUUID(),
          ultimo_numero: 0,
        })),
      ),
    }),
  );
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("region", { name: "Elegir equipo" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toHaveCount(0);
  await expect(sinEnviar(page, 1)).toBeVisible();

  await context.unroute("**/rest/v1/rpc/registrar_venta");
  await volverLaRed(page);
  await expect(sinEnviar(page, 1)).toHaveCount(0);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
  expect(await stockEn(a.id)).toBe(2);
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

// Fase 3, PR 3: arranque sin red. Comparten el equipo C1 (en serie).
test("E2E-06: recargar el POS sin red lo abre con el catálogo guardado y vende", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 18, stock: 3 });
  await abrirCajaPorUI(page, "0");
  await expect.poll(() => enIndexedDb(page, "datos", "catalogo:")).toBe(1);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Sin conexión\. Catálogo de/)).toBeVisible();
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
  await agregarPorCodigo(page, a.codigo);
  await confirmarVenta(page);
  await expect(notaEnCola(page)).toBeVisible();
  await expect(sinEnviar(page, 1)).toBeVisible();
  // El carrito no sobrevive a la recarga (no aplica); la cola sí.
  await page.reload();
  await expect(sinEnviar(page, 1)).toBeVisible();

  await context.setOffline(false);
  await volverLaRed(page);
  await expect(sinEnviar(page, 1)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/Sin conexión\. Catálogo de/)).toHaveCount(0);
  expect((await ventasDeLaCaja(equipoId))[0]).toMatchObject({ total: 18, origen: "offline" });
});

test("mañana sin internet: abre caja, vende efectivo y QR, registra un gasto, recarga, reconecta y cierra", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 30, stock: 5 });
  const b = await crearProductoConPrecio({ contado: 20, stock: 5 });
  // Contexto previo: un día de trabajo con red que termina cerrando la caja desde el POS.
  await abrirCajaPorUI(page, "0");
  await expect.poll(() => enIndexedDb(page, "datos", "catalogo:")).toBe(1);
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await page.getByLabel("Efectivo contado (Bs)").fill("0");
  await page.getByRole("button", { name: "Cerrar caja" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.getByTestId("cierre-esperado")).toBeVisible();
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByLabel("Efectivo inicial (Bs)")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  const antes = Date.now();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Sin conexión\. Catálogo de/)).toBeVisible();
  await page.getByLabel("Efectivo inicial (Bs)").fill("50");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();

  await agregarPorCodigo(page, a.codigo);
  await confirmarVenta(page);
  await expect(notaEnCola(page)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await agregarPorCodigo(page, b.codigo);
  const cobro = await abrirCobro(page);
  await cobro.getByRole("button", { name: "Todo QR" }).click();
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(notaVisible(page)).toContainText("QR pendiente de verificar");
  await page.getByRole("button", { name: "Nueva venta" }).click();

  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await page.getByLabel("Tipo", { exact: true }).selectOption("gasto");
  await page.getByLabel("Monto (Bs)").fill("5");
  await page.getByLabel("Motivo", { exact: true }).fill("Bolsas");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();
  await expect(page.getByRole("status").filter({ hasText: "guardado sin conexión" })).toBeVisible();
  await expect(page.getByText("Disponible con conexión.")).toBeVisible();
  await expect(page.getByText("Cerrar la caja necesita conexión.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar caja" }).first()).toBeDisabled();

  await page.reload();
  await expect(
    page.getByText(/2 ventas, 1 apertura de caja y 1 movimiento de caja sin enviar/),
  ).toBeVisible();
  expect(await sesionAbierta(equipoId)).toBeNull();

  await context.setOffline(false);
  await volverLaRed(page);
  await expect(page.getByText(/sin enviar/)).toHaveCount(0, { timeout: 20_000 });

  const cajaId = (await sesionAbierta(equipoId))!;
  const sesion = (
    (
      await apiComo(
        "vendedor",
        `caja_sesiones?select=origen,enviada_por,usuario_apertura,abierta_en&id=eq.${cajaId}`,
      )
    ).json as {
      origen: string;
      enviada_por: string;
      usuario_apertura: string;
      abierta_en: string;
    }[]
  )[0]!;
  expect(sesion.origen).toBe("offline");
  expect(sesion.enviada_por).toBe(sesion.usuario_apertura);
  // La hora es la del equipo al abrir, no la de la sincronización.
  expect(Date.parse(sesion.abierta_en)).toBeGreaterThanOrEqual(antes - 2_000);
  expect(Date.parse(sesion.abierta_en)).toBeLessThan(Date.now() - 1_000);
  const ventas = await ventasDeLaCaja(equipoId);
  expect(ventas.map((v) => v.origen)).toEqual(["offline", "offline"]);
  const pagos = (await Promise.all(ventas.map((v) => pagosDe(v.id)))).flat();
  expect(pagos.map((p) => `${p.medio}:${p.verificacion}`).sort()).toEqual([
    "efectivo:no_aplica",
    "qr:pendiente",
  ]);
  const movs = (
    await apiComo("vendedor", `caja_movimientos?select=tipo,monto,origen&sesion_id=eq.${cajaId}`)
  ).json as { tipo: string; monto: number; origen: string }[];
  expect(movs).toEqual([{ tipo: "gasto", monto: 5, origen: "offline" }]);
  // Orden: las ventas se aceptaron porque la apertura llegó antes (sin ella darían ERP_CAJA_CERRADA).
  // Stock = 5 menos lo vendido y coincide con la suma del kardex.
  for (const p of [a, b]) {
    expect(await stockEn(p.id)).toBe(4);
    const kardex = (
      await apiComo("dueno", `movimientos_inventario?select=cantidad&producto_id=eq.${p.id}`)
    ).json as { cantidad: number }[];
    expect(kardex.reduce((t, k) => t + Number(k.cantidad), 0)).toBe(4);
  }

  // Con la cola vacía el cierre ya funciona (la recarga dejó el POS en modo vender).
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await page.getByLabel("Efectivo contado (Bs)").fill("75");
  await page.getByRole("button", { name: "Cerrar caja" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar caja" }).click();
  await expect(page.getByTestId("cierre-esperado")).toBeVisible();
  expect(await sesionAbierta(equipoId)).toBeNull();
});

test("sin red un producto con serie pide conexión y no entra al carrito", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 60, stock: 1, controlaSerie: true });
  await registrarSeries(a.id, [`S-${a.codigo}`]);
  await abrirCajaPorUI(page, "0");
  await context.setOffline(true);
  await page.keyboard.type(a.codigo);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Este producto necesita conexión")).toBeVisible();
  await expect(page.getByText("El carrito está vacío.")).toBeVisible();
  // Cambiar de equipo, cliente y cierre de caja también piden conexión.
  await expect(page.getByRole("button", { name: "Cambiar equipo" })).toBeDisabled();
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cerrar caja" }).first()).toBeDisabled();
  await context.setOffline(false);
});

test("cerrar sesión borra el contexto y conserva la cola", async ({ page }) => {
  const a = await crearProductoConPrecio({ contado: 14, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await expect.poll(() => enIndexedDb(page, "datos")).toBeGreaterThan(0);
  await agregarPorCodigo(page, a.codigo);
  // El servidor no responde: el primer intento falla y la venta queda en la cola.
  await page.route("**/rest/v1/rpc/registrar_venta", (route) => route.abort());
  await confirmarVenta(page);
  await expect(sinEnviar(page, 1)).toBeVisible();
  // El logout real revocaría la sesión guardada que comparten los demás archivos: se atiende en local.
  await page.route("**/auth/v1/logout*", (route) => route.fulfill({ status: 204 }));
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await enIndexedDb(page, "datos")).toBe(0);
  expect(await enIndexedDb(page, "cola")).toBe(1);
});

test("sesión caducada al reconectar: la cola se pausa, pide login y tras entrar se envía", async ({
  page,
  context,
}) => {
  const a = await crearProductoConPrecio({ contado: 16, stock: 2 });
  await abrirCajaPorUI(page, "0");
  await agregarPorCodigo(page, a.codigo);
  await context.setOffline(true);
  await confirmarVenta(page);
  await expect(sinEnviar(page, 1)).toBeVisible();

  // El token ya no vale: sin cookies y el servidor lo rechaza (el cliente aún lo guarda en memoria y, sin esto,
  // el motor de la cola podría enviar antes de que el chequeo de sesión lo pause).
  await context.clearCookies();
  const expirado = (route: Route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST301", message: "JWT expired" }),
    });
  await page.route("**/rest/v1/rpc/registrar_venta*", expirado);
  await context.setOffline(false);
  await volverLaRed(page);
  await expect(page.getByText(/Tu sesión caducó/)).toBeVisible();
  await expect(page.getByText(/Inicia sesión para enviarlas/)).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(0);
  expect(await enIndexedDb(page, "cola")).toBe(1);

  // Vuelve a entrar con la misma cuenta (otra pestaña, mismo navegador) y la cola se retoma.
  const otra = await context.newPage();
  await iniciarSesionUI(otra, CUENTAS.vendedor);
  await expect(otra).toHaveURL(/\/pos$/);
  await otra.close();
  await page.unroute("**/rest/v1/rpc/registrar_venta*", expirado);
  await page.getByRole("button", { name: "Ya inicié sesión" }).click();
  await expect(sinEnviar(page, 1)).toHaveCount(0, { timeout: 20_000 });
  expect(await ventasDeLaCaja(equipoId)).toHaveLength(1);
});

test("actualización disponible: el botón se habilita solo con la cola vacía", async ({
  page,
  context,
}) => {
  // Simula el evento `waiting` del provider: probar dos builds seguidos no es viable aquí (ver docs/stack.md).
  const a = await crearProductoConPrecio({ contado: 11, stock: 2 });
  await abrirCajaPorUI(page, "0");
  const esperar = () =>
    page.evaluate(() =>
      (
        window as unknown as { serwist: { dispatchEvent: (e: unknown) => void } }
      ).serwist.dispatchEvent({
        type: "waiting",
      }),
    );
  await esperar();
  const boton = page.getByRole("button", { name: "Actualizar ahora" });
  await expect(page.getByText("Actualización disponible.")).toBeVisible();
  await expect(boton).toBeEnabled();

  await agregarPorCodigo(page, a.codigo);
  await context.setOffline(true);
  await confirmarVenta(page);
  await expect(sinEnviar(page, 1)).toBeVisible();
  await expect(boton).toBeDisabled();
  await expect(page.getByText(/se podrá aplicar cuando se resuelvan/)).toBeVisible();

  await context.setOffline(false);
  await volverLaRed(page);
  await expect(boton).toBeEnabled({ timeout: 15_000 });

  // Un cobro o una cuota sin confirmar en el navegador impide aplicar aunque la cola esté vacía.
  await page.evaluate(() =>
    localStorage.setItem("erp:cuotas-sin-confirmar:prueba:prueba", '{"a":1}'),
  );
  await boton.click();
  await expect(
    page.getByText(
      "Hay un cobro o una cuota sin confirmar en este navegador. Verifícalo antes de actualizar.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar ahora" })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("erp:cuotas-sin-confirmar:prueba:prueba"));
});
