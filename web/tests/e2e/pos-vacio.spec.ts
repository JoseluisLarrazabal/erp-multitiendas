import { expect, test } from "@playwright/test";
import { apiComo, cerrarCaja, elegirNegocio, equipoPropio, rutaAuth } from "./helpers";
import { ubicaciones } from "./inventario-helpers";
import { fijarEquipo, tienda } from "./pos-helpers";

// RF-FRI-03: con el catálogo cargado y sin productos, el POS lo dice en vez de quedar mudo. Equipo propio (W10).
test.use({ storageState: rutaAuth("dueno") });

test("POS sin productos: muestra el texto, el carrito vacío y la caja se abre", async ({
  page,
  context,
}) => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W10", "Caja sin productos");
  await elegirNegocio(context, tienda);
  await fijarEquipo(page, equipo.id);
  await page.route("**/rest/v1/rpc/catalogo_pos*", async (route) => {
    const r = await route.fetch();
    const json = (await r.json()) as { productos: unknown[] };
    await route.fulfill({ response: r, json: { ...json, productos: [] } });
  });
  try {
    await page.goto("/pos");
    await page.getByLabel("Efectivo inicial (Bs)").fill("0");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(
      page.getByText(/Este negocio todavía no tiene productos con precio/),
    ).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();
    await expect(page.getByText(/El carrito está vacío/)).toBeVisible();
  } finally {
    const abierta = await apiComo("dueno", "rpc/caja_sesion_abierta", {
      metodo: "POST",
      cuerpo: { p_dispositivo_id: equipo.id },
    });
    const id = (abierta.json as { id: string }[])[0]?.id;
    if (id) await cerrarCaja(id);
  }
});
