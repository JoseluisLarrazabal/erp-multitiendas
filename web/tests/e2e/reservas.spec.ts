import { expect, test } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, fijarEquipo, stockEn, tienda } from "./pos-helpers";

// E2E-13 (RF-RES-01 a 03): reservar con anticipo, completar en una venta, cancelar con devolución y sin red.
// Equipo propio (W1) y datos únicos por corrida: ningún otro spec usa su caja.
test.use({ storageState: rutaAuth("vendedor") });
test.describe.configure({ mode: "serial" });

let equipoId = "";
let cajaId = "";
let clienteId = "";
const nombreCliente = `Cliente reserva ${corrida}`;

test.beforeAll(async () => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W1", "Caja de reservas");
  equipoId = equipo.id;
  cajaId = await abrirCaja(tienda, equipo);
  const c = await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_datos: { nombre: nombreCliente } },
  });
  clienteId = c.json as string;
});
test.afterAll(async () => {
  await apiComo("dueno", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
  });
});

async function reservasDelCliente() {
  const r = await apiComo(
    "vendedor",
    `reservas?select=id,estado,venta_id&cliente_id=eq.${clienteId}&order=created_at`,
  );
  return r.json as { id: string; estado: string; venta_id: string | null }[];
}

test("E2E-13: reserva con anticipo, conversión en venta y cancelación", async ({ page }) => {
  const producto = await crearProductoConPrecio({ contado: 50, minimo: 40, stock: 10 });
  await fijarEquipo(page, equipoId);
  await page.goto("/pos");
  await expect(page.getByText(/productos en el catálogo/)).toBeVisible();

  // Crear: 2 unidades a 45 (acordado), anticipo de 30 en efectivo.
  await page.getByRole("button", { name: "Reservas" }).click();
  const form = page.getByRole("form", { name: "Nueva reserva" });
  await form.getByRole("button", { name: "Elegir" }).click();
  await form.getByRole("textbox", { name: "Buscar cliente" }).fill(nombreCliente);
  await form.getByRole("button", { name: new RegExp(nombreCliente) }).click();
  await form.getByRole("searchbox", { name: "Producto" }).fill(producto.codigo);
  await form.getByRole("button", { name: new RegExp(producto.nombre) }).click();
  await form.getByLabel("Cantidad").fill("2");
  await form.getByLabel("Precio acordado (Bs)").fill("45");
  await form.getByLabel("Anticipo (Bs)").fill("100");
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(form.getByRole("alert")).toContainText("no puede superar el total");
  await form.getByLabel("Anticipo (Bs)").fill("30");
  // El anticipo por QR pide la misma confirmación que el cobro.
  await form.getByLabel("Anticipo recibido por").selectOption("qr");
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(form.getByRole("alert")).toContainText("Confirma que recibiste el QR");
  await form.getByLabel("Anticipo recibido por").selectOption("efectivo");
  await form.getByRole("button", { name: "Reservar y cobrar anticipo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reserva creada" })).toBeVisible();
  const fila = page.getByRole("listitem", { name: `Reserva de ${nombreCliente}` });
  await expect(fila).toContainText("anticipo Bs 30,00");
  await expect(fila).toContainText("saldo Bs 60,00");
  expect(await stockEn(producto.id)).toBe(8); // DB-23: la reserva descuenta el disponible

  // Completar: carga el carrito con el precio acordado y cobra solo el saldo.
  await fila.getByRole("button", { name: `Completar reserva de ${nombreCliente}` }).click();
  await expect(page.getByTestId("total")).toHaveText("Bs 90,00");
  await expect(page.getByText(`Completando la reserva de ${nombreCliente}`)).toBeVisible();
  await page
    .getByRole("button", { name: /^Cobrar/ })
    .first()
    .click();
  const cobro = page.getByRole("alertdialog", { name: "Cobrar venta" });
  await expect(cobro).toContainText("anticipo de la reserva Bs 30,00");
  await expect(cobro.getByLabel("Efectivo recibido (Bs)")).toHaveValue("60,00");
  await cobro.getByRole("button", { name: "Confirmar cobro" }).click();
  await expect(page.getByRole("article", { name: /Nota de venta W1-\d{6}/ })).toBeVisible();
  expect(await stockEn(producto.id)).toBe(8); // DB-23: completar no descuenta dos veces
  const [completada] = await reservasDelCliente();
  expect(completada).toMatchObject({ estado: "completada" });
  const pagos = await apiComo(
    "vendedor",
    `venta_pagos?select=medio,monto&venta_id=eq.${completada!.venta_id}&order=medio`,
  );
  expect(pagos.json).toEqual([
    { medio: "anticipo", monto: 30 },
    { medio: "efectivo", monto: 60 },
  ]);

  // Cancelar otra reserva (creada por API) libera el stock y devuelve el anticipo (DB-24).
  const nueva = await apiComo("vendedor", "rpc/crear_reserva", {
    metodo: "POST",
    cuerpo: {
      p_reserva: {
        id: crypto.randomUUID(),
        dispositivo_id: equipoId,
        caja_sesion_id: cajaId,
        cliente_id: clienteId,
        producto_id: producto.id,
        cantidad: 3,
        precio_acordado: 50,
        anticipo: 20,
        medio: "efectivo",
      },
    },
  });
  expect(nueva.status).toBeLessThan(300);
  expect(await stockEn(producto.id)).toBe(5);
  await page.getByRole("button", { name: "Nueva venta" }).click();
  await page.getByRole("button", { name: "Reservas" }).click();
  const otra = page.getByRole("listitem", { name: `Reserva de ${nombreCliente}` });
  await expect(otra).toHaveCount(1);
  await otra.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar reserva" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "cancelada: anticipo devuelto" }),
  ).toBeVisible();
  expect(await stockEn(producto.id)).toBe(8);
  expect((await reservasDelCliente()).map((r) => r.estado)).toEqual(["completada", "cancelada"]);

  // Sin conexión no se crea, cancela ni completa: mensaje claro.
  await page.context().setOffline(true);
  await expect(page.getByText(/Las reservas necesitan conexión/)).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByRole("form", { name: "Nueva reserva" })).toBeVisible();
});
