import { expect, test } from "@playwright/test";
import { apiComo, ir, rutaAuth } from "./helpers";
import { corrida, tienda } from "./inventario-helpers";

// M-12: se encuentra "María" tecleando "maria" y "Café" tecleando "cafe", en el panel, en el selector y por la API
// (campo calculado `busqueda` dentro de `or=`, que es como lo consulta la web).
test.describe("dueño: búsquedas sin tildes", () => {
  test.use({ storageState: rutaAuth("dueno") });
  const sufijo = corrida.toLowerCase();
  const cliente = `María Tildes ${sufijo}`;
  const producto = `Café Tildes ${sufijo}`;
  const codigo = `TIL-${corrida}`;
  let productoId: string;

  test.beforeAll(async () => {
    const c = await apiComo("dueno", "rpc/guardar_cliente", {
      metodo: "POST",
      cuerpo: { p_negocio_id: tienda, p_datos: { nombre: cliente } },
    });
    expect(c.status).toBeLessThan(300);
    const p = await apiComo("dueno", "rpc/guardar_producto", {
      metodo: "POST",
      cuerpo: {
        p_negocio_id: tienda,
        p_datos: { codigo, nombre: producto, tipo: "producto", unidad: "unidad" },
      },
    });
    expect(p.status).toBeLessThan(300);
    productoId = p.json as string;
  });

  test("la API acepta el campo calculado en or= sobre tabla y vistas", async () => {
    const cuando = `maria tildes ${sufijo}`;
    const clientes = await apiComo(
      "dueno",
      `clientes?select=nombre&negocio_id=eq.${tienda}&or=(busqueda.ilike.%25${encodeURIComponent(cuando)}%25,ci_nit.ilike.%25zz%25)`,
    );
    expect(clientes.json).toEqual([{ nombre: cliente }]);
    for (const vista of ["productos_lista", "inventario_lista"]) {
      const r = await apiComo(
        "dueno",
        `${vista}?select=nombre&negocio_id=eq.${tienda}&or=(codigo.ilike.*zz*,busqueda.ilike.*cafe tildes ${sufijo}*)`,
      );
      expect(r.json, vista).toEqual([{ nombre: producto }]);
    }
  });

  test("clientes y productos del panel", async ({ page }) => {
    await ir(page, `/panel/clientes?q=maria tildes ${sufijo}`);
    await expect(page.getByRole("list", { name: "Clientes" })).toContainText(cliente);
    await ir(page, `/panel/productos?q=cafe tildes ${sufijo}`);
    await expect(page.getByText(producto).first()).toBeVisible();
  });

  test("el selector de salida encuentra el producto sin tilde", async ({ page }) => {
    await ir(page, "/panel/inventario/salida");
    await page.getByRole("combobox", { name: "Producto" }).fill(`cafe tildes ${sufijo}`);
    await expect(page.getByRole("option", { name: new RegExp(producto) })).toBeVisible();
    expect(productoId).toBeTruthy();
  });
});
