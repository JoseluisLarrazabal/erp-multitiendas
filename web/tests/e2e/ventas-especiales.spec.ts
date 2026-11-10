import { expect, test } from "@playwright/test";
import { apiComo, abrirCaja, equipoPropio, rutaAuth } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";
import { crearProductoConPrecio, tienda, type ProductoPos } from "./pos-helpers";

// M-5: el panel marca las ventas a crédito y de reserva, no ofrece Anular ni Devolver (el servidor las rechaza) y enlaza
// los pagos del crédito. Las ventas se crean por RPC con equipo propio (W9); el panel lo mira el dueño.
test.use({ storageState: rutaAuth("dueno") });
test.describe.configure({ mode: "serial" });

let equipoId = "";
let cajaId = "";
let siguiente = 0;
let producto: ProductoPos;
const ids = { normal: "", credito: "", reserva: "", creditoId: "" };
const numeros = { normal: "", credito: "", reserva: "" };
const nombreCliente = `Cliente especiales ${corrida}`;

const numero = () => `W9-${String(++siguiente).padStart(6, "0")}`;
function venta(extra: Record<string, unknown>, total: number, pagos: unknown[], n: string) {
  const id = crypto.randomUUID();
  return {
    id,
    cuerpo: {
      id,
      dispositivo_id: equipoId,
      caja_sesion_id: cajaId,
      numero: n,
      creada_en_cliente: new Date().toISOString(),
      total,
      items: [
        {
          producto_id: producto.id,
          lista: extra.condicion === "credito" ? "credito" : "contado",
          cantidad: 2,
          precio_unitario: total / 2,
        },
      ],
      pagos,
      ...extra,
    },
  };
}
async function registrar(cuerpo: unknown) {
  const r = await apiComo("encargadoTienda", "rpc/registrar_venta", {
    metodo: "POST",
    cuerpo: { p_venta: cuerpo },
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
}

test.beforeAll(async () => {
  const u = await ubicaciones();
  const equipo = await equipoPropio(tienda, u.tienda, "W9", "Caja de ventas especiales");
  equipoId = equipo.id;
  siguiente = equipo.ultimo_numero;
  cajaId = await abrirCaja(tienda, equipo);
  const c = await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: { p_negocio_id: tienda, p_datos: { nombre: nombreCliente } },
  });
  const clienteId = c.json as string;
  producto = await crearProductoConPrecio({ contado: 50, credito: 60, minimo: 45, stock: 30 });

  // Normal: contado, 100.
  numeros.normal = numero();
  const n = venta(
    { cliente_id: clienteId },
    100,
    [{ medio: "efectivo", monto: 100 }],
    numeros.normal,
  );
  ids.normal = n.id;
  await registrar(n.cuerpo);

  // Crédito: 2 x 60 = 120, inicial 60 (50 %), 3 cuotas.
  numeros.credito = numero();
  const c2 = venta(
    {
      cliente_id: clienteId,
      condicion: "credito",
      credito: { cuotas: 3, docs_ci: true, docs_domicilio: true, docs_pagare: true },
    },
    120,
    [{ medio: "efectivo", monto: 60 }],
    numeros.credito,
  );
  ids.credito = c2.id;
  await registrar(c2.cuerpo);
  const cr = await apiComo("dueno", `creditos?select=id&venta_id=eq.${ids.credito}`);
  ids.creditoId = (cr.json as { id: string }[])[0]!.id;

  // Reserva: 2 x 45 = 90, anticipo 30; la venta cobra el saldo.
  const reservaId = crypto.randomUUID();
  const rr = await apiComo("encargadoTienda", "rpc/crear_reserva", {
    metodo: "POST",
    cuerpo: {
      p_reserva: {
        id: reservaId,
        dispositivo_id: equipoId,
        caja_sesion_id: cajaId,
        cliente_id: clienteId,
        producto_id: producto.id,
        cantidad: 2,
        precio_acordado: 45,
        anticipo: 30,
        medio: "efectivo",
      },
    },
  });
  expect(rr.status, JSON.stringify(rr.json)).toBeLessThan(300);
  numeros.reserva = numero();
  const r3 = venta(
    { cliente_id: clienteId, reserva_id: reservaId },
    90,
    [
      { medio: "anticipo", monto: 30 },
      { medio: "efectivo", monto: 60 },
    ],
    numeros.reserva,
  );
  ids.reserva = r3.id;
  await registrar(r3.cuerpo);
});
test.afterAll(async () => {
  await apiComo("dueno", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
  });
});

test("la lista marca Crédito y Reserva; la venta normal no lleva marca", async ({ page }) => {
  await page.goto(`/panel/ventas?q=W9-`);
  const fila = (n: string) => page.getByRole("link", { name: new RegExp(n) });
  await expect(fila(numeros.credito)).toContainText("Crédito");
  await expect(fila(numeros.reserva)).toContainText("Reserva");
  await expect(fila(numeros.normal)).not.toContainText(/Crédito|Reserva/);
});

test("venta a crédito: sin Anular ni Devolver, con explicación, inicial y enlace al crédito", async ({
  page,
}) => {
  await page.goto(`/panel/ventas/${ids.credito}`);
  await expect(page.getByText("Esta venta es a crédito")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anular venta", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Devolver", exact: true })).toHaveCount(0);
  await expect(page.getByText("Inicial", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Ver pagos del crédito" }).click();
  await expect(page).toHaveURL(new RegExp(`/panel/creditos/${ids.creditoId}$`));
});

test("venta de reserva: sin Anular ni Devolver y con explicación", async ({ page }) => {
  await page.goto(`/panel/ventas/${ids.reserva}`);
  await expect(page.getByText("Esta venta completó una reserva")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anular venta", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Devolver", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver pagos del crédito" })).toHaveCount(0);
});

test("venta normal: conserva Anular y Devolver", async ({ page }) => {
  await page.goto(`/panel/ventas/${ids.normal}`);
  await expect(page.getByRole("heading", { name: "Anular venta", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Devolver", exact: true })).toBeVisible();
  await expect(page.getByText(/Esta venta (es a crédito|completó)/)).toHaveCount(0);
});
