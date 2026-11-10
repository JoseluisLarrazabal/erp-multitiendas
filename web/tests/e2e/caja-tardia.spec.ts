import { expect, test } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, tienda } from "./pos-helpers";

// M-10: una venta sin conexión hecha antes del cierre y enviada después no cambia el arqueo guardado; el detalle de la
// caja muestra el esperado del cierre, el de ahora y la línea de lo que llegó tarde. Equipo propio (T3).
test.use({ storageState: rutaAuth("dueno") });
test.describe.configure({ mode: "serial" });

test("el cierre conserva su esperado y avisa de la venta que llegó después", async ({ page }) => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "T3", "Caja de tardías");
  const cajaId = await abrirCaja(tienda, equipo);
  const p = await crearProductoConPrecio({ contado: 20, stock: 10 });
  const venta = async (numero: number) => {
    const id = crypto.randomUUID();
    const r = await apiComo("vendedor", "rpc/registrar_venta", {
      metodo: "POST",
      cuerpo: {
        p_venta: {
          id,
          dispositivo_id: equipo.id,
          caja_sesion_id: cajaId,
          numero: `T3-${String(numero).padStart(6, "0")}`,
          creada_en_cliente: new Date().toISOString(),
          descuento: 0,
          total: 20,
          items: [
            { producto_id: p.id, lista: "contado", cantidad: 1, precio_unitario: 20, descuento: 0 },
          ],
          pagos: [{ medio: "efectivo", monto: 20 }],
        },
      },
    });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  };

  const siguiente = equipo.ultimo_numero + 1;
  await venta(siguiente);
  // Hecha dentro de la sesión: la hora del equipo queda antes del cierre.
  const horaTarde = new Date().toISOString();
  const cierre = await apiComo("dueno", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: cajaId, p_monto_contado: 120 },
  });
  expect(cierre.status, JSON.stringify(cierre.json)).toBeLessThan(300);
  const tarde = await apiComo("vendedor", "rpc/registrar_venta", {
    metodo: "POST",
    cuerpo: {
      p_venta: {
        id: crypto.randomUUID(),
        dispositivo_id: equipo.id,
        caja_sesion_id: cajaId,
        numero: `T3-${String(siguiente + 1).padStart(6, "0")}`,
        creada_en_cliente: horaTarde,
        descuento: 0,
        total: 20,
        items: [
          { producto_id: p.id, lista: "contado", cantidad: 1, precio_unitario: 20, descuento: 0 },
        ],
        pagos: [{ medio: "efectivo", monto: 20 }],
      },
      p_offline: {
        vendedor_id: "c0000000-0000-0000-0000-000000000004",
        tipo_cambio: null,
        numero_impreso: null,
      },
    },
  });
  expect(tarde.status, JSON.stringify(tarde.json)).toBeLessThan(300);

  await page.goto(`/panel/cajas/${cajaId}`);
  // Inicial 100 + venta 20 = esperado 120 al cierre; contado 120; la tardía suma 20 solo al esperado de ahora.
  await expect(page.getByTestId("sesion-esperado")).toHaveText("Bs 120,00");
  await expect(page.getByTestId("sesion-esperado-actual")).toHaveText("Bs 140,00");
  await expect(page.getByTestId("sesion-diferencia")).toHaveText("Bs 0,00");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Después del cierre llegaron 1 venta sin conexión por Bs 20,00/ }),
  ).toContainText("El arqueo del cierre no cambia.");
});
