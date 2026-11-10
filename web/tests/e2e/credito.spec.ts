import { expect, test, type Page } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, fijarEquipo, tienda } from "./pos-helpers";

// E2E-12 (RF-CRE-01 a 06): venta a crédito con inicial y plan, cobro de cuotas por caja, arqueo, saldo inicial y vencidas.
// Cuenta del encargado (gestionar_credito y caja). Equipo propio (W2) y datos únicos por corrida: ningún otro spec usa su caja.
test.use({ storageState: rutaAuth("encargadoTienda") });
test.describe.configure({ mode: "serial" });

let equipoId = "";
let cajaId = "";
let clienteId = "";
const nombreCliente = `Cliente crédito ${corrida}`;
const CUENTA = "encargadoTienda";

test.beforeAll(async () => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W2", "Caja de crédito");
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

type Cuenta = { credito_id: string; saldo: number; cuotas_vencidas: number; dias_atraso: number };
async function cuentas() {
  const r = await apiComo(CUENTA, "rpc/cuentas_por_cobrar", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_cliente_id: clienteId },
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  return r.json as Cuenta[];
}
async function resumen() {
  const r = await apiComo(CUENTA, "rpc/resumen_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: cajaId },
  });
  return r.json as Record<string, number>;
}

async function elegirCliente(page: Page, ambito = page.locator("body")) {
  await ambito.getByRole("button", { name: "Elegir" }).click();
  await ambito.getByRole("textbox", { name: "Buscar cliente" }).fill(nombreCliente);
  await ambito.getByRole("button", { name: new RegExp(nombreCliente) }).click();
}
async function abrirPos(page: Page) {
  await fijarEquipo(page, equipoId);
  await page.goto("/pos");
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
}
async function agregar(page: Page, codigo: string, veces = 1) {
  const buscar = page.getByRole("searchbox", { name: "Buscar producto" });
  for (let i = 0; i < veces; i++) {
    await buscar.fill(codigo);
    await page.keyboard.press("Enter");
    await expect(buscar).toHaveValue("");
  }
}

test("E2E-12: venta a crédito, plan imprimible, cuotas por caja, arqueo, saldo inicial y vencidas", async ({
  page,
}) => {
  // Contado 50, crédito 60, mínimo 45: el piso de crédito es 45 (el menor entre el mínimo y la lista).
  const producto = await crearProductoConPrecio({
    contado: 50,
    credito: 60,
    minimo: 45,
    stock: 20,
  });
  await abrirPos(page);
  await agregar(page, producto.barras, 2);
  await expect(page.getByTestId("total")).toHaveText("Bs 100,00");

  // Activar el crédito: las líneas pasan a la lista crédito y se exige cliente.
  // Se activa al leer los parámetros del servidor, no al instante.
  await page.getByRole("checkbox", { name: /Vender a crédito/ }).click();
  await expect(page.getByRole("checkbox", { name: /Vender a crédito/ })).toBeChecked();
  await expect(page.getByTestId("total")).toHaveText("Bs 120,00");
  await expect(page.getByText("El crédito necesita un cliente.")).toBeVisible();
  await elegirCliente(page);
  const plan = page.getByLabel("Plan de cuotas");
  await expect(plan).toContainText("Inicial Bs 60,00 · a financiar Bs 60,00");
  await expect(plan).toContainText("Cuota 1: Bs 21,01");

  // Inicial bajo el mínimo (50 % de 120) no cobra.
  await page.getByLabel("Inicial (Bs)").fill("50");
  await expect(page.getByText(/La inicial mínima es Bs 60,00/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cobrar/ }).first()).toBeDisabled();
  await page.getByLabel("Inicial (Bs)").fill("");
  await page.getByLabel("Cuotas (1 a 12)").fill("13");
  await expect(page.getByText(/Revisa la inicial y las cuotas \(1 a 12\)/)).toBeVisible();
  await page.getByLabel("Cuotas (1 a 12)").fill("3");
  await page.getByLabel("Cédula de identidad").check();
  await page.getByLabel("Pagaré firmado").check();

  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar la inicial del crédito" });
  await expect(cobro).toContainText("inicial Bs 60,00 ahora y Bs 60,00 en 3 cuotas");
  // El QR pide la misma confirmación que una venta.
  await cobro.getByLabel("Pago por QR (Bs)").fill("10");
  await expect(cobro.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  await cobro.getByLabel("Pago por QR (Bs)").fill("");
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();

  const nota = page.getByRole("article", { name: /Nota de venta W2-\d{6}/ });
  await expect(nota).toBeVisible();
  await expect(nota).toContainText("A crédito en 3 cuotas");
  await expect(nota).toContainText("Bs 120,00");
  // Plan de cuotas imprimible: lo que fijó el servidor.
  await page.getByRole("button", { name: "Plan de cuotas" }).click();
  const hoja = page.getByRole("article", { name: /Plan de cuotas W2-\d{6}/ });
  await expect(hoja).toContainText(nombreCliente);
  await expect(hoja.getByRole("row")).toHaveCount(5); // encabezado, 3 cuotas y total
  await expect(hoja).toContainText("Bs 21,01");
  await expect(hoja).toContainText("Bs 63,02"); // DB-21: capital más interés
  await page.getByRole("button", { name: "Nueva venta" }).click();

  const [credito] = await cuentas();
  expect(credito).toMatchObject({ saldo: 63.02, cuotas_vencidas: 0 });
  // La venta quedó a crédito y no se puede anular desde el sistema.
  const venta = await apiComo(
    CUENTA,
    `creditos?select=venta_id,capital,inicial&id=eq.${credito!.credito_id}`,
  );
  const { venta_id, capital, inicial } = (
    venta.json as { venta_id: string; capital: number; inicial: number }[]
  )[0]!;
  expect({ capital, inicial }).toEqual({ capital: 60, inicial: 60 });
  const anular = await apiComo(CUENTA, "rpc/anular_venta", {
    metodo: "POST",
    cuerpo: { p_venta_id: venta_id, p_motivo: "prueba" },
  });
  expect(anular.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(anular.json)).toContain("ERP_VENTA_CON_CREDITO");

  // Cobrar cuotas: modo Cuotas, parcial en efectivo y luego un pago mixto.
  await page.getByRole("button", { name: "Cuotas" }).click();
  await elegirCliente(page, page.getByRole("region", { name: "Cobrar cuotas" }));
  const fila = page.getByRole("listitem", { name: /Crédito W2-\d{6}/ });
  await expect(fila).toContainText("Saldo Bs 63,02");
  await fila.getByRole("button", { name: /Cobrar cuota de/ }).click();
  const monto = page.getByRole("alertdialog", { name: "Cobrar cuota" });
  await expect(monto.getByLabel("Monto a cobrar (Bs)")).toHaveValue("21,01");
  // Pagar de más no continúa.
  await monto.getByLabel("Monto a cobrar (Bs)").fill("100");
  await expect(monto).toContainText("hasta el saldo");
  await expect(monto.getByRole("button", { name: "Continuar" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await monto.getByLabel("Monto a cobrar (Bs)").fill("21,01");
  await monto.getByRole("button", { name: "Continuar" }).click();
  const cobroCuota = page.getByRole("alertdialog", { name: "Cobrar cuota" });
  await cobroCuota.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cuota cobrada: Bs 21,01" }),
  ).toBeVisible();
  expect((await cuentas())[0]!.saldo).toBe(42.01);

  await page.getByRole("button", { name: /Cobrar cuota de/ }).click();
  await page.getByLabel("Monto a cobrar (Bs)").fill("10");
  await page.getByRole("button", { name: "Continuar" }).click();
  const mixto = page.getByRole("alertdialog", { name: "Cobrar cuota" });
  await mixto.getByLabel("Pago por QR (Bs)").fill("5");
  await mixto.getByLabel(/Confirmo que recibí/).check();
  await mixto.getByLabel("Efectivo recibido (Bs)").fill("5");
  await mixto.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cuota cobrada: Bs 10,00" }),
  ).toBeVisible();
  expect((await cuentas())[0]!.saldo).toBe(32.01);

  // Arqueo: las cuotas entran al esperado y al QR (el desglose suma).
  const r = await resumen();
  expect(r.cuotas_efectivo).toBe(26.01);
  expect(r.cuotas_qr).toBe(5);
  expect(r.esperado).toBe(100 + 60 + 26.01);
  expect(r.qr_neto).toBe(5);

  // Panel: saldo por cliente y detalle del crédito (FIFO: la cuota 1 pagada, la 2 a medias).
  await page.goto("/panel/creditos");
  const saldos = page.getByRole("list", { name: "Saldo por cliente" });
  await expect(saldos).toContainText(nombreCliente);
  await expect(saldos).toContainText("Bs 32,01");
  await page
    .getByRole("link", { name: new RegExp(`Detalle del crédito de ${nombreCliente}`) })
    .click();
  await expect(page.getByRole("cell", { name: "Pagada" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Pagos recibidos" })).toBeVisible();

  // Saldo inicial vencido (RF-CRE-06): sin venta ni caja, aparece en vencidas con días de atraso.
  await page.goto("/panel/creditos");
  const form = page.getByRole("form", { name: "Saldo inicial" });
  await elegirCliente(page, form);
  await form.getByLabel("Saldo que debe (Bs)").fill("300");
  await form.getByLabel("Cuotas restantes").fill("3");
  await form
    .getByLabel("Primera cuota vence")
    .fill(new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10));
  await form.getByRole("button", { name: "Cargar saldo inicial" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `Saldo inicial de ${nombreCliente} cargado` }),
  ).toBeVisible();
  const vencidas = page.getByRole("list", { name: "Cuotas vencidas" });
  await expect(vencidas).toContainText(nombreCliente);
  await expect(vencidas).toContainText(/\d+ días de atraso/);
  const todas = await cuentas();
  expect(todas).toHaveLength(2);
  expect(todas.find((c) => c.cuotas_vencidas > 0)?.dias_atraso).toBeGreaterThan(0);
  // El saldo inicial no tocó la caja.
  expect((await resumen()).esperado).toBe(100 + 60 + 26.01);

  // Un saldo inicial cargado por error se anula con motivo (solo sin pagos) y sale de las cuentas por cobrar.
  const errado = crypto.randomUUID();
  const creado = await apiComo(CUENTA, "rpc/crear_credito_inicial", {
    metodo: "POST",
    cuerpo: {
      p_id: errado,
      p_negocio_id: tienda,
      p_cliente_id: clienteId,
      p_capital: 80,
      p_cuotas: 2,
      p_primera: new Date().toISOString().slice(0, 10),
    },
  });
  expect(creado.status, JSON.stringify(creado.json)).toBeLessThan(300);
  expect(await cuentas()).toHaveLength(3);
  await page.goto(`/panel/creditos/${errado}`);
  await page.getByLabel("Motivo de la anulación").fill("cargado dos veces");
  await page.getByRole("button", { name: "Anular saldo inicial" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Anular saldo inicial" }).click();
  await expect(page.getByText("Anulado: cargado dos veces")).toBeVisible();
  expect(await cuentas()).toHaveLength(2);
});

test("sin conexión no se vende a crédito ni se cobran cuotas", async ({ page }) => {
  await abrirPos(page);
  await page.context().setOffline(true);
  await expect(page.getByRole("checkbox", { name: /Vender a crédito/ })).toBeDisabled();
  await expect(page.getByText("El crédito necesita conexión.")).toBeVisible();
  await page.getByRole("button", { name: "Cuotas" }).click();
  await expect(page.getByText(/Cobrar cuotas necesita conexión/)).toBeVisible();
  await page.context().setOffline(false);
});

// Cobro a crédito sin confirmar: nunca va a la cola; se reintenta en memoria y el cajero verifica contra el servidor.
test("respuesta perdida: el servidor guarda la venta a crédito pero el cliente no la ve", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const producto = await crearProductoConPrecio({
    contado: 50,
    credito: 60,
    minimo: 45,
    stock: 20,
  });
  const antes = (await cuentas()).length;
  await abrirPos(page);
  await agregar(page, producto.barras, 1);
  // Se activa al leer los parámetros del servidor, no al instante.
  await page.getByRole("checkbox", { name: /Vender a crédito/ }).click();
  await expect(page.getByRole("checkbox", { name: /Vender a crédito/ })).toBeChecked();
  await elegirCliente(page);
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar la inicial del crédito" });

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

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await cobro.getByRole("button", { name: "Descartar y verificar" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta W2-\d{6}/ })).toBeVisible();
  // Una sola venta y un solo crédito nuevo, aunque el cobro se reintentó.
  expect((await cuentas()).length).toBe(antes + 1);
});

// El pendiente se guarda en el equipo ANTES de enviar: si la página se recarga o la app se cierra con la respuesta en el
// aire, el POS lo recuerda y se verifica contra el servidor en vez de repetir el cobro (que duplicaría el crédito).
test("recargar a mitad del cobro a crédito no pierde ni duplica la venta", async ({ page }) => {
  test.setTimeout(90_000);
  const producto = await crearProductoConPrecio({
    contado: 50,
    credito: 60,
    minimo: 45,
    stock: 20,
  });
  const ventasDelCliente = async () =>
    (
      (await apiComo(CUENTA, `ventas?select=id&cliente_id=eq.${clienteId}`)).json as {
        id: string;
      }[]
    ).length;
  const antes = (await cuentas()).length;
  const ventasAntes = await ventasDelCliente();
  await abrirPos(page);
  await agregar(page, producto.barras, 1);
  await page.getByRole("checkbox", { name: /Vender a crédito/ }).click();
  await expect(page.getByRole("checkbox", { name: /Vender a crédito/ })).toBeChecked();
  await elegirCliente(page);
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar la inicial del crédito" });

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

  // Tras recargar: carrito vacío, pero el cobro sin confirmar sigue ahí y no se reenvía solo.
  const aviso = page.getByRole("alert").filter({ hasText: "Cobro sin confirmar" });
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText(nombreCliente);
  await aviso.getByRole("button", { name: "Verificar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta W2-\d{6}/ })).toBeVisible();
  expect((await cuentas()).length).toBe(antes + 1);
  expect(await ventasDelCliente()).toBe(ventasAntes + 1);

  // La nota se confirmó: el pendiente ya no existe y el POS queda libre.
  await page.reload();
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();
  await expect(page.getByText("Cobro sin confirmar")).toHaveCount(0);
});

// La cuota queda guardada en el equipo ANTES de enviarse: si la respuesta se pierde y la página se recarga, reaparece como
// cobro sin confirmar y reintentarla (mismo id) deja exactamente un pago.
test("recargar a mitad del cobro de una cuota no la pierde ni la duplica", async ({ page }) => {
  test.setTimeout(90_000);
  const saldoTotal = async () => (await cuentas()).reduce((s, c) => s + c.saldo, 0);
  const antes = await saldoTotal();
  expect(antes).toBeGreaterThan(1);
  await abrirPos(page);
  await page.getByRole("button", { name: "Cuotas" }).click();
  await elegirCliente(page, page.getByRole("region", { name: "Cobrar cuotas" }));
  await page
    .getByRole("listitem", { name: /Crédito/ })
    .first()
    .getByRole("button", { name: /Cobrar cuota de/ })
    .click();
  await page.getByLabel("Monto a cobrar (Bs)").fill("1");
  await page.getByRole("button", { name: "Continuar" }).click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar cuota" });

  // El servidor registra el pago pero la respuesta nunca llega al cliente.
  let guardada!: () => void;
  const llegoAlServidor = new Promise<void>((r) => (guardada = r));
  await page.route("**/rest/v1/rpc/pagar_cuota", async (route) => {
    await route.fetch();
    guardada();
    await route.abort("failed");
  });
  // Con el envío en vuelo la cuota ya está guardada, pero todavía no es un fallo: no se muestra como sin confirmar.
  let soltar!: () => void;
  const retenida = new Promise<void>((r) => (soltar = r));
  await page.route("**/rest/v1/rpc/pagar_cuota", async (route) => {
    await retenida;
    await route.fallback();
  });
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(cobro.getByRole("button", { name: "Enviando…" })).toBeVisible();
  await expect(cobro.getByText("Cobro sin confirmar")).toHaveCount(0);
  await expect(cobro.getByRole("button", { name: "Descartar y verificar" })).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Cobros sin confirmar", includeHidden: true }),
  ).toHaveCount(0);
  soltar();
  await llegoAlServidor;
  // La cuota pendiente bloquea cambiar de equipo en el acto, sin cambiar de modo ni recargar.
  // (el diálogo de cobro deja el resto de la página fuera del árbol de accesibilidad: includeHidden)
  await expect(
    page.getByRole("button", { name: "Cambiar equipo", includeHidden: true }),
  ).toBeDisabled();
  await page.reload();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await expect(page.getByRole("button", { name: "Cambiar equipo" })).toBeDisabled();

  await page.getByRole("button", { name: "Cuotas" }).click();
  const pendiente = page.getByRole("list", { name: "Cobros sin confirmar" });
  await expect(pendiente).toContainText(nombreCliente);
  await pendiente.getByRole("button", { name: "Reintentar o verificar" }).click();
  await page
    .getByRole("alertdialog", { name: "Cobrar cuota" })
    .getByRole("button", { name: "Reintentar cobro" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cuota cobrada: Bs 1,00" }),
  ).toBeVisible();
  expect(await saldoTotal()).toBeCloseTo(antes - 1, 2);
});
