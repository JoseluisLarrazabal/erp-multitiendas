import { expect, test } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, tienda } from "./pos-helpers";

// Reverso del último pago de cuota y documentos del crédito (M-2, M-6). La venta y el cobro se preparan por API; la prueba
// recorre el detalle del crédito en el panel. Cuenta del encargado (anular, gestionar_credito y caja). Equipo propio (W9).
test.use({ storageState: rutaAuth("encargadoTienda") });

const CUENTA = "encargadoTienda";
const NOMBRE_CAJA = "Caja de reversos";

test("E2E-12b: anular el último pago, marcar documentos e imprimir el plan desde el detalle del crédito", async ({
  page,
}) => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W9", NOMBRE_CAJA);
  const cajaId = await abrirCaja(tienda, equipo);
  try {
    const cliente = await apiComo("dueno", "rpc/guardar_cliente", {
      metodo: "POST",
      cuerpo: { p_negocio_id: tienda, p_datos: { nombre: `Cliente reversos ${corrida}` } },
    });
    const clienteId = cliente.json as string;
    const producto = await crearProductoConPrecio({
      contado: 50,
      credito: 60,
      minimo: 45,
      stock: 20,
    });

    // Venta a crédito: 2 x 60 = 120, inicial 60, 3 cuotas (saldo 63,02), solo el CI entregado.
    const venta = await apiComo(CUENTA, "rpc/registrar_venta", {
      metodo: "POST",
      cuerpo: {
        p_venta: {
          id: crypto.randomUUID(),
          dispositivo_id: equipo.id,
          caja_sesion_id: cajaId,
          numero: `W9-${String(equipo.ultimo_numero + 1).padStart(6, "0")}`,
          creada_en_cliente: new Date().toISOString(),
          cliente_id: clienteId,
          descuento: 0,
          total: 120,
          condicion: "credito",
          credito: { cuotas: 3, docs_ci: true, docs_domicilio: false, docs_pagare: false },
          items: [
            {
              producto_id: producto.id,
              lista: "credito",
              cantidad: 2,
              precio_unitario: 60,
              descuento: 0,
            },
          ],
          pagos: [{ medio: "efectivo", monto: 60 }],
        },
      },
    });
    expect(venta.status, JSON.stringify(venta.json)).toBeLessThan(300);
    const cuentas = await apiComo(CUENTA, "rpc/cuentas_por_cobrar", {
      metodo: "POST",
      cuerpo: { p_negocio_id: tienda, p_cliente_id: clienteId },
    });
    const creditoId = (cuentas.json as { credito_id: string }[])[0]!.credito_id;
    const saldo = async () =>
      (
        (
          await apiComo(CUENTA, "rpc/cuentas_por_cobrar", {
            metodo: "POST",
            cuerpo: { p_negocio_id: tienda, p_cliente_id: clienteId },
          })
        ).json as { saldo: number }[]
      )[0]!.saldo;

    const cobro = await apiComo(CUENTA, "rpc/pagar_cuota", {
      metodo: "POST",
      cuerpo: {
        p_pago: {
          id: crypto.randomUUID(),
          credito_id: creditoId,
          dispositivo_id: equipo.id,
          caja_sesion_id: cajaId,
          efectivo: 21.01,
          qr: 0,
        },
      },
    });
    expect(cobro.status, JSON.stringify(cobro.json)).toBeLessThan(300);
    expect(await saldo()).toBe(42.01);

    await page.goto(`/panel/creditos/${creditoId}`);
    await expect(page.getByRole("button", { name: "Imprimir plan" })).toBeVisible();
    // El plan imprimible está en la página (oculto en pantalla, visible al imprimir).
    await expect(page.locator('article[aria-label^="Plan de cuotas W9-"]')).toBeAttached();

    // Documentos: se marca el domicilio después de vender y queda guardado.
    await page.getByLabel("Comprobante de domicilio").check();
    await page.getByRole("button", { name: "Guardar documentos" }).click();
    await expect
      .poll(async () => {
        const r = await apiComo(
          CUENTA,
          `creditos?select=docs_ci,docs_domicilio&id=eq.${creditoId}`,
        );
        return (r.json as { docs_ci: boolean; docs_domicilio: boolean }[])[0];
      })
      .toEqual({ docs_ci: true, docs_domicilio: true });
    // Y se desmarca.
    await page.getByLabel("Comprobante de domicilio").uncheck();
    await page.getByRole("button", { name: "Guardar documentos" }).click();
    await expect
      .poll(async () => {
        const r = await apiComo(CUENTA, `creditos?select=docs_domicilio&id=eq.${creditoId}`);
        return (r.json as { docs_domicilio: boolean }[])[0]?.docs_domicilio;
      })
      .toBe(false);

    // Anular el último pago, con motivo y la caja que devuelve el efectivo.
    const seccion = page.getByRole("region", { name: "Anular último pago" });
    await expect(seccion).toContainText("Bs 21,01");
    await page
      .getByLabel("Caja que devuelve el efectivo")
      .selectOption({ label: `${NOMBRE_CAJA} (W9)` });
    await page.getByLabel("Motivo de la anulación").fill("cobro duplicado");
    await page.getByRole("button", { name: "Anular último pago" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Anular pago" }).click();

    const pagos = page.getByRole("region", { name: "Pagos" });
    await expect(pagos).toContainText("Anulado");
    await expect(pagos).toContainText("Anulación de pago");
    await expect(pagos).toContainText("cobro duplicado");
    await expect(page.getByRole("region", { name: "Anular último pago" })).toHaveCount(0);
    expect(await saldo()).toBe(63.02);
    await expect(page.getByText("Bs 63,02").first()).toBeVisible();
  } finally {
    await apiComo("dueno", "rpc/cerrar_caja", {
      metodo: "POST",
      cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
    });
  }
});
