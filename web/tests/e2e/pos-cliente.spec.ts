import { expect, test } from "@playwright/test";
import { abrirCaja, apiComo, cerrarCaja, elegirNegocio, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { fijarEquipo, tienda } from "./pos-helpers";

// M-17: el aviso de documento repetido no se borra cuando responde la búsqueda que sigue. Equipo propio (W9).
test.use({ storageState: rutaAuth("dueno") });

test("M-17: Nuevo cliente con un documento repetido deja el aviso a la vista junto al existente", async ({
  page,
  context,
}) => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W9", "Caja de cliente POS");
  const sesion = await abrirCaja(tienda, equipo);
  try {
    const documento = `DUP${corrida}`.toUpperCase();
    const nombre = `Cliente duplicado ${corrida}`;
    const c = await apiComo("dueno", "rpc/guardar_cliente", {
      metodo: "POST",
      cuerpo: { p_negocio_id: tienda, p_datos: { nombre, ci_nit: documento } },
    });
    expect(c.status, JSON.stringify(c.json)).toBeLessThan(300);

    await elegirNegocio(context, tienda);
    await fijarEquipo(page, equipo.id);
    await page.goto("/pos");
    await page.getByRole("button", { name: "Elegir" }).click();
    await page.getByRole("button", { name: "Nuevo cliente" }).click();
    await page.getByLabel("Nombre del cliente").fill(`Otro ${corrida}`);
    await page.getByLabel("CI o NIT").fill(documento);
    const aviso = page
      .getByRole("alert")
      .filter({ hasText: /Ya existe un cliente con ese documento/ });
    // La búsqueda por documento arranca al pasar a la lista; se espera su respuesta antes de mirar el aviso.
    const busqueda = page.waitForResponse(
      (r) => r.url().includes("rest/v1/clientes") && r.request().method() === "GET",
    );
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await busqueda;
    await expect(
      page.getByRole("list", { name: "Clientes encontrados" }).getByRole("button"),
    ).toContainText(nombre);
    await expect(aviso).toBeVisible();

    // Al escribir en el buscador el aviso se limpia.
    await page.getByLabel("Buscar cliente").fill(documento.slice(0, 5));
    await expect(aviso).toHaveCount(0);
  } finally {
    await cerrarCaja(sesion);
  }
});
