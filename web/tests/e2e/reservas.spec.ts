import { expect, test } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, fijarEquipo, stockEn, tienda } from "./pos-helpers";

// E2E-13 (RF-RES-01 a 03): reservar con anticipo, completar en una venta, cancelar con devolución y sin red.
// Equipo propio (W1) y datos únicos por corrida: ningún otro spec usa su caja.
test.use({ storageState: rutaAuth("vendedor") });
test.describe.configure({ mode: "serial" });

let equipoId = "";
let cajaId = "";
let clienteId = "";
const nombreCliente = `Cliente reserva ${corrida}`;

test.beforeAll(async () => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W1", "Caja de reservas");
  equipoId = equipo.id;
  cajaId = await abrirCaja(tienda, equipo);
  const c = await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_datos: { nombre: nombreCliente } },
  });
  clienteId = c.json as string;
});
test.afterAll(async () => {
  await apiComo("dueno", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
  });
});

async function reservasDelCliente() {
  const r = await apiComo(
    "vendedor",
    `reservas?select=id,estado,venta_id&cliente_id=eq.${clienteId}&order=created_at`,
  );
  return r.json as { id: string; estado: string; venta_id: string | null }[];
}

test("E2E-13: reserva con anticipo, conversión en venta y cancelación", async ({
  page,
  browser,
}) => {
  const producto = await crearProductoConPrecio({ contado: 50, minimo: 40, stock: 10 });
  await fijarEquipo(page, equipoId);
  await page.goto("/pos");
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();

  // Crear: 2 unidades a 45 (acordado), anticipo de 30 en efectivo.
  await page.getByRole("button", { name: "Reservas" }).click();
  const form = page.getByRole("form", { name: "Nueva reserva" });
  await form.getByRole("button", { name: "Elegir" }).click();
  await form.getByRole("textbox", { name: "Buscar cliente" }).fill(nombreCliente);
  await form.getByRole("button", { name: new RegExp(nombreCliente) }).click();
  await form.getByRole("searchbox", { name: "Producto" }).fill(producto.codigo);
  await form.getByRole("button", { name: new RegExp(producto.nombre) }).click();
  await form.getByLabel("Cantidad").fill("2");
  await form.getByLabel("Precio acordado (Bs)").fill("45");
  await form.getByLabel("Anticipo (Bs)").fill("100");
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(form.getByRole("alert")).toContainText("no puede superar el total");
  await form.getByLabel("Anticipo (Bs)").fill("30");
  // El anticipo por QR pide la misma confirmación que el cobro.
  await form.getByLabel("Anticipo recibido por").selectOption("qr");
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(form.getByRole("alert")).toContainText("Confirma que recibiste el QR");
  await form.getByLabel("Anticipo recibido por").selectOption("efectivo");
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reserva creada" })).toBeVisible();
  const fila = page.getByRole("listitem", { name: `Reserva de ${nombreCliente}` });
  await expect(fila).toContainText("anticipo Bs 30,00");
  await expect(fila).toContainText("saldo Bs 60,00");
  expect(await stockEn(producto.id)).toBe(8); // DB-23: la reserva descuenta el disponible

  // Completar: carga el carrito con el precio acordado y cobra solo el saldo.
  await fila.getByRole("button", { name: `Completar reserva de ${nombreCliente}` }).click();
  await expect(page.getByTestId("total")).toHaveText("Bs 90,00");
  await expect(page.getByText(`Completando la reserva de ${nombreCliente}`)).toBeVisible();
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar venta" });
  await expect(cobro).toContainText("anticipo de la reserva Bs 30,00");
  await expect(cobro.getByLabel("Efectivo recibido (Bs)")).toHaveValue("60,00");
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta W1-\d{6}/ })).toBeVisible();
  expect(await stockEn(producto.id)).toBe(8); // DB-23: completar no descuenta dos veces
  const [completada] = await reservasDelCliente();
  expect(completada).toMatchObject({ estado: "completada" });
  const pagos = await apiComo(
    "vendedor",
    `venta_pagos?select=medio,monto&venta_id=eq.${completada!.venta_id}&order=medio`,
  );
  expect(pagos.json).toEqual([
    { medio: "anticipo", monto: 30 },
    { medio: "efectivo", monto: 60 },
  ]);

  // Cancelar otra reserva (creada por API) libera el stock y devuelve el anticipo (DB-24).
  const nueva = await apiComo("vendedor", "rpc/crear_reserva", {
    metodo: "POST",
    cuerpo: {
      p_reserva: {
        id: crypto.randomUUID(),
        dispositivo_id: equipoId,
        caja_sesion_id: cajaId,
        cliente_id: clienteId,
        producto_id: producto.id,
        cantidad: 3,
        precio_acordado: 50,
        anticipo: 20,
        medio: "efectivo",
      },
    },
  });
  expect(nueva.status).toBeLessThan(300);
  expect(await stockEn(producto.id)).toBe(5);
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await page.getByRole("button", { name: "Reservas" }).click();
  const otra = page.getByRole("listitem", { name: `Reserva de ${nombreCliente}` });
  await expect(otra).toHaveCount(1);
  // M-1: cancelar devuelve el anticipo por caja y exige `anular`: el vendedor ve la reserva y el texto, sin botón.
  await expect(otra.getByText("Para cancelar la reserva, pide a un encargado.")).toBeVisible();
  await expect(otra.getByRole("button", { name: "Cancelar", exact: true })).toHaveCount(0);
  // La cancelación la hace un encargado.
  const ctxEncargado = await browser.newContext({ storageState: rutaAuth("encargadoTienda") });
  const pagina = await ctxEncargado.newPage();
  await fijarEquipo(pagina, equipoId);
  await pagina.goto("/pos");
  await expect(pagina.getByText(/productos en el catálogo/)).toBeVisible();
  await pagina.getByRole("button", { name: "Reservas" }).click();
  const deEncargado = pagina.getByRole("listitem", { name: `Reserva de ${nombreCliente}` });
  await expect(deEncargado).toHaveCount(1);
  await deEncargado.getByRole("button", { name: "Cancelar", exact: true }).click();
  await pagina.getByRole("alertdialog").getByRole("button", { name: "Cancelar reserva" }).click();
  await expect(
    pagina.getByRole("status").filter({ hasText: "cancelada: anticipo devuelto" }),
  ).toBeVisible();
  await ctxEncargado.close();
  expect(await stockEn(producto.id)).toBe(8);
  expect((await reservasDelCliente()).map((r) => r.estado)).toEqual(["completada", "cancelada"]);

  // Sin conexión no se crea, cancela ni completa: mensaje claro.
  await page.context().setOffline(true);
  await expect(page.getByText(/Las reservas necesitan conexión/)).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByRole("form", { name: "Nueva reserva" })).toBeVisible();
});

test("M-7: respuesta perdida al reservar, reenviar con otro monto no atasca", async ({ page }) => {
  test.setTimeout(90_000);
  const producto = await crearProductoConPrecio({ contado: 50, minimo: 40, stock: 10 });
  // Cliente propio: los tests siguientes suponen una sola reserva activa de `nombreM7`.
  const nombreM7 = `Cliente M7 ${corrida}`;
  const c = await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_datos: { nombre: nombreM7 } },
  });
  const reservasM7 = async () =>
    (
      (await apiComo("vendedor", `reservas?select=id&cliente_id=eq.${c.json as string}`))
        .json as unknown[]
    ).length;
  await fijarEquipo(page, equipoId);
  await page.goto("/pos");
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
  await page.getByRole("button", { name: "Reservas" }).click();
  const form = page.getByRole("form", { name: "Nueva reserva" });
  await form.getByRole("button", { name: "Elegir" }).click();
  await form.getByRole("textbox", { name: "Buscar cliente" }).fill(nombreM7);
  await form.getByRole("button", { name: new RegExp(nombreM7) }).click();
  await form.getByRole("searchbox", { name: "Producto" }).fill(producto.codigo);
  await form.getByRole("button", { name: new RegExp(producto.nombre) }).click();
  await form.getByLabel("Cantidad").fill("1");
  await form.getByLabel("Precio acordado (Bs)").fill("50");
  await form.getByLabel("Anticipo (Bs)").fill("10");

  // El servidor guarda la reserva pero la respuesta se pierde.
  await page.route("**/rest/v1/rpc/crear_reserva", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(form.getByRole("alert")).not.toBeEmpty();
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // Reenvía con otro anticipo y el mismo id: el servidor dice "repetida" y hay salida.
  await form.getByLabel("Anticipo (Bs)").fill("15");
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(form.getByRole("alert")).toContainText(
    "ya quedó registrada con los datos del primer intento",
  );
  await expect(
    page
      .getByRole("listitem", { name: `Reserva de ${nombreM7}` })
      .filter({ hasText: "anticipo Bs 10,00" }),
  ).toHaveCount(1);
  expect(await reservasM7()).toBe(1);

  // Salida: con un id nuevo, enviar de nuevo crea otra reserva.
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reserva creada" })).toBeVisible();
  expect(await reservasM7()).toBe(2);
});

// Cobro de reserva sin confirmar: el cobro nunca va a la cola; se reintenta en memoria y, si no se sabe qué pasó,
// el cajero verifica contra el servidor antes de soltar el producto.
async function reservaApi(producto: { id: string }, cantidad: number) {
  const id = crypto.randomUUID();
  const r = await apiComo("vendedor", "rpc/crear_reserva", {
    metodo: "POST",
    cuerpo: {
      p_reserva: {
        id,
        dispositivo_id: equipoId,
        caja_sesion_id: cajaId,
        cliente_id: clienteId,
        producto_id: producto.id,
        cantidad,
        precio_acordado: 50,
        anticipo: 20,
        medio: "efectivo",
      },
    },
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  return id;
}
async function estadoReserva(id: string) {
  const r = await apiComo("vendedor", `reservas?select=estado,venta_id&id=eq.${id}`);
  return (r.json as { estado: string; venta_id: string | null }[])[0]!;
}
async function ventasDe(ventaId: string) {
  const v = await apiComo("vendedor", `ventas?select=id&id=eq.${ventaId}`);
  const p = await apiComo(
    "vendedor",
    `venta_pagos?select=id&venta_id=eq.${ventaId}&medio=eq.anticipo`,
  );
  return { ventas: (v.json as unknown[]).length, anticipos: (p.json as unknown[]).length };
}

async function abrirCobroDeReserva(page: import("@playwright/test").Page) {
  await fijarEquipo(page, equipoId);
  await page.goto("/pos");
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
  await page.getByRole("button", { name: "Reservas" }).click();
  await page
    .getByRole("listitem", { name: `Reserva de ${nombreCliente}` })
    .getByRole("button", { name: `Completar reserva de ${nombreCliente}` })
    .click();
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  return page.getByRole("alertdialog", { name: "Cobrar venta" });
}

test("respuesta perdida: el servidor guarda el cobro pero el cliente no lo ve", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const producto = await crearProductoConPrecio({ contado: 50, minimo: 40, stock: 10 });
  const reservaId = await reservaApi(producto, 1);
  const cobro = await abrirCobroDeReserva(page);

  // Cada intento llega al servidor (guarda) pero la respuesta se pierde; la comprobación de existencia también falla.
  await page.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await page.route(
    (url) => url.pathname.endsWith("/rest/v1/ventas"),
    (route) => route.abort("failed"),
  );
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro).toContainText("No se confirmó el cobro", { timeout: 30_000 });
  await expect(cobro.getByRole("button", { name: "Reintentar cobro" })).toBeVisible();
  await expect(cobro.getByLabel("Efectivo recibido (Bs)")).toBeDisabled();
  await expect(cobro.getByLabel("Efectivo recibido (Bs)")).toHaveValue("30,00");

  // El carrito no se puede descartar mientras el cobro no se verifique.
  await cobro.getByRole("button", { name: "Volver" }).click();
  await page.getByRole("button", { name: "Descartar reserva" }).click();
  await expect(page.getByText(/cobro sin confirmar de esta reserva/)).toBeVisible();
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();

  await page.unroute("**/rest/v1/rpc/registrar_venta");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page
    .getByRole("alertdialog", { name: "Cobrar venta" })
    .getByRole("button", { name: "Descartar y verificar" })
    .click();
  await expect(page.getByRole("article", { name: /Nota de venta W1-\d{6}/ })).toBeVisible();
  const r = await estadoReserva(reservaId);
  expect(r.estado).toBe("completada");
  expect(await ventasDe(r.venta_id!)).toEqual({ ventas: 1, anticipos: 1 });
});

test("recargar a mitad del cobro de una reserva no la pierde ni la duplica", async ({ page }) => {
  test.setTimeout(90_000);
  const producto = await crearProductoConPrecio({ contado: 50, minimo: 40, stock: 10 });
  const reservaId = await reservaApi(producto, 1);
  const cobro = await abrirCobroDeReserva(page);

  // El servidor guarda la venta pero la respuesta nunca llega al cliente.
  let guardada!: () => void;
  const llegoAlServidor = new Promise<void>((r) => (guardada = r));
  await page.route("**/rest/v1/rpc/registrar_venta", async (route) => {
    await route.fetch();
    guardada();
    await route.abort("failed");
  });
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await llegoAlServidor;
  await page.reload();
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // El cajero ya arma la venta del siguiente cliente: verificar el cobro viejo no debe vaciarla.
  const otro = await crearProductoConPrecio({ contado: 30, minimo: 20, stock: 10 });
  const buscar = page.getByRole("searchbox", { name: "Buscar producto" });
  await buscar.fill(otro.barras);
  await page.keyboard.press("Enter");
  await expect(buscar).toHaveValue("");
  const aviso = page.getByRole("alert").filter({ hasText: "Cobro sin confirmar" });
  await expect(aviso).toBeVisible();
  await aviso.getByRole("button", { name: "Verificar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta W1-\d{6}/ })).toBeVisible();
  const r = await estadoReserva(reservaId);
  expect(r.estado).toBe("completada");
  expect(await ventasDe(r.venta_id!)).toEqual({ ventas: 1, anticipos: 1 });
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await expect(
    page.getByRole("complementary", { name: "Venta" }).getByText(otro.nombre),
  ).toBeVisible();
});

test("nunca llegó: la verificación dice que no se registró y se cobra de nuevo", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const producto = await crearProductoConPrecio({ contado: 50, minimo: 40, stock: 10 });
  const reservaId = await reservaApi(producto, 1);
  const cobro = await abrirCobroDeReserva(page);

  await page.route("**/rest/v1/rpc/registrar_venta", (route) => route.abort("failed"));
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro).toContainText("No se confirmó el cobro", { timeout: 30_000 });
  // Recién enviado: aunque el servidor no lo vea, su transacción pudo estar en vuelo. No se descarta todavía.
  await cobro.getByRole("button", { name: "Descartar y verificar" }).click();
  await expect(cobro).toContainText("Todavía puede estar registrándose");
  await expect(cobro.getByRole("button", { name: "Descartar y verificar" })).toBeVisible();
  // Pasados 60 s sin rastro en el servidor, sí se descarta.
  await page.clock.setFixedTime(new Date(Date.now() + 120_000));
  await cobro.getByRole("button", { name: "Descartar y verificar" }).click();
  await expect(cobro).toContainText("Ese cobro no se registró");
  expect((await estadoReserva(reservaId)).estado).toBe("activa");

  // Con la red de vuelta, el cobro normal completa la reserva con una sola venta.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta W1-\d{6}/ })).toBeVisible();
  const r = await estadoReserva(reservaId);
  expect(r.estado).toBe("completada");
  expect(await ventasDe(r.venta_id!)).toEqual({ ventas: 1, anticipos: 1 });
});
