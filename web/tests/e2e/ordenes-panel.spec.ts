import { expect, test } from "@playwright/test";
import { apiComo, envejecerOrden, NEGOCIOS, rutaAuth } from "./helpers";

// Panel de órdenes (fase 4, PR 3). Serial: comparten la caja L2 de la lavandería (propia, para no chocar con lavanderia.spec que usa L1). Cada orden se anula al final.
test.describe.configure({ mode: "serial" });

const lavanderia = NEGOCIOS.lavanderia.id;
const SERVICIO_LAVADO = "e0000000-0000-0000-0000-000000000009"; // SRV-001, normal 15 Bs (seed)

let equipoId = "";
let cajaId = "";
let abiertaPorLaPrueba = false;
let ordenId = "";
let numero = "";
const CLIENTE_ID = "f0000000-0000-0000-0000-000000000002"; // seed
const cliente = "Cliente Lavandería Demo";

async function sesionL2() {
  const r = await apiComo("encargadoLavanderia", "rpc/caja_sesion_abierta", {
    metodo: "POST",
    cuerpo: { p_dispositivo_id: equipoId },
  });
  return (r.json as { id: string }[])[0]?.id ?? null;
}

let siguienteNumero = 0;
const extras: string[] = [];

async function crearOrdenApi() {
  const id = crypto.randomUUID();
  siguienteNumero += 1;
  const num = `L2-${String(siguienteNumero).padStart(6, "0")}`;
  const r = await apiComo("encargadoLavanderia", "rpc/crear_orden", {
    metodo: "POST",
    cuerpo: {
      p_venta: {
        id,
        dispositivo_id: equipoId,
        caja_sesion_id: cajaId,
        numero: num,
        cliente_id: CLIENTE_ID,
        creada_en_cliente: new Date().toISOString(),
        descuento: 0,
        total: 15,
        items: [
          {
            producto_id: SERVICIO_LAVADO,
            lista: "normal",
            cantidad: 1,
            precio_unitario: 15,
            descuento: 0,
          },
        ],
        pagos: [{ medio: "efectivo", monto: 15 }],
      },
      p_orden: { express: false, prendas: 3, casillero: "Z9", fecha_prometida: "2030-01-15" },
    },
  });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
  return { id, numero: num };
}

test.beforeAll(async () => {
  const d = await apiComo(
    "encargadoLavanderia",
    `dispositivos?select=id,prefijo,ultimo_numero&negocio_id=eq.${lavanderia}&prefijo=eq.L2`,
  );
  const fila = (d.json as { id: string; ultimo_numero: number }[])[0];
  if (!fila) throw new Error("El seed no tiene el equipo L2.");
  equipoId = fila.id;
  cajaId = (await sesionL2()) ?? "";
  if (!cajaId) {
    cajaId = crypto.randomUUID();
    const a = await apiComo("encargadoLavanderia", "rpc/abrir_caja", {
      metodo: "POST",
      cuerpo: {
        p_id: cajaId,
        p_negocio_id: lavanderia,
        p_dispositivo_id: equipoId,
        p_monto_inicial: 100,
      },
    });
    expect(a.status).toBeLessThan(300);
    abiertaPorLaPrueba = true;
  }
  siguienteNumero = fila.ultimo_numero;
  ({ id: ordenId, numero } = await crearOrdenApi());
});

test.afterAll(async () => {
  // Idempotente: si la prueba de anulación ya la canceló, repetir el mismo motivo devuelve lo mismo.
  if (ordenId)
    await apiComo("encargadoLavanderia", "rpc/anular_orden", {
      metodo: "POST",
      cuerpo: { p_orden_id: ordenId, p_motivo: "Limpieza E2E" },
    });
  for (const id of extras)
    await apiComo("encargadoLavanderia", "rpc/anular_orden", {
      metodo: "POST",
      cuerpo: { p_orden_id: id, p_motivo: "Limpieza E2E" },
    });
  if (abiertaPorLaPrueba)
    await apiComo("encargadoLavanderia", "rpc/cerrar_caja", {
      metodo: "POST",
      cuerpo: { p_sesion_id: cajaId, p_monto_contado: 0 },
    });
});

test.describe("encargado de lavandería", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("ve Órdenes en el menú y la orden en la lista, con su detalle e historial", async ({
    page,
  }) => {
    await page.goto("/panel");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Órdenes" })
      .click();
    await expect(page).toHaveURL(/\/panel\/ordenes$/);
    await expect(page.getByRole("heading", { name: "Órdenes" })).toBeVisible();

    await page.getByLabel("Número o cliente").fill(cliente);
    await page.getByRole("button", { name: "Buscar" }).click();
    const fila = page.getByRole("link", { name: new RegExp(numero) });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText("Z9");
    await expect(fila).toContainText("Recibida");

    await fila.click();
    await expect(page.getByRole("heading", { name: `Orden ${numero}` })).toBeVisible();
    await expect(page.getByText(cliente).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Historial" }).getByText("Recibida")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver venta" })).toHaveAttribute(
      "href",
      `/panel/ventas/${ordenId}`,
    );
  });

  test("búsqueda por número y filtro Sin recoger vacío", async ({ page }) => {
    await page.goto("/panel/ordenes?q=L2-");
    await expect(page.getByRole("link", { name: new RegExp(numero) })).toBeVisible();
    await page.goto(`/panel/ordenes?q=${numero}`);
    await expect(page.getByRole("link", { name: new RegExp(numero) })).toBeVisible();

    // Por número y no por cliente: la prueba de "sin recoger con datos" deja órdenes viejas del mismo cliente.
    await page.goto(`/panel/ordenes?estado=sin_recoger&q=${numero}`);
    await expect(page.getByText("Ninguna orden coincide con los filtros.")).toBeVisible();
  });

  test("una búsqueda con signos de PostgREST no rompe la página", async ({ page }) => {
    await page.goto(`/panel/ordenes?q=${encodeURIComponent('a%_,(x)"')}`);
    await expect(page.getByRole("heading", { name: "Órdenes" })).toBeVisible();
    await expect(page.getByText("No se pudieron leer las órdenes.")).toHaveCount(0);
  });

  test("paginación por cursor: la segunda página y volver al inicio", async ({ page }) => {
    test.setTimeout(120_000);
    for (let i = 0; i < 26; i++) extras.push((await crearOrdenApi()).id);
    await page.goto("/panel/ordenes");
    const siguientes = page.getByRole("link", { name: /Siguientes/ });
    await expect(page.getByRole("list", { name: "Órdenes" }).getByRole("listitem")).toHaveCount(25);
    const href = await siguientes.getAttribute("href");
    expect(href).toMatch(/desde=\d{4}-\d{2}-\d{2}T[^&]*_[0-9a-f-]{36}/); // el "+" del huso va codificado
    expect(href).not.toMatch(/\+/);
    await siguientes.click();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Órdenes" }).getByRole("listitem").first(),
    ).toBeVisible();
    await expect(page.getByText("Algún filtro de la dirección no era válido")).toHaveCount(0);
  });

  test("búsqueda + paginación: la segunda página sigue filtrada y no repite filas", async ({
    page,
  }) => {
    // Depende de la prueba anterior (26+ órdenes del cliente semilla). Se pagina por cursor con q activo.
    const filas = page.getByRole("list", { name: "Órdenes" }).getByRole("listitem");
    await page.goto(`/panel/ordenes?q=${encodeURIComponent(cliente)}`);
    await expect(filas).toHaveCount(25);
    const primera = await filas.allInnerTexts();
    await page.getByRole("link", { name: /Siguientes/ }).click();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
    const segunda = await filas.allInnerTexts();
    expect(segunda.length).toBeGreaterThan(0);
    for (const t of segunda) {
      expect(t).toContain(cliente);
      expect(primera).not.toContain(t);
    }
  });

  // RF-LAV-07 / RN-09: solo las `lista` con más de 30 días son "sin recoger". La fecha se retrocede con un script que
  // entra como superusuario al contenedor de la base local (ninguna RPC puede), así que la prueba corre solo contra esa base.
  test("filtro Sin recoger con datos: lista vieja aparece; lista reciente y recibida vieja, no", async ({
    page,
  }) => {
    const vieja = await crearOrdenApi();
    const reciente = await crearOrdenApi();
    const recibidaVieja = await crearOrdenApi();
    try {
      for (const o of [vieja, reciente])
        for (const estado of ["en_lavado", "lista"])
          expect(
            (
              await apiComo("encargadoLavanderia", "rpc/cambiar_estado_orden", {
                metodo: "POST",
                cuerpo: { p_orden_id: o.id, p_estado: estado },
              })
            ).status,
          ).toBeLessThan(300);
      envejecerOrden(vieja.id, 31);
      envejecerOrden(reciente.id, 29);
      envejecerOrden(recibidaVieja.id, 40);

      await page.goto(`/panel/ordenes?estado=sin_recoger&q=${encodeURIComponent("L2-")}`);
      const lista = page.getByRole("list", { name: "Órdenes" });
      const fila = lista.getByRole("link", { name: new RegExp(vieja.numero) });
      await expect(fila).toBeVisible();
      await expect(fila).toContainText("Lista");
      await expect(fila).toContainText(cliente);
      await expect(fila).toContainText("Z9");
      await expect(lista.getByRole("link", { name: new RegExp(reciente.numero) })).toHaveCount(0);
      await expect(lista.getByRole("link", { name: new RegExp(recibidaVieja.numero) })).toHaveCount(
        0,
      );
    } finally {
      for (const o of [vieja, reciente, recibidaVieja]) extras.push(o.id);
    }
  });

  test("anular la orden devuelve el efectivo y lo muestra", async ({ page }) => {
    await page.goto(`/panel/ordenes/${ordenId}`);
    await page.getByLabel("Motivo de la anulación").fill("Cliente se arrepintió");
    await page.getByRole("button", { name: "Anular orden" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Anular orden" }).click();
    await expect(page.getByText("Se devolvió el efectivo de la caja.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anular orden" })).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Historial" }).getByText("Cancelada"),
    ).toBeVisible();
  });
});

test.describe("encargado de tienda", () => {
  test.use({ storageState: rutaAuth("encargadoTienda") });

  test("no ve Órdenes y /panel/ordenes lo devuelve al inicio", async ({ page }) => {
    await page.goto("/panel");
    await expect(
      page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Órdenes" }),
    ).toHaveCount(0);
    await page.goto("/panel/ordenes");
    await expect(page).toHaveURL(/\/panel$/);
  });
});

test.describe("encargado de lavandería sin créditos", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("/panel/creditos y su detalle lo devuelven al inicio", async ({ page }) => {
    await page.goto("/panel/creditos");
    await expect(page).toHaveURL(/\/panel$/);
    await page.goto("/panel/creditos/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/panel$/);
  });
});
