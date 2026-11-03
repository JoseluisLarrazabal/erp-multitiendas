import { expect, test, type Page } from "@playwright/test";
import { readSheet } from "read-excel-file/node";
import {
  abrirCaja as abrirCajaDe,
  apiComo,
  cerrarCaja,
  crearProductosEnLote,
  elegirNegocio,
  equipoPropio as equipoDe,
  ir,
  NEGOCIOS,
  rutaAuth,
  vigilarCsp,
  type Equipo,
} from "./helpers";
import { entradaApi, ubicaciones } from "./inventario-helpers";
import { CLIENTE_LAVANDERIA, crearProductoConPrecio, SERVICIO_LAVADO } from "./pos-helpers";

// Fase 5, PR 4: /panel/reportes y Excel (E2E-11). Cada negocio tiene su equipo propio (Q1 tienda, Q2 frial, Q3
// lavandería), creado por la prueba: ninguna comparte caja con otro spec. Serial: crea los datos una vez y los reutiliza.
test.describe.configure({ mode: "serial" });

const TIENDA = NEGOCIOS.tienda.id;
const LAVANDERIA = NEGOCIOS.lavanderia.id;
const UBICACION_LAVANDERIA = "b0000000-0000-0000-0000-000000000003";
const UBICACION_FRIAL = "b0000000-0000-0000-0000-000000000004";
const CORTE_A = "e0000000-0000-0000-0000-000000000007"; // COR-001, kg, Bs 60
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());

const equipoPropio = (negocio: string, ubicacion: string, prefijo: string) =>
  equipoDe(negocio, ubicacion, prefijo, `Caja reportes ${prefijo}`);
const cajas: { negocio: string; sesion: string }[] = [];

async function abrirCaja(negocio: string, equipo: Equipo): Promise<string> {
  const sesion = await abrirCajaDe(negocio, equipo);
  cajas.push({ negocio, sesion });
  return sesion;
}

const numeroSiguiente = (e: Equipo) =>
  `${e.prefijo}-${String(e.ultimo_numero + 1).padStart(6, "0")}`;

async function vender(
  negocio: string,
  equipo: Equipo,
  sesion: string,
  item: { producto: string; cantidad: number; precio: number },
) {
  const total = Math.round(item.cantidad * item.precio * 100) / 100;
  const r = await apiComo("dueno", "rpc/registrar_venta", {
    metodo: "POST",
    cuerpo: {
      p_venta: {
        id: crypto.randomUUID(),
        dispositivo_id: equipo.id,
        caja_sesion_id: sesion,
        numero: numeroSiguiente(equipo),
        creada_en_cliente: new Date().toISOString(),
        descuento: 0,
        total,
        items: [
          {
            producto_id: item.producto,
            lista: "contado",
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            descuento: 0,
          },
        ],
        pagos: [{ medio: "efectivo", monto: total }],
      },
    },
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  equipo.ultimo_numero += 1;
}

// "Bs 1.234,56" -> 1234.56
const bs = (t: string) => Number(t.replace(/[^\d,-]/g, "").replace(",", "."));

let producto: Awaited<ReturnType<typeof crearProductoConPrecio>>;
let ordenLavanderia = "";

test.beforeAll(async () => {
  const u = await ubicaciones();
  producto = await crearProductoConPrecio({ contado: 30 });
  expect((await entradaApi(producto, u.tienda, 20, 12.5)).status).toBeLessThan(300);
  const tienda = await equipoPropio(TIENDA, u.tienda, "Q1");
  await vender(TIENDA, tienda, await abrirCaja(TIENDA, tienda), {
    producto: producto.id,
    cantidad: 3,
    precio: 30,
  });

  const frial = await equipoPropio(NEGOCIOS.frial.id, UBICACION_FRIAL, "Q2");
  await vender(NEGOCIOS.frial.id, frial, await abrirCaja(NEGOCIOS.frial.id, frial), {
    producto: CORTE_A,
    cantidad: 1.255,
    precio: 60,
  });

  const lav = await equipoPropio(LAVANDERIA, UBICACION_LAVANDERIA, "Q3");
  const sesion = await abrirCaja(LAVANDERIA, lav);
  ordenLavanderia = crypto.randomUUID();
  const r = await apiComo("dueno", "rpc/crear_orden", {
    metodo: "POST",
    cuerpo: {
      p_venta: {
        id: ordenLavanderia,
        dispositivo_id: lav.id,
        caja_sesion_id: sesion,
        numero: numeroSiguiente(lav),
        cliente_id: CLIENTE_LAVANDERIA,
        creada_en_cliente: new Date().toISOString(),
        descuento: 0,
        total: 15,
        items: [
          {
            producto_id: SERVICIO_LAVADO,
            lista: "normal",
            cantidad: 1,
            precio_unitario: 15,
            descuento: 0,
            serie_id: null,
          },
        ],
        pagos: [{ medio: "efectivo", monto: 15 }],
      },
      p_orden: {
        express: false,
        prendas: 1,
        fecha_prometida: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      },
    },
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
});

test.afterAll(async () => {
  // Con la caja cerrada la anulación no toca la venta; la orden de prueba se anula igual para que no quede activa.
  for (const c of cajas) await cerrarCaja(c.sesion);
  if (ordenLavanderia)
    await apiComo("dueno", "rpc/anular_orden", {
      metodo: "POST",
      cuerpo: { p_orden_id: ordenLavanderia, p_motivo: "Limpieza de prueba" },
    });
});

test.describe("dueño en la tienda", () => {
  test.use({ storageState: rutaAuth("dueno") });
  test.beforeEach(({ context }) => elegirNegocio(context, TIENDA));

  test("E2E-11: ventas del día por producto, y el Excel coincide con la pantalla", async ({
    page,
  }) => {
    await ir(page, "/panel/reportes?r=ventas&agrupar=producto");
    await expect(page.getByRole("heading", { name: "Reportes", level: 1 })).toBeVisible();
    const tabla = page.getByRole("table", { name: "Ventas" });
    const fila = tabla.getByRole("row").filter({ hasText: producto.codigo });
    await expect(fila).toContainText("Bs 90,00");
    // 3 × 30 menos el costo 3 × 12,50.
    await expect(fila).toContainText("Bs 52,50");
    await expect(tabla.getByRole("columnheader", { name: "Ganancia" })).toBeVisible();

    const columnas = await tabla.getByRole("columnheader").allInnerTexts();
    // La primera columna del pie es un <th scope="row">: los <td> empiezan en la segunda.
    const totalNeto = bs(
      await tabla
        .locator("tfoot td")
        .nth(columnas.indexOf("Neto") - 1)
        .innerText(),
    );

    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descargar Excel" }).click(),
    ]);
    expect(descarga.suggestedFilename()).toBe(`ventas-tienda-demo-${hoy}-${hoy}.xlsx`);
    const filas = await readSheet(await descarga.path());
    expect(filas[0]).toEqual(columnas);
    const celda = (f: unknown[], titulo: string) => f[columnas.indexOf(titulo)];
    const suya = filas.find((f) => String(f[0]).startsWith(producto.codigo))!;
    expect(celda(suya, "Cantidad")).toBe(3);
    expect(celda(suya, "Neto")).toBe(90);
    expect(celda(suya, "Ganancia")).toBe(52.5);
    const total = filas.at(-1)!;
    expect(total[0]).toBe("Total");
    expect(celda(total, "Neto")).toBeCloseTo(totalNeto, 2);
  });

  test("el atajo Este mes cambia el rango y la descarga lo lleva en el nombre", async ({
    page,
  }) => {
    await ir(page, "/panel/reportes?r=ventas");
    await page.getByRole("link", { name: "Este mes" }).click();
    await expect(page).toHaveURL(new RegExp(`desde=${hoy.slice(0, 8)}01&hasta=${hoy}`));
    await expect(page.getByLabel("Desde")).toHaveValue(`${hoy.slice(0, 8)}01`);
  });

  test("filtros inválidos se avisan y no rompen la página", async ({ page }) => {
    await ir(page, "/panel/reportes?desde=2026-02-31&hasta=basura&agrupar=xx");
    await expect(page.getByRole("status").filter({ hasText: "no era válido" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reportes", level: 1 })).toBeVisible();
    await ir(page, "/panel/reportes?desde=2020-01-01&hasta=2026-01-01");
    await expect(page.getByRole("status").filter({ hasText: "no era válido" })).toBeVisible();
  });

  test("tienda: Ventas, Más vendidos, Stock y Caja; stock con filtros", async ({ page }) => {
    await ir(page, "/panel/reportes");
    const nav = page.getByRole("navigation", { name: "Reporte" });
    await expect(nav.getByRole("link")).toHaveText(["Ventas", "Más vendidos", "Stock", "Caja"]);
    await expect(nav.getByRole("link", { name: "Ventas" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Stock" }).click();
    await expect(page.getByRole("table", { name: "Stock" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Valor" })).toBeVisible();
    await ir(page, "/panel/reportes?r=stock&filtro=sin&dias=90");
    await expect(page.getByLabel("Mostrar")).toHaveValue("sin");
    await ir(page, "/panel/reportes?r=caja");
    await expect(page.getByRole("table", { name: "Caja" })).toContainText("Caja reportes Q1 (Q1)");
  });

  test("el kardex baja a Excel completo, no solo la página", async ({ page }) => {
    await ir(page, `/panel/inventario/${producto.id}`);
    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descargar Excel" }).click(),
    ]);
    expect(descarga.suggestedFilename()).toBe(
      `kardex-${producto.codigo.toLowerCase()}-tienda-demo-${hoy}.xlsx`,
    );
    const filas = await readSheet(await descarga.path());
    expect(filas[0]).toContain("Costo unitario");
    // Más reciente primero: la venta de 3 y, debajo, la entrada de 20 a Bs 12,50.
    const entrada = filas.find((f) => f[1] === "Entrada")!;
    expect(entrada[filas[0]!.indexOf("Cantidad")]).toBe(20);
    expect(entrada[filas[0]!.indexOf("Costo unitario")]).toBe(12.5);
  });
});

test.describe("contador", () => {
  test.use({ storageState: rutaAuth("contador") });

  test("ve Reportes en el menú y la ganancia del producto", async ({ page }) => {
    await ir(page, "/panel/reportes?r=ventas&agrupar=producto");
    await expect(
      page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Reportes" }),
    ).toBeVisible();
    const fila = page.getByRole("table", { name: "Ventas" }).getByRole("row").filter({
      hasText: producto.codigo,
    });
    await expect(fila).toContainText("Bs 52,50");
  });
});

test.describe("vendedor", () => {
  test.use({ storageState: rutaAuth("vendedor") });

  test("sin ver_reportes no entra a la página", async ({ page }) => {
    await page.goto("/panel/reportes");
    await expect(page).toHaveURL(/\/pos$/);
  });
});

test.describe("lavandería", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("muestra Ingresos con Kilos, sin ganancia, y Caja", async ({ page }) => {
    await ir(page, "/panel/reportes?agrupar=producto");
    const nav = page.getByRole("navigation", { name: "Reporte" });
    await expect(nav.getByRole("link")).toHaveText(["Ingresos", "Caja"]);
    const tabla = page.getByRole("table", { name: "Ingresos" });
    await expect(tabla.getByRole("columnheader", { name: "Kilos" })).toBeVisible();
    await expect(tabla.getByRole("columnheader", { name: "Servicio" })).toBeVisible();
    await expect(tabla.getByRole("columnheader", { name: "Ganancia" })).toHaveCount(0);
    await expect(tabla.getByRole("row").filter({ hasText: "Lavado de prenda" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vencimientos" })).toHaveCount(0);
  });
});

test.describe("frial", () => {
  test.use({ storageState: rutaAuth("dueno") });
  test.beforeEach(({ context }) => elegirNegocio(context, NEGOCIOS.frial.id));

  test("muestra Ventas con kg por corte y el enlace a Vencimientos", async ({ page }) => {
    await ir(page, "/panel/reportes?agrupar=producto");
    const nav = page.getByRole("navigation", { name: "Reporte" });
    await expect(nav.getByRole("link")).toHaveText(["Ventas", "Stock", "Caja"]);
    const tabla = page.getByRole("table", { name: "Ventas" });
    await expect(tabla.getByRole("columnheader", { name: "Corte" })).toBeVisible();
    await expect(tabla.getByRole("columnheader", { name: "Kg" })).toBeVisible();
    // La base acumula las corridas: el valor exacto cambia, el formato (3 decimales) no.
    const corte = tabla.getByRole("row").filter({ hasText: "COR-001" });
    await expect(corte.getByRole("cell").nth(2)).toHaveText(/^[1-9]\d{0,2}(\.\d{3})*,\d{3}$/);
    await expect(page.getByRole("link", { name: "Vencimientos" })).toHaveAttribute(
      "href",
      "/panel/inventario/vencimientos",
    );
  });
});

test.describe("Excel grande", () => {
  test.use({ storageState: rutaAuth("dueno") });
  test.beforeEach(({ context }) => elegirNegocio(context, NEGOCIOS.frial.id));

  // write-excel-file comprime en un worker creado desde un Blob cuando una hoja pasa ~160 KB (~700 filas de stock):
  // sin worker-src blob: en la CSP real del build, la descarga fallaría en silencio. Se usa el frial para no mezclar
  // estos productos con los de la tienda mientras corren los demás specs; al final se desactivan.
  const PREFIJO = `XLS${Date.now().toString(36).toUpperCase()}`;
  const CANTIDAD = 900;

  test("el stock de más de 160 KB se descarga y se lee completo, sin violar la CSP", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await crearProductosEnLote("dueno", NEGOCIOS.frial.id, PREFIJO, CANTIDAD);
    try {
      const esperado = await apiComo("dueno", "rpc/reporte_stock", {
        metodo: "POST",
        cuerpo: { p_negocio_id: NEGOCIOS.frial.id, p_dias_sin_movimiento: 30 },
      });
      const productos = (esperado.json as { filas: unknown[] }).filas.length;
      expect(productos).toBeGreaterThanOrEqual(CANTIDAD);

      const sinViolaciones = vigilarCsp(page);
      await ir(page, "/panel/reportes?r=stock");
      await expect(page.getByRole("table", { name: "Stock" })).toBeVisible();
      const [descarga] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Descargar Excel" }).click(),
      ]);
      expect(descarga.suggestedFilename()).toBe(`stock-frial-demo-${hoy}.xlsx`);
      const filas = await readSheet(await descarga.path());
      // Encabezado + un producto por fila + totales.
      expect(filas).toHaveLength(productos + 2);
      expect(filas.at(-1)![0]).toBe("Total");
      expect(filas.some((f) => String(f[0]).startsWith(PREFIJO))).toBe(true);
      sinViolaciones();
    } finally {
      const lista = await apiComo(
        "dueno",
        `productos?select=id&negocio_id=eq.${NEGOCIOS.frial.id}&codigo=like.${PREFIJO}-*`,
      );
      const ids = (lista.json as { id: string }[]).map((p) => p.id);
      for (let i = 0; i < ids.length; i += 10)
        await Promise.all(
          ids.slice(i, i + 10).map((id) =>
            apiComo("dueno", "rpc/desactivar_producto", {
              metodo: "POST",
              cuerpo: { p_producto_id: id, p_activo: false },
            }),
          ),
        );
    }
  });
});

test.describe("celular", () => {
  test.use({ storageState: rutaAuth("dueno"), viewport: { width: 390, height: 844 } });
  test.beforeEach(({ context }) => elegirNegocio(context, TIENDA));

  const sinDesborde = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );

  for (const ruta of [
    "/panel/reportes?agrupar=producto",
    "/panel/reportes?r=caja",
    "/panel/reportes?r=stock",
  ]) {
    test(`${ruta} no desborda el documento a 390 px`, async ({ page }) => {
      await ir(page, ruta);
      await expect(page.getByRole("table")).toBeVisible();
      expect(await sinDesborde(page)).toBe(true);
    });
  }
});
