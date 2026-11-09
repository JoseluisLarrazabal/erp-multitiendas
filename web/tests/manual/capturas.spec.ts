import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  abrirCaja,
  apiComo,
  elegirNegocio,
  equipoPropio,
  ir,
  NEGOCIOS,
  rutaAuth,
} from "../e2e/helpers";
import { corrida, ubicaciones } from "../e2e/inventario-helpers";
import {
  anularOrdenApi,
  cerrarCaja,
  cerrarCajaL1,
  crearOrdenApi,
  crearProductoConPrecio,
  equipoC1,
  equipoL1,
  fijarEquipo,
  fijarEquipoL1,
  revisarPendientesL1,
  sesionAbierta,
  sesionAbiertaL1,
  tienda,
} from "../e2e/pos-helpers";

// Capturas del manual de usuario (docs/manual/img). No es una prueba: solo genera las PNG con datos del seed local y
// los que crea aquí. Nunca contra producción. Correr tras `supabase db reset`: los clientes y reservas de una corrida
// anterior aparecerían repetidos en las capturas. Se corre con `pnpm manual:capturas` (config aparte, el CI no la corre).
const IMG = resolve(__dirname, "../../../docs/manual/img");
const foto = async (page: Page, nombre: string) => {
  await page.waitForTimeout(400); // deja terminar transiciones y que se oculte algún aviso
  await page.screenshot({ path: `${IMG}/${nombre}.png`, fullPage: false });
};

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }) => {
  // El dólar paralelo no debe salir a internet ni mostrar error de red.
  await page.route("**/api/dolar-paralelo", (r) =>
    r.fulfill({
      status: 200,
      json: { disponible: true, valor: 9.5, leidoEn: new Date().toISOString() },
    }),
  );
});

const buscarProducto = (page: Page) => page.getByRole("searchbox", { name: "Buscar producto" });
async function agregar(page: Page, codigo: string, veces = 1) {
  for (let i = 0; i < veces; i++) {
    await buscarProducto(page).fill(codigo);
    await page.keyboard.press("Enter");
    await expect(buscarProducto(page)).toHaveValue("");
  }
}
const abrirCobro = async (page: Page) => {
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
};
async function elegirCliente(page: Page, nombre: string, ambito = page.locator("body")) {
  await ambito.getByRole("button", { name: "Elegir" }).click();
  await ambito.getByRole("textbox", { name: "Buscar cliente" }).fill(nombre);
  await ambito
    .getByRole("button", { name: new RegExp(nombre) })
    .first()
    .click();
}
async function crearCliente(nombre: string) {
  const c = await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_datos: { nombre } },
  });
  expect(c.status).toBeLessThan(300);
  return c.json as string;
}

// ---------------------------------------------------------------------------------------------------------------
test.describe("login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo").fill("vendedor.tienda@erp.test");
    await foto(page, "login");
  });
});

// ---------------------------------------------------------------------------------------------------------------
test.describe("POS de la tienda (vendedor)", () => {
  test.use({ storageState: rutaAuth("vendedor") });
  let equipoId = "";
  let cajaDeLaVenta = "";
  test.beforeAll(async () => {
    equipoId = (await equipoC1()).id;
    await cerrarCaja(equipoId);
  });
  test.afterAll(async () => {
    await cerrarCaja(equipoId);
  });

  test("pos-elegir-equipo", async ({ page }) => {
    // Con un solo equipo el POS lo toma solo: se simula la lista de una tienda con dos cajas.
    await page.route("**/rest/v1/dispositivos*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          [
            { nombre: "Caja 1", prefijo: "C1" },
            { nombre: "Caja 2", prefijo: "C2" },
          ].map((e) => ({
            id: crypto.randomUUID(),
            ubicacion_id: crypto.randomUUID(),
            ultimo_numero: 0,
            ...e,
          })),
        ),
      }),
    );
    await page.goto("/pos");
    await expect(page.getByRole("region", { name: "Elegir equipo" })).toBeVisible();
    await foto(page, "pos-elegir-equipo");
  });

  test("pos-abrir-caja", async ({ page }) => {
    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await page.getByLabel("Efectivo inicial (Bs)").fill("100");
    await foto(page, "pos-abrir-caja");
  });

  test("pos-carrito, pos-cobro y pos-nota", async ({ page }) => {
    const funda = await crearProductoConPrecio({
      contado: 25,
      stock: 10,
      nombre: "Funda para celular",
    });
    const cargador = await crearProductoConPrecio({
      contado: 60,
      stock: 10,
      nombre: "Cargador USB-C",
    });
    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await page.getByLabel("Efectivo inicial (Bs)").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(buscarProducto(page)).toBeVisible();
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
    cajaDeLaVenta = (await sesionAbierta(equipoId))!;

    await agregar(page, funda.barras, 2);
    await agregar(page, cargador.barras);
    await expect(page.getByTestId("total")).toHaveText("Bs 110,00");
    await foto(page, "pos-carrito");

    await abrirCobro(page);
    const cobro = page.getByRole("alertdialog", { name: "Cobrar venta" });
    await cobro.getByLabel("Efectivo recibido (Bs)").fill("120");
    await foto(page, "pos-cobro");

    await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
    await expect(page.getByRole("article", { name: /Nota de venta C1-\d{6}/ })).toBeVisible();
    await foto(page, "pos-nota");
    await page.getByRole("button", { name: "Nueva venta" }).click();
  });

  test("pos-sin-conexion", async ({ page, context }) => {
    const radio = await crearProductoConPrecio({
      contado: 80,
      stock: 5,
      nombre: "Audífonos con cable",
    });
    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await expect(buscarProducto(page)).toBeVisible();
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
    await agregar(page, radio.barras);
    await context.setOffline(true);
    await abrirCobro(page);
    const cobro = page.getByRole("alertdialog", { name: "Cobrar venta" });
    await cobro.getByRole("button", { name: "Todo QR" }).click();
    await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
    await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();
    await expect(page.getByText("1 venta sin enviar")).toBeVisible();
    await foto(page, "pos-sin-conexion");

    // Al volver la red la venta se envía sola y sale como "por revisar" en el panel.
    await context.setOffline(false);
    await page.reload();
    await expect(buscarProducto(page)).toBeVisible();
    await expect(page.getByText("1 venta sin enviar")).toHaveCount(0);
  });

  test("pos-reserva", async ({ page }) => {
    const nombre = "Rosa Mamani";
    const clienteId = await crearCliente(nombre);
    const lente = await crearProductoConPrecio({
      contado: 200,
      minimo: 180,
      stock: 6,
      nombre: "Parlante portátil",
    });
    const otro = await crearProductoConPrecio({
      contado: 90,
      minimo: 80,
      stock: 6,
      nombre: "Reloj deportivo",
    });
    // Una reserva ya hecha, para que la lista se vea con datos.
    const previa = await apiComo("vendedor", "rpc/crear_reserva", {
      metodo: "POST",
      cuerpo: {
        p_reserva: {
          id: crypto.randomUUID(),
          dispositivo_id: equipoId,
          caja_sesion_id: (await sesionAbierta(equipoId))!,
          cliente_id: clienteId,
          producto_id: otro.id,
          cantidad: 1,
          precio_acordado: 85,
          anticipo: 30,
          medio: "efectivo",
        },
      },
    });
    expect(previa.status, JSON.stringify(previa.json)).toBeLessThan(300);
    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
    await page.getByRole("button", { name: "Reservas" }).click();
    const form = page.getByRole("form", { name: "Nueva reserva" });
    await elegirCliente(page, nombre, form);
    await form.getByRole("searchbox", { name: "Producto" }).fill(lente.codigo);
    await form.getByRole("button", { name: new RegExp(lente.nombre) }).click();
    await form.getByLabel("Cantidad").fill("1");
    await form.getByLabel("Precio acordado (Bs)").fill("190");
    await form.getByLabel("Anticipo (Bs)").fill("50");
    await expect(page.getByRole("listitem", { name: `Reserva de ${nombre}` })).toBeVisible();
    await foto(page, "pos-reserva");
  });

  test("pos-cerrar-caja", async ({ page }) => {
    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await expect(buscarProducto(page)).toBeVisible();
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    await page.getByLabel("Tipo", { exact: true }).selectOption("gasto");
    await page.getByLabel("Monto (Bs)").fill("5");
    await page.getByLabel("Motivo", { exact: true }).fill("Bolsas");
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    await expect(page.getByRole("list", { name: "Movimientos registrados" })).toBeVisible();
    await page.getByLabel("Efectivo contado (Bs)").fill("235");
    await page.getByRole("button", { name: "Cerrar caja" }).first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page.getByTestId("cierre-esperado")).toBeVisible();
    await foto(page, "pos-cerrar-caja");
  });

  test("para el panel: id de la venta del POS", async () => {
    // Se guarda para panel-venta-detalle (la caja ya está cerrada, pero las ventas quedan).
    const r = await apiComo(
      "vendedor",
      `ventas?select=id,total,origen&caja_sesion_id=eq.${cajaDeLaVenta}&origen=eq.online&order=numero`,
    );
    ventaOnline = (r.json as { id: string }[])[0]?.id ?? "";
    expect(ventaOnline).not.toBe("");
  });
});
let ventaOnline = "";

// ---------------------------------------------------------------------------------------------------------------
test.describe("crédito y cuotas (encargado de tienda)", () => {
  test.use({ storageState: rutaAuth("encargadoTienda") });
  let equipoId = "";
  let cajaId = "";
  const nombre = "Carlos Condori";
  test.beforeAll(async () => {
    const u = await ubicaciones();
    const equipo = await equipoPropio(tienda, u.tienda, "C2", "Caja 2");
    equipoId = equipo.id;
    cajaId = await abrirCaja(tienda, equipo);
    await crearCliente(nombre);
  });
  test.afterAll(async () => {
    await apiComo("dueno", "rpc/cerrar_caja", {
      metodo: "POST",
      cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
    });
  });

  test("pos-credito y pos-cobro-cuota", async ({ page }) => {
    const tablet = await crearProductoConPrecio({
      contado: 50,
      credito: 60,
      minimo: 45,
      stock: 20,
      nombre: "Tablet infantil",
    });
    await fijarEquipo(page, equipoId);
    await page.goto("/pos");
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
    await agregar(page, tablet.barras, 2);
    await page.getByRole("checkbox", { name: /Vender a crédito/ }).click();
    await expect(page.getByRole("checkbox", { name: /Vender a crédito/ })).toBeChecked();
    await elegirCliente(page, nombre);
    await page.getByLabel("Cuotas (1 a 12)").fill("3");
    await page.getByLabel("Cédula de identidad").check();
    await page.getByLabel("Pagaré firmado").check();
    await expect(page.getByLabel("Plan de cuotas")).toContainText("Cuota 1:");
    await foto(page, "pos-credito");

    await abrirCobro(page);
    await page
      .getByRole("alertdialog", { name: "Cobrar la inicial del crédito" })
      .getByRole("button", { name: "Confirmar cobro" })
      .click();
    await expect(page.getByRole("article", { name: /Nota de venta C2-\d{6}/ })).toBeVisible();
    await page.getByRole("button", { name: "Nueva venta" }).click();

    await page.getByRole("button", { name: "Cuotas" }).click();
    await elegirCliente(page, nombre, page.getByRole("region", { name: "Cobrar cuotas" }));
    await page.getByRole("button", { name: /Cobrar cuota de/ }).click();
    const monto = page.getByRole("alertdialog", { name: "Cobrar cuota" });
    await expect(monto.getByLabel("Monto a cobrar (Bs)")).toHaveValue("21,01");
    await foto(page, "pos-cobro-cuota");
    // Se deja una cuota cobrada para que el panel de créditos muestre un pago.
    await monto.getByRole("button", { name: "Continuar" }).click();
    await page
      .getByRole("alertdialog", { name: "Cobrar cuota" })
      .getByRole("button", { name: "Confirmar cobro" })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "Cuota cobrada" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------------------------
test.describe("lavandería (encargado)", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });
  let equipoId = "";
  const creadas: string[] = [];
  test.beforeAll(async () => {
    equipoId = (await equipoL1()).id;
    await cerrarCajaL1(equipoId);
  });
  test.afterAll(async () => {
    await cerrarCajaL1(equipoId);
    await revisarPendientesL1();
    for (const id of creadas) await anularOrdenApi(id);
  });

  test("lav-nueva-orden y lav-ordenes", async ({ page }) => {
    await fijarEquipoL1(page, equipoId);
    await page.goto("/pos");
    await page.getByLabel("Efectivo inicial (Bs)").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(buscarProducto(page)).toBeVisible();
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();

    await agregar(page, "SRV-001", 2);
    await elegirCliente(page, "Cliente Lavandería");
    await page.getByRole("switch", { name: "Express" }).check();
    await page.getByLabel("Prendas", { exact: true }).fill("3");
    await page.getByLabel("Casillero (opcional)").fill("A1");
    await expect(page.getByTestId("total")).toHaveText("Bs 50,00");
    await foto(page, "lav-nueva-orden");

    await abrirCobro(page);
    const cobro = page.getByRole("alertdialog", { name: "Cobrar venta" });
    await cobro.getByLabel("Efectivo recibido (Bs)").fill("50");
    await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
    await expect(page.getByRole("article", { name: /^Boleta L1-\d{6}$/ })).toBeVisible();

    // Órdenes en distintos estados.
    const cajaId = (await sesionAbiertaL1(equipoId))!;
    for (let i = 0; i < 2; i++) creadas.push(await crearOrdenApi({ equipoId, cajaId }));
    const ventas = await apiComo(
      "encargadoLavanderia",
      `ventas?select=id&caja_sesion_id=eq.${cajaId}`,
    );
    for (const v of ventas.json as { id: string }[])
      if (!creadas.includes(v.id)) creadas.push(v.id);
    await page.getByRole("tab", { name: "Órdenes" }).click();
    const primera = page.getByRole("listitem", { name: /^Orden L1-/ }).first();
    await expect(primera).toBeVisible();
    await primera.getByRole("button", { name: /^Pasar a En lavado/ }).click();
    await expect(primera).toContainText("En lavado");
    await foto(page, "lav-ordenes");
  });
});

// ---------------------------------------------------------------------------------------------------------------
test.describe("frial (dueño)", () => {
  test.use({ storageState: rutaAuth("dueno") });
  const FRIAL = NEGOCIOS.frial.id;
  let equipoId = "";
  async function cerrarF1() {
    const s = await apiComo("dueno", "rpc/caja_sesion_abierta", {
      metodo: "POST",
      cuerpo: { p_dispositivo_id: equipoId },
    });
    const id = (s.json as { id: string }[])[0]?.id;
    if (id)
      await apiComo("dueno", "rpc/cerrar_caja", {
        metodo: "POST",
        cuerpo: { p_sesion_id: id, p_monto_contado: 0 },
      });
  }
  test.afterAll(cerrarF1);

  test("frial-venta-kg", async ({ page, context }) => {
    const r = await apiComo("dueno", `dispositivos?select=id&negocio_id=eq.${FRIAL}&prefijo=eq.F1`);
    equipoId = (r.json as { id: string }[])[0]!.id;
    await cerrarF1();
    await elegirNegocio(context, FRIAL);
    await page.addInitScript(
      ([clave, id]) => localStorage.setItem(clave!, id!),
      [`erp:pos:equipo:${FRIAL}`, equipoId],
    );
    await page.goto("/pos");
    await expect(page.getByLabel("Negocio activo")).toHaveValue(FRIAL);
    await page.getByLabel("Efectivo inicial (Bs)").fill("0");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(buscarProducto(page)).toBeVisible();
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
    await agregar(page, "COR-001");
    await page.getByLabel("Kg de Corte Demo A").fill("1,255");
    await expect(page.getByTestId("total")).toHaveText("Bs 75,30");
    await foto(page, "frial-venta-kg");
  });
});

// ---------------------------------------------------------------------------------------------------------------
test.describe("panel (dueño)", () => {
  test.use({ storageState: rutaAuth("dueno") });
  test.beforeEach(async ({ context }) => {
    await elegirNegocio(context, NEGOCIOS.tienda.id);
  });

  test("panel-inicio", async ({ page }) => {
    await ir(page, "/panel");
    await foto(page, "panel-inicio");
  });

  test("panel-precios", async ({ page }) => {
    await ir(page, "/panel/precios");
    await foto(page, "panel-precios");
  });

  test("panel-inventario-entrada", async ({ page }) => {
    await ir(page, "/panel/inventario/entrada");
    await page.getByRole("combobox", { name: "Producto" }).fill("CEL-001");
    await page.getByRole("option", { name: /Celular Demo A/ }).click();
    await page.getByLabel("Cantidad").fill("10");
    await foto(page, "panel-inventario-entrada");
  });

  test("panel-venta-detalle", async ({ page }) => {
    await ir(page, `/panel/ventas/${ventaOnline}`);
    await foto(page, "panel-venta-detalle");
  });

  test("panel-reconciliacion", async ({ page }) => {
    await ir(page, "/panel/reconciliacion");
    await expect(page.getByTestId("reco-venta").first()).toBeVisible();
    await foto(page, "panel-reconciliacion");
    // Se marcan revisadas para no dejar la reconciliación con pendientes.
    const filas = await apiComo(
      "dueno",
      `ventas?select=id&negocio_id=eq.${tienda}&revisada_por=is.null&motivos_revision=not.eq.{}`,
    );
    for (const v of filas.json as { id: string }[])
      await apiComo("dueno", "rpc/revisar_venta", { metodo: "POST", cuerpo: { p_venta_id: v.id } });
  });

  test("panel-compra-nueva y panel-proveedores", async ({ page }) => {
    const proveedor = "Distribuidora Andina";
    const producto = await crearProductoConPrecio({
      contado: 40,
      stock: 1,
      nombre: "Batería externa",
    });
    await ir(page, "/panel/proveedores");
    await page.getByRole("form", { name: "Proveedor nuevo" }).getByLabel("Nombre").fill(proveedor);
    await page.getByRole("button", { name: "Guardar proveedor" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Proveedor guardado." })).toBeVisible();

    await ir(page, "/panel/compras/nueva");
    await page.getByLabel("Proveedor", { exact: true }).selectOption({ label: proveedor });
    await page.getByRole("combobox", { name: "Producto" }).fill(producto.codigo);
    await page.getByRole("option", { name: new RegExp(producto.nombre) }).click();
    await page.getByLabel("Cantidad").fill("10");
    await page.getByLabel("Costo unitario (Bs)").fill("22,5");
    await expect(page.getByText("Total: Bs 225,00")).toBeVisible();
    await foto(page, "panel-compra-nueva");

    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Compra registrada" })).toBeVisible();
    await ir(page, "/panel/proveedores");
    await expect(page.getByRole("listitem").filter({ hasText: proveedor })).toContainText(
      "Deuda Bs 225,00",
    );
    await foto(page, "panel-proveedores");
  });

  test("panel-creditos", async ({ page }) => {
    await ir(page, "/panel/creditos");
    await expect(page.getByRole("list", { name: "Saldo por cliente" })).toContainText(
      "Carlos Condori",
    );
    await foto(page, "panel-creditos");
  });

  test("panel-reportes", async ({ page }) => {
    await ir(page, "/panel/reportes");
    await foto(page, "panel-reportes");
  });

  test("panel-usuarios", async ({ page }) => {
    await ir(page, "/panel/usuarios");
    await foto(page, "panel-usuarios");
  });
});

// ---------------------------------------------------------------------------------------------------------------
test.describe("panel de lavandería (encargado)", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });
  test("panel-insumo-consumo", async ({ page, context }) => {
    const LAV = NEGOCIOS.lavanderia.id;
    await elegirNegocio(context, LAV);
    const codigo = `INS-${corrida}`;
    const nombre = "Detergente líquido";
    const creado = await apiComo("encargadoLavanderia", "rpc/guardar_producto", {
      metodo: "POST",
      cuerpo: {
        p_negocio_id: LAV,
        p_datos: { codigo, nombre, tipo: "insumo", unidad: "unidad", stock_minimo: 2 },
      },
    });
    expect(creado.status, JSON.stringify(creado.json)).toBeLessThan(300);
    const ubic = await apiComo("encargadoLavanderia", `ubicaciones?select=id&negocio_id=eq.${LAV}`);
    const entrada = await apiComo("encargadoLavanderia", "rpc/registrar_entrada", {
      metodo: "POST",
      cuerpo: {
        p_operacion_id: crypto.randomUUID(),
        p_negocio_id: LAV,
        p_producto_id: creado.json as string,
        p_ubicacion_id: (ubic.json as { id: string }[])[0]!.id,
        p_cantidad: 10,
        p_costo_unitario: 5,
        p_motivo: null,
      },
    });
    expect(entrada.status, JSON.stringify(entrada.json)).toBeLessThan(300);

    await ir(page, "/panel/inventario/salida?tipo=consumo");
    await page.getByRole("combobox", { name: "Insumo" }).fill(codigo);
    await page.getByRole("option", { name: new RegExp(nombre) }).click();
    await page.getByLabel("Cantidad").fill("3");
    await page.getByLabel("Motivo").fill("lavado de la mañana");
    await foto(page, "panel-insumo-consumo");
  });
});
