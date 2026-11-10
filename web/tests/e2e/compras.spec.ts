import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { apiComo, elegirNegocio, ir, NEGOCIOS, rutaAuth } from "./helpers";
import { corrida, crearProducto, tienda, ubicaciones } from "./inventario-helpers";

// RF-COM-01 a 03: proveedor, compra a crédito, deuda y pago. Datos únicos por worker (corrida).
test.describe("dueño", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("compra de tres líneas: tres movimientos en el kardex y el total correcto", async ({
    page,
  }) => {
    const nombre = `Proveedor tres líneas ${corrida}`;
    const prov = await apiComo("dueno", "rpc/guardar_proveedor", {
      metodo: "POST",
      cuerpo: { p_negocio_id: tienda, p_datos: { nombre } },
    });
    expect(prov.status).toBeLessThan(300);
    const lineas = [
      { producto: await crearProducto(), cantidad: "2", costo: "10" },
      { producto: await crearProducto(), cantidad: "3", costo: "5" },
      { producto: await crearProducto(), cantidad: "1", costo: "7,5" },
    ];

    await ir(page, "/panel/compras/nueva");
    await page.getByLabel("Proveedor", { exact: true }).selectOption({ label: nombre });
    for (const [i, l] of lineas.entries()) {
      if (i > 0) await page.getByRole("button", { name: "Agregar producto" }).click();
      // Una línea ya elegida deja de ser combobox: el único abierto es el de la línea nueva.
      await page.getByRole("combobox", { name: "Producto" }).fill(l.producto.codigo);
      await page.getByRole("option", { name: new RegExp(l.producto.nombre) }).click();
      await page.getByLabel("Cantidad").nth(i).fill(l.cantidad);
      await page.getByLabel("Costo unitario (Bs)").nth(i).fill(l.costo);
    }
    await expect(page.getByText("Total: Bs 42,50")).toBeVisible();
    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Compra registrada por Bs 42,50." }),
    ).toBeVisible();

    for (const l of lineas) {
      const k = await apiComo("dueno", "rpc/kardex_producto", {
        metodo: "POST",
        cuerpo: { p_producto_id: l.producto.id, p_limite: 5 },
      });
      const filas = (k.json as { tipo: string; cantidad: number; costo_unitario: number }[]).filter(
        (m) => m.tipo === "compra",
      );
      expect(filas).toEqual([
        expect.objectContaining({
          cantidad: Number(l.cantidad),
          costo_unitario: Number(l.costo.replace(",", ".")),
        }),
      ]);
    }
  });

  test("compra a crédito: sube la deuda y un pago parcial la reduce", async ({ page }) => {
    const nombre = `Proveedor ${corrida}`;
    const producto = await crearProducto();

    await ir(page, "/panel/proveedores");
    await page.getByRole("form", { name: "Proveedor nuevo" }).getByLabel("Nombre").fill(nombre);
    await page.getByRole("button", { name: "Guardar proveedor" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Proveedor guardado." })).toBeVisible();

    await ir(page, "/panel/compras/nueva");
    await page.getByLabel("Proveedor", { exact: true }).selectOption({ label: nombre });
    await page.getByRole("combobox", { name: "Producto" }).fill(producto.codigo);
    await page.getByRole("option", { name: new RegExp(producto.nombre) }).click();
    await page.getByLabel("Cantidad").fill("4");
    await page.getByLabel("Costo unitario (Bs)").fill("12,5");
    await expect(page.getByText("Total: Bs 50,00")).toBeVisible();
    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Compra registrada por Bs 50,00." }),
    ).toBeVisible();

    const stock = await apiComo("dueno", `stock?select=cantidad&producto_id=eq.${producto.id}`);
    expect(stock.json).toEqual([{ cantidad: 4 }]);

    await ir(page, "/panel/proveedores");
    const fila = page.getByRole("listitem").filter({ hasText: nombre });
    await expect(fila).toContainText("Deuda Bs 50,00");
    await fila.getByRole("button", { name: `Registrar pago a ${nombre}` }).click();
    const pago = page.getByRole("form", { name: `Registrar pago a ${nombre}` });
    await pago.getByLabel("Monto en Bs").fill("51");
    await pago.getByRole("button", { name: "Registrar pago", exact: true }).click();
    await expect(pago).toContainText("supera la deuda");
    await pago.getByLabel("Monto en Bs").fill("20");
    await pago.getByRole("button", { name: "Registrar pago", exact: true }).click();
    await expect(fila).toContainText("Deuda Bs 30,00");

    await ir(page, "/panel/compras");
    await expect(
      page.getByRole("listitem").filter({ hasText: nombre }).filter({ hasText: "Bs 50,00" }),
    ).toBeVisible();
  });
});

// M-2: reversos por contraasiento. La compra y los pagos se preparan por RPC; el reverso va por la interfaz.
async function proveedorConCompra(nombre: string, producto: { id: string }) {
  const [u, prov] = await Promise.all([
    ubicaciones(),
    apiComo("dueno", "rpc/guardar_proveedor", {
      metodo: "POST",
      cuerpo: { p_negocio_id: tienda, p_datos: { nombre } },
    }),
  ]);
  expect(prov.status).toBeLessThan(300);
  const proveedorId = prov.json as string;
  const compra = await apiComo("dueno", "rpc/registrar_compra", {
    metodo: "POST",
    cuerpo: {
      p_compra: {
        id: randomUUID(),
        negocio_id: tienda,
        proveedor_id: proveedorId,
        ubicacion_id: u.tienda,
        condicion: "credito",
        total: 50,
        items: [{ producto_id: producto.id, cantidad: 4, costo_unitario: 12.5 }],
      },
    },
  });
  expect(compra.status).toBeLessThan(300);
  return proveedorId;
}

test.describe("dueño: reversos", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("anular una compra: queda Anulada, el stock vuelve y la deuda baja", async ({ page }) => {
    const nombre = `Proveedor anula ${corrida}`;
    const producto = await crearProducto();
    await proveedorConCompra(nombre, producto);
    const stock = () => apiComo("dueno", `stock?select=cantidad&producto_id=eq.${producto.id}`);
    expect((await stock()).json).toEqual([{ cantidad: 4 }]);

    await ir(page, "/panel/compras");
    const fila = page.getByRole("listitem").filter({ hasText: nombre });
    await fila.getByRole("button", { name: `Anular la compra de ${nombre}` }).click();
    const dialogo = page.getByRole("alertdialog", { name: `Anular la compra de ${nombre}` });
    await dialogo.getByRole("button", { name: "Anular compra" }).click();
    await expect(dialogo.getByText("Escribe el motivo")).toBeVisible();
    await dialogo.getByLabel("Motivo").fill("Se cargó dos veces");
    await dialogo.getByRole("button", { name: "Anular compra" }).click();
    await expect(dialogo).toBeHidden();

    await expect(fila).toContainText("Anulada");
    await expect(fila.getByRole("button", { name: /Anular la compra/ })).toHaveCount(0);
    expect((await stock()).json).toEqual([{ cantidad: 0 }]);

    await ir(page, "/panel/proveedores");
    await expect(page.getByRole("listitem").filter({ hasText: nombre })).toContainText(
      "Deuda Bs 0,00",
    );
  });

  test("anular el último pago a un proveedor restaura la deuda", async ({ page }) => {
    const nombre = `Proveedor pagos ${corrida}`;
    const producto = await crearProducto();
    const proveedorId = await proveedorConCompra(nombre, producto);
    for (const monto of [20, 10]) {
      const r = await apiComo("dueno", "rpc/pagar_proveedor", {
        metodo: "POST",
        cuerpo: {
          p_pago: {
            id: randomUUID(),
            negocio_id: tienda,
            proveedor_id: proveedorId,
            monto,
            medio: "efectivo",
          },
        },
      });
      expect(r.status).toBeLessThan(300);
    }

    await ir(page, "/panel/proveedores");
    const fila = page.getByRole("listitem").filter({ hasText: nombre });
    await expect(fila).toContainText("Deuda Bs 20,00");
    await fila.getByRole("button", { name: `Anular el último pago a ${nombre}` }).click();
    const dialogo = page.getByRole("alertdialog", { name: `Anular el último pago a ${nombre}` });
    await expect(dialogo).toContainText("Bs 10,00");
    await dialogo.getByLabel("Motivo").fill("Monto equivocado");
    await dialogo.getByRole("button", { name: "Anular pago" }).click();
    await expect(dialogo).toBeHidden();
    await expect(fila).toContainText("Deuda Bs 30,00");
  });

  test("anular el pago manual aunque haya una compra al contado posterior", async ({ page }) => {
    const nombre = `Proveedor contado ${corrida}`;
    const producto = await crearProducto();
    const proveedorId = await proveedorConCompra(nombre, producto);
    const pago = await apiComo("dueno", "rpc/pagar_proveedor", {
      metodo: "POST",
      cuerpo: {
        p_pago: {
          id: randomUUID(),
          negocio_id: tienda,
          proveedor_id: proveedorId,
          monto: 10,
          medio: "efectivo",
        },
      },
    });
    expect(pago.status).toBeLessThan(300);
    const contado = await apiComo("dueno", "rpc/registrar_compra", {
      metodo: "POST",
      cuerpo: {
        p_compra: {
          id: randomUUID(),
          negocio_id: tienda,
          proveedor_id: proveedorId,
          ubicacion_id: (await ubicaciones()).tienda,
          condicion: "contado",
          medio: "efectivo",
          total: 5,
          items: [{ producto_id: producto.id, cantidad: 1, costo_unitario: 5 }],
        },
      },
    });
    expect(contado.status).toBeLessThan(300);

    await ir(page, "/panel/proveedores");
    const fila = page.getByRole("listitem").filter({ hasText: nombre });
    await expect(fila).toContainText("Deuda Bs 40,00");
    await fila.getByRole("button", { name: `Anular el último pago a ${nombre}` }).click();
    const dialogo = page.getByRole("alertdialog", { name: `Anular el último pago a ${nombre}` });
    await expect(dialogo).toContainText("Bs 10,00");
    await dialogo.getByLabel("Motivo").fill("Monto equivocado");
    await dialogo.getByRole("button", { name: "Anular pago" }).click();
    await expect(dialogo).toBeHidden();
    await expect(fila).toContainText("Deuda Bs 50,00");
  });
});

// M-8: en el frial cada línea de la compra pide lote y vencimiento, y el lote sale en "Por vencer".
test.describe("dueño en el frial", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("compra con lote y vencimiento: aparece en Por vencer", async ({ page, context }) => {
    const nombre = `Proveedor frial ${corrida}`;
    const lote = `LC-${corrida}`;
    const fecha = (dias: number) =>
      new Date(Date.now() + dias * 86_400_000).toLocaleDateString("en-CA", {
        timeZone: "America/La_Paz",
      });
    const prov = await apiComo("dueno", "rpc/guardar_proveedor", {
      metodo: "POST",
      cuerpo: { p_negocio_id: NEGOCIOS.frial.id, p_datos: { nombre } },
    });
    expect(prov.status).toBeLessThan(300);
    await elegirNegocio(context, NEGOCIOS.frial.id);

    await ir(page, "/panel/compras/nueva");
    await page.getByLabel("Proveedor", { exact: true }).selectOption({ label: nombre });
    await page.getByRole("combobox", { name: "Producto" }).fill("COR-003");
    await page.getByRole("option", { name: /Paquete Demo 1 kg/ }).click();
    await page.getByLabel("Cantidad").fill("3");
    await page.getByLabel("Costo unitario (Bs)").fill("10");

    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(page.getByText("Escribe el lote (hasta 40 caracteres).")).toBeVisible();
    await expect(page.getByText("Indica la fecha de vencimiento.")).toBeVisible();
    await page.getByLabel("Lote", { exact: true }).fill(lote);
    await page.getByLabel("Vence", { exact: true }).fill(fecha(-1));
    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(page.getByText("La fecha de vencimiento no puede ser pasada.")).toBeVisible();

    await page.getByLabel("Vence", { exact: true }).fill(fecha(4));
    await page.getByRole("button", { name: "Registrar compra" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Compra registrada por Bs 30,00." }),
    ).toBeVisible();

    await ir(page, "/panel/inventario/vencimientos?dias=7");
    const fila = page
      .getByRole("list", { name: "Lotes por vencer" })
      .getByRole("listitem")
      .filter({ hasText: lote });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText("En 4 días");
    await expect(fila).toContainText("Saldo estimado: 3");
  });
});

test.describe("sin permiso", () => {
  test.describe("vendedor", () => {
    test.use({ storageState: rutaAuth("vendedor") });
    test("no entra a compras ni proveedores", async ({ page }) => {
      for (const ruta of ["/panel/compras", "/panel/compras/nueva", "/panel/proveedores"]) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/pos$/);
      }
    });
  });
  test.describe("contador", () => {
    test.use({ storageState: rutaAuth("contador") });
    test("entra al panel pero vuelve al inicio desde compras", async ({ page }) => {
      await page.goto("/panel/compras");
      await expect(page).toHaveURL(/\/panel$/);
      await expect(page.getByRole("link", { name: "Compras" })).toHaveCount(0);
    });
  });
});
