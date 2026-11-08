import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { apiComo, ir, NEGOCIOS, rutaAuth } from "./helpers";
import { corrida } from "./inventario-helpers";

// RF-INS-01 y 02: consumo de un insumo de lavandería, stock y gasto en el reporte. Datos únicos por corrida.
const LAV = NEGOCIOS.lavanderia.id;

test.describe("encargado de lavandería", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("el consumo baja el stock y el reporte de insumos suma el gasto", async ({ page }) => {
    const codigo = `INS-${corrida}`;
    const nombre = `Detergente ${corrida}`;
    const creado = await apiComo("encargadoLavanderia", "rpc/guardar_producto", {
      metodo: "POST",
      cuerpo: {
        p_negocio_id: LAV,
        p_datos: { codigo, nombre, tipo: "insumo", unidad: "unidad", stock_minimo: 2 },
      },
    });
    expect(creado.status, JSON.stringify(creado.json)).toBeLessThan(300);
    const productoId = creado.json as string;
    const ubic = await apiComo("encargadoLavanderia", `ubicaciones?select=id&negocio_id=eq.${LAV}`);
    const ubicacionId = (ubic.json as { id: string }[])[0]!.id;
    const entrada = await apiComo("encargadoLavanderia", "rpc/registrar_entrada", {
      metodo: "POST",
      cuerpo: {
        p_operacion_id: randomUUID(),
        p_negocio_id: LAV,
        p_producto_id: productoId,
        p_ubicacion_id: ubicacionId,
        p_cantidad: 10,
        p_costo_unitario: 5,
        p_motivo: null,
      },
    });
    expect(entrada.status, JSON.stringify(entrada.json)).toBeLessThan(300);

    await ir(page, "/panel/inventario");
    await page.getByRole("link", { name: "Consumo" }).click();
    await expect(page).toHaveURL(/\/panel\/inventario\/salida\?tipo=consumo$/);
    await expect(page.getByLabel("Tipo")).toHaveValue("consumo");
    await page.getByRole("combobox", { name: "Insumo" }).fill(codigo);
    await page.getByRole("option", { name: new RegExp(nombre) }).click();
    await page.getByLabel("Cantidad").fill("3");
    await page.getByLabel("Motivo").fill("lavado de la mañana");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `Movimiento registrado: 3 de ${nombre}.` }),
    ).toBeVisible();

    const stock = await apiComo(
      "encargadoLavanderia",
      `stock?select=cantidad&producto_id=eq.${productoId}`,
    );
    expect(stock.json).toEqual([{ cantidad: 7 }]);

    await ir(page, "/panel/reportes?r=insumos&agrupar=insumo");
    await expect(page.getByRole("link", { name: "Insumos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const fila = page.getByRole("row").filter({ hasText: nombre });
    await expect(fila).toContainText("Bs 15,00");

    // Revertir desde el kardex devuelve el stock y netea el gasto.
    await ir(page, `/panel/inventario/${productoId}`);
    await page.getByLabel("Motivo de la reversión").fill("carga equivocada");
    await page.getByRole("button", { name: "Revertir", exact: true }).click();
    await page.getByRole("button", { name: "Revertir consumo" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Revertir", exact: true })).toHaveCount(0);
    const despues = await apiComo(
      "encargadoLavanderia",
      `stock?select=cantidad&producto_id=eq.${productoId}`,
    );
    expect(despues.json).toEqual([{ cantidad: 10 }]);
    await ir(page, "/panel/reportes?r=insumos&agrupar=insumo");
    await expect(page.getByRole("row").filter({ hasText: nombre })).toContainText("Bs 0,00");
  });
});

test.describe("sin acceso", () => {
  test.describe("vendedor", () => {
    test.use({ storageState: rutaAuth("vendedor") });
    test("no abre el consumo", async ({ page }) => {
      await page.goto("/panel/inventario/salida?tipo=consumo");
      await expect(page).toHaveURL(/\/pos$/);
    });
  });
  test.describe("encargado de tienda", () => {
    test.use({ storageState: rutaAuth("encargadoTienda") });
    test("en un negocio que no es lavandería no ofrece el consumo", async ({ page }) => {
      await page.goto("/panel/inventario/salida?tipo=consumo");
      await expect(page.getByLabel("Tipo")).not.toHaveValue("consumo");
      await expect(page.getByLabel("Tipo").locator("option", { hasText: "Consumo" })).toHaveCount(
        0,
      );
    });
  });
});
