import { expect, test } from "@playwright/test";
import { abrirCaja, apiComo, cerrarCaja, equipoPropio, ir, rutaAuth } from "./helpers";
import { crearProductoConPrecio } from "./pos-helpers";
import { crearProducto, entradaApi, tienda, ubicaciones } from "./inventario-helpers";

// Tablero del Inicio (fase 3.3, R2). Solo estructura: otras specs venden y mueven stock en paralelo, así que los
// montos y los conteos cambian entre una carga y otra.
const SECCION = (titulo: string) =>
  `section[aria-labelledby="bloque-${titulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}"]`;
const ENCARGADO = "c0000000-0000-0000-0000-000000000002";

test.describe("dueño en la tienda", () => {
  test.use({ storageState: rutaAuth("dueno") });
  let sesion: string;
  let ventaPorRevisar = "";

  test.beforeAll(async () => {
    const u = await ubicaciones();
    sesion = await abrirCaja(
      tienda,
      await equipoPropio(tienda, u.tienda, "U4", "Caja del tablero"),
    );
    const bajo = await crearProducto({ stockMinimo: 50 });
    await entradaApi(bajo, u.tienda, 1);
    // Una venta enviada sin conexión con QR sin verificar: queda por reconciliar.
    const equipo = await equipoPropio(tienda, u.tienda, "U4");
    const producto = await crearProductoConPrecio({ contado: 50, stock: 5 });
    const ultimo = await apiComo("dueno", `dispositivos?select=ultimo_numero&id=eq.${equipo.id}`);
    const numero = `U4-${String((ultimo.json as { ultimo_numero: number }[])[0]!.ultimo_numero + 1).padStart(6, "0")}`;
    const v = await apiComo("dueno", "rpc/registrar_venta", {
      metodo: "POST",
      cuerpo: {
        p_venta: {
          id: crypto.randomUUID(),
          dispositivo_id: equipo.id,
          caja_sesion_id: sesion,
          numero,
          creada_en_cliente: new Date().toISOString(),
          descuento: 0,
          total: 50,
          items: [
            {
              producto_id: producto.id,
              lista: "contado",
              cantidad: 1,
              precio_unitario: 50,
              descuento: 0,
            },
          ],
          pagos: [{ medio: "qr", monto: 50, verificado: false }],
        },
        p_offline: { vendedor_id: ENCARGADO, tipo_cambio: null, numero_impreso: null },
      },
    });
    expect(v.status, JSON.stringify(v.json)).toBeLessThan(300);
    ventaPorRevisar = numero;
  });
  test.afterAll(async () => {
    await cerrarCaja(sesion);
  });

  test("título con la fecha, acciones y bloques del negocio", async ({ page }) => {
    await ir(page, "/panel");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/^Inicio: \S+ \d{1,2} de /);
    for (const nombre of [
      "Abrir punto de venta",
      "Nueva compra",
      "Entrada de inventario",
      "Ver reportes",
    ])
      await expect(page.getByRole("link", { name: nombre })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir punto de venta" })).toHaveAttribute(
      "href",
      "/pos",
    );
    for (const titulo of [
      "Ventas de hoy",
      "Cajas abiertas",
      "Créditos y pagos",
      "Stock bajo",
      "Más vendidos de la semana",
    ])
      await expect(page.locator(SECCION(titulo))).toBeVisible();
    await expect(page.locator(SECCION("Órdenes listas"))).toHaveCount(0);
    await expect(page.locator(SECCION("Lotes por vencer"))).toHaveCount(0);
  });

  test("la tabla de cajas abiertas y la de stock bajo traen sus encabezados", async ({ page }) => {
    await ir(page, "/panel");
    const cajas = page.getByRole("table", { name: "Cajas abiertas ahora" });
    for (const t of ["Equipo", "Cajero", "Desde", "Cobrado en ventas"])
      await expect(cajas.getByRole("columnheader", { name: t })).toBeVisible();
    await expect(cajas.getByRole("row", { name: /Caja del tablero/ })).toBeVisible();
    const bajo = page.getByRole("table", { name: /Productos bajo su mínimo/ });
    for (const t of ["Producto", "Hay", "Mínimo"])
      await expect(bajo.getByRole("columnheader", { name: t })).toBeVisible();
    expect(await bajo.getByRole("row").count()).toBeGreaterThan(1);
  });

  test("Por atender siempre existe: con la venta por reconciliar trae su aviso, un enlace por fila", async ({
    page,
  }) => {
    await ir(page, "/panel");
    const caja = page.getByRole("region", { name: "Por atender" });
    await expect(caja).toBeVisible();
    await expect(caja.getByTestId("aviso-por-revisar")).toContainText(/ventas? por revisar/);
    expect(ventaPorRevisar).toMatch(/^U4-/);
    const avisos = caja.getByRole("listitem");
    expect(await avisos.count()).toBeGreaterThan(0);
    for (const aviso of await avisos.all()) {
      await expect(aviso.getByRole("link")).toHaveCount(1);
      await expect(aviso.getByRole("button")).toHaveCount(0);
    }
  });

  test("a 390 px las acciones y los avisos quedan antes de Ventas de hoy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ir(page, "/panel");
    const ventas = await page.locator(SECCION("Ventas de hoy")).boundingBox();
    const acciones = await page.getByRole("group", { name: "Acciones frecuentes" }).boundingBox();
    expect(acciones!.y).toBeLessThan(ventas!.y);
    const aviso = await page.getByRole("region", { name: "Por atender" }).boundingBox();
    expect(aviso!.y).toBeGreaterThan(acciones!.y);
    expect(aviso!.y).toBeLessThan(ventas!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});

test.describe("contador", () => {
  test.use({ storageState: rutaAuth("contador") });

  test("ve reportes pero no tiene acciones de escritura ni reservas", async ({ page }) => {
    await ir(page, "/panel");
    await expect(page.getByRole("link", { name: "Ver reportes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva compra" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Abrir punto de venta" })).toHaveCount(0);
    await expect(page.locator(SECCION("Ventas de hoy"))).toBeVisible();
    await expect(page.getByText("Reservas activas")).toHaveCount(0);
  });
});

test.describe("encargado de la lavandería", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("ve órdenes y no créditos ni más vendidos", async ({ page }) => {
    await ir(page, "/panel");
    await expect(page.locator(SECCION("Órdenes listas"))).toBeVisible();
    await expect(page.locator(SECCION("Ventas de hoy"))).toBeVisible();
    await expect(page.getByRole("region", { name: "Por atender" })).toBeVisible();
    // Con gestionar_compras (matriz) ve los pagos a proveedores; sin crédito, ni cuotas ni reservas.
    await expect(page.getByRole("region", { name: "Pagos a proveedores" })).toBeVisible();
    await expect(page.locator(SECCION("Créditos y pagos"))).toHaveCount(0);
    await expect(page.locator(SECCION("Más vendidos de la semana"))).toHaveCount(0);
    await expect(page.getByText("Cuotas vencidas")).toHaveCount(0);
    await expect(page.getByText("Sin cuotas vencidas")).toHaveCount(0);
    await expect(page.getByText("Reservas activas")).toHaveCount(0);
    await expect(page.getByText("Sin reservas activas")).toHaveCount(0);
  });
});
