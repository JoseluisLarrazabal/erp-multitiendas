import { expect, test, type Page } from "@playwright/test";
import { apiComo, ir, rutaAuth } from "./helpers";
import {
  cerrarCaja,
  crearProductoConPrecio,
  stockEn,
  tienda,
  type ProductoPos,
} from "./pos-helpers";
import { entradaApi, ubicaciones } from "./inventario-helpers";

// RF-VEN-13: /panel/reconciliacion. Las ventas se crean por RPC con la sesión del vendedor y p_offline (la prueba mira
// el panel, no el POS). Equipo propio (R9): C1 y su caja son de pos-venta, que corre en paralelo.
const ENCARGADO = "c0000000-0000-0000-0000-000000000002";
const VENDEDOR = "c0000000-0000-0000-0000-000000000004";

test.describe.configure({ mode: "serial" });

let equipoId = "";
let cajaId = "";
let conQr: { id: string; numero: string };
let soloMotivo: { id: string; numero: string };
let qrRechazado: { id: string; numero: string };
let negativo: ProductoPos;
let mixto: ProductoPos;

async function asegurarEquipo() {
  const u = await ubicaciones();
  await apiComo("dueno", "rpc/registrar_dispositivo", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: tienda,
      p_ubicacion_id: u.tienda,
      p_nombre: "Caja reconciliación",
      p_prefijo: "R9",
    },
  });
  const r = await apiComo(
    "vendedor",
    `dispositivos?select=id,ultimo_numero&negocio_id=eq.${tienda}&prefijo=eq.R9`,
  );
  const fila = (r.json as { id: string }[])[0];
  if (!fila) throw new Error("No se pudo crear el equipo R9.");
  return fila.id;
}

// Venta enviada sin conexión por el vendedor. `como` = quien vendió: otra persona deja la marca otra_cuenta.
async function ventaOffline(opts: {
  producto: ProductoPos;
  cantidad: number;
  precio: number;
  qr: boolean;
  como: string;
}) {
  const r = await apiComo("vendedor", `dispositivos?select=ultimo_numero&id=eq.${equipoId}`);
  const numero = `R9-${String((r.json as { ultimo_numero: number }[])[0]!.ultimo_numero + 1).padStart(6, "0")}`;
  const id = crypto.randomUUID();
  const total = opts.cantidad * opts.precio;
  const v = await apiComo("vendedor", "rpc/registrar_venta", {
    metodo: "POST",
    cuerpo: {
      p_venta: {
        id,
        dispositivo_id: equipoId,
        caja_sesion_id: cajaId,
        numero,
        creada_en_cliente: new Date().toISOString(),
        descuento: 0,
        total,
        items: [
          {
            producto_id: opts.producto.id,
            lista: "contado",
            cantidad: opts.cantidad,
            precio_unitario: opts.precio,
            descuento: 0,
          },
        ],
        pagos: [
          opts.qr
            ? { medio: "qr", monto: total, verificado: false }
            : { medio: "efectivo", monto: total },
        ],
      },
      p_offline: { vendedor_id: opts.como, tipo_cambio: null, numero_impreso: null },
    },
  });
  expect(v.status).toBeLessThan(300);
  return { id, numero };
}

const venta = (page: Page, numero: string) =>
  page.getByTestId("reco-venta").filter({ hasText: numero });

async function pagosDe(ventaId: string) {
  const r = await apiComo(
    "dueno",
    `venta_pagos?select=verificacion,verificado_por&venta_id=eq.${ventaId}`,
  );
  return r.json as { verificacion: string; verificado_por: string | null }[];
}
async function revisadaPor(ventaId: string) {
  const r = await apiComo("dueno", `ventas?select=revisada_por&id=eq.${ventaId}`);
  return (r.json as { revisada_por: string | null }[])[0]?.revisada_por ?? null;
}

test.beforeAll(async () => {
  equipoId = await asegurarEquipo();
  await cerrarCaja(equipoId);
  // Apertura sin conexión: la registra el encargado y la envía el vendedor.
  cajaId = crypto.randomUUID();
  const a = await apiComo("vendedor", "rpc/abrir_caja", {
    metodo: "POST",
    cuerpo: {
      p_id: cajaId,
      p_negocio_id: tienda,
      p_dispositivo_id: equipoId,
      p_monto_inicial: 100,
      p_offline: { creada_en: new Date().toISOString(), usuario_id: ENCARGADO },
    },
  });
  expect(a.status).toBeLessThan(300);
  const conStock = await crearProductoConPrecio({ contado: 50, stock: 5 });
  negativo = await crearProductoConPrecio({ contado: 20 });
  mixto = await crearProductoConPrecio({ contado: 20 });
  conQr = await ventaOffline({
    producto: conStock,
    cantidad: 1,
    precio: 50,
    qr: true,
    como: ENCARGADO,
  });
  soloMotivo = await ventaOffline({
    producto: negativo,
    cantidad: 2,
    precio: 20,
    qr: false,
    como: ENCARGADO,
  });
  qrRechazado = await ventaOffline({
    producto: conStock,
    cantidad: 1,
    precio: 50,
    qr: true,
    como: VENDEDOR,
  });
});

test.afterAll(async () => {
  await cerrarCaja(equipoId);
});

test.describe("con ver_reportes", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("la venta con QR pendiente y marca aparece con motivo, origen y quién la envió", async ({
    page,
  }) => {
    await ir(page, "/panel/reconciliacion");
    await expect(page.getByRole("link", { name: "Reconciliación" })).toBeVisible();
    const fila = venta(page, conQr.numero);
    await expect(fila).toContainText("Enviada desde otra cuenta");
    await expect(fila).toContainText("Sin conexión");
    await expect(fila).toContainText("enviada por Vendedor Tienda");
    await expect(fila).toContainText("QR pendiente de verificar");
    await expect(fila).toContainText("Bs 50,00");
    await expect(fila.getByRole("link", { name: conQr.numero })).toHaveAttribute(
      "href",
      `/panel/ventas/${conQr.id}`,
    );
    // Sin otra cuenta ni marca: solo el QR.
    await expect(venta(page, qrRechazado.numero)).not.toContainText("enviada por");
  });

  test("QR cobrado deja el pago verificado en base; Marcar revisada saca la venta de la lista", async ({
    page,
  }) => {
    await ir(page, "/panel/reconciliacion");
    const fila = venta(page, conQr.numero);
    await fila.getByRole("button", { name: "QR cobrado" }).click();
    await expect(page.getByRole("status")).toContainText(`${conQr.numero} marcado como cobrado`);
    await expect(fila.getByRole("button", { name: "QR cobrado" })).toHaveCount(0);
    expect((await pagosDe(conQr.id)).map((p) => p.verificacion)).toEqual(["verificado"]);
    // Sigue en la lista por su marca, ahora sin QR pendiente.
    await expect(fila).toContainText("Enviada desde otra cuenta");
    await fila.getByRole("button", { name: "Marcar revisada" }).click();
    await expect(venta(page, conQr.numero)).toHaveCount(0);
    expect(await revisadaPor(conQr.id)).not.toBeNull();
    await page.reload();
    await expect(venta(page, conQr.numero)).toHaveCount(0);

    await venta(page, soloMotivo.numero).getByRole("button", { name: "Marcar revisada" }).click();
    await expect(venta(page, soloMotivo.numero)).toHaveCount(0);
  });

  test("QR no llegó pide confirmación y deja el pago rechazado", async ({ page }) => {
    await ir(page, "/panel/reconciliacion");
    const fila = venta(page, qrRechazado.numero);
    await fila.getByRole("button", { name: "QR no llegó" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toContainText("no llegó");
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    expect((await pagosDe(qrRechazado.id)).map((p) => p.verificacion)).toEqual(["pendiente"]);
    await fila.getByRole("button", { name: "QR no llegó" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "QR no llegó" }).click();
    await expect(venta(page, qrRechazado.numero)).toHaveCount(0);
    expect((await pagosDe(qrRechazado.id)).map((p) => p.verificacion)).toEqual(["rechazado"]);
  });

  test("el producto con stock negativo aparece en su sección", async ({ page }) => {
    expect(await stockEn(negativo.id)).toBe(-2);
    await ir(page, "/panel/reconciliacion");
    const seccion = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Stock negativo" }) });
    await expect(seccion.getByRole("link", { name: negativo.nombre })).toBeVisible();
    const fila = seccion.locator("tr, li").filter({ hasText: negativo.nombre }).first();
    await expect(fila).toContainText("negativo");
  });

  test("negativo en la tienda y positivo en el depósito también aparece", async ({ page }) => {
    const u = await ubicaciones();
    const e = await entradaApi(mixto, u.deposito, 10);
    expect(e.status).toBeLessThan(300);
    const v = await ventaOffline({
      producto: mixto,
      cantidad: 3,
      precio: 20,
      qr: false,
      como: ENCARGADO,
    });
    expect(await stockEn(mixto.id)).toBe(-3);
    await ir(page, "/panel/reconciliacion");
    const seccion = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Stock negativo" }) });
    const fila = seccion.locator("tr, li").filter({ hasText: mixto.nombre }).first();
    await expect(fila).toContainText("negativo");
    expect(v.id).toBeTruthy();
  });

  test("el detalle de una caja abierta sin conexión muestra quién la envió", async ({ page }) => {
    await ir(page, `/panel/cajas/${cajaId}`);
    await expect(page.getByText("Sin conexión, enviada por Vendedor Tienda")).toBeVisible();
    await expect(page.getByText("Encargado Tienda")).toBeVisible();
  });

  test("a 390 px no hay desborde horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await ir(page, "/panel/reconciliacion");
    await expect(page.getByRole("heading", { name: "Reconciliación", level: 1 })).toBeVisible();
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
  });
});

test.describe("negocio sin ventas sin conexión", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("estado vacío claro", async ({ page }) => {
    // lavanderia.spec.ts deja una venta sin conexión por revisar un instante (la marca revisada al terminar la prueba):
    // si coincide con esta, recargar la lista basta.
    await expect(async () => {
      await ir(page, "/panel/reconciliacion");
      await expect(page.getByText("No hay ventas para revisar.")).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await expect(page.getByText("Ningún producto tiene stock negativo.")).toBeVisible();
  });
});

test.describe("sin ver_reportes", () => {
  test.use({ storageState: rutaAuth("vendedor") });

  test("no entra a la página y la base rechaza la lectura", async ({ page }) => {
    await page.goto("/panel/reconciliacion");
    await expect(page).toHaveURL(/\/pos$/);
    const r = await apiComo("vendedor", "rpc/reconciliacion_ventas", {
      metodo: "POST",
      cuerpo: { p_negocio_id: tienda },
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});
