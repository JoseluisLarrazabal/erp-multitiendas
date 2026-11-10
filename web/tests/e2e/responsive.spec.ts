import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { abrirCaja, apiComo, cerrarCaja, equipoPropio, ir, NEGOCIOS, rutaAuth } from "./helpers";
import { entradaApi, ubicaciones } from "./inventario-helpers";
import { CLIENTE_LAVANDERIA, crearProductoConPrecio, SERVICIO_LAVADO } from "./pos-helpers";

// RF-TR-06: ninguna página del panel desborda el documento a 390 px. La lista de rutas sale de los page.tsx.
const RAIZ = join(process.cwd(), "src/app/(panel)/panel");

const rutas = (readdirSync(RAIZ, { recursive: true, encoding: "utf8" }) as string[])
  .filter((f) => f.endsWith("page.tsx"))
  .map((f) => f.replace(/\\/g, "/").replace(/\/?page\.tsx$/, ""))
  .sort();

const negocioDe = (ruta: string) =>
  ruta.startsWith("ordenes")
    ? NEGOCIOS.lavanderia.id
    : ruta === "inventario/vencimientos"
      ? NEGOCIOS.frial.id
      : NEGOCIOS.tienda.id;

const ID_DE: Record<string, string> = {
  get "cajas/[id]"() {
    return ids.caja;
  },
  get "ordenes/[id]"() {
    return ids.orden;
  },
  get "ventas/[id]"() {
    return ids.venta;
  },
  get "productos/[id]"() {
    return ids.producto;
  },
  get "inventario/[productoId]"() {
    return ids.producto;
  },
  get "creditos/[id]"() {
    return ids.credito;
  },
};
const UBICACION_LAVANDERIA = "b0000000-0000-0000-0000-000000000003";
const UBICACION_FRIAL = "b0000000-0000-0000-0000-000000000004";
// Ids creados en beforeAll, para las rutas con segmento dinámico.
const ids = { producto: "", venta: "", orden: "", caja: "", credito: "" };
const sesiones: string[] = [];
const equiposPos: Record<string, string> = {};
let ordenLavanderia = "";

// El seed no trae ventas, cajas ni órdenes: cada negocio recibe una venta (u orden) en su equipo propio (R1 y R2, que
// ningún otro spec usa), para que las páginas de detalle tengan qué mostrar aun con la base recién reiniciada.
async function equipoYCaja(negocio: string, ubicacion: string, prefijo: string) {
  const equipo = await equipoPropio(negocio, ubicacion, prefijo, `Caja responsive ${prefijo}`);
  const sesion = await abrirCaja(negocio, equipo);
  sesiones.push(sesion);
  const numero = `${prefijo}-${String(equipo.ultimo_numero + 1).padStart(6, "0")}`;
  return { equipo, sesion, numero };
}

test.beforeAll(async () => {
  const u = await ubicaciones();
  const producto = await crearProductoConPrecio({ contado: 30 });
  expect((await entradaApi(producto, u.tienda, 20, 12.5)).status).toBeLessThan(300);
  const t = await equipoYCaja(NEGOCIOS.tienda.id, u.tienda, "R1");
  equiposPos.tienda = t.equipo.id;
  ids.producto = producto.id;
  ids.caja = t.sesion;
  ids.venta = crypto.randomUUID();
  const venta = {
    id: ids.venta,
    dispositivo_id: t.equipo.id,
    caja_sesion_id: t.sesion,
    numero: t.numero,
    creada_en_cliente: new Date().toISOString(),
    descuento: 0,
    total: 90,
    items: [
      {
        producto_id: producto.id,
        lista: "contado",
        cantidad: 3,
        precio_unitario: 30,
        descuento: 0,
      },
    ],
    pagos: [{ medio: "efectivo", monto: 90 }],
  };
  const v = await apiComo("dueno", "rpc/registrar_venta", {
    metodo: "POST",
    cuerpo: { p_venta: venta },
  });
  expect(v.status, JSON.stringify(v.json)).toBeLessThan(300);

  const l = await equipoYCaja(NEGOCIOS.lavanderia.id, UBICACION_LAVANDERIA, "R2");
  // El frial no tiene equipo propio en este archivo: R3 con su caja abierta para recorrer el POS.
  const f = await equipoYCaja(NEGOCIOS.frial.id, UBICACION_FRIAL, "R3");
  equiposPos.frial = f.equipo.id;
  ids.orden = crypto.randomUUID();
  ordenLavanderia = ids.orden;
  const o = await apiComo("dueno", "rpc/crear_orden", {
    metodo: "POST",
    cuerpo: {
      p_venta: {
        id: ids.orden,
        dispositivo_id: l.equipo.id,
        caja_sesion_id: l.sesion,
        numero: l.numero,
        cliente_id: CLIENTE_LAVANDERIA,
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
            serie_id: null,
          },
        ],
        pagos: [{ medio: "efectivo", monto: 15 }],
      },
      p_orden: {
        express: false,
        prendas: 1,
        fecha_prometida: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      },
    },
  });
  expect(o.status, JSON.stringify(o.json)).toBeLessThan(300);

  // Saldo inicial (sin venta ni caja) para la página de detalle del crédito.
  const c = await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: NEGOCIOS.tienda.id,
      p_datos: { nombre: `Cliente responsive ${crypto.randomUUID().slice(0, 8)}` },
    },
  });
  expect(c.status, JSON.stringify(c.json)).toBeLessThan(300);
  ids.credito = crypto.randomUUID();
  const cr = await apiComo("dueno", "rpc/crear_credito_inicial", {
    metodo: "POST",
    cuerpo: {
      p_id: ids.credito,
      p_negocio_id: NEGOCIOS.tienda.id,
      p_cliente_id: c.json as string,
      p_capital: 50,
      p_cuotas: 2,
      p_primera: new Date().toISOString().slice(0, 10),
    },
  });
  expect(cr.status, JSON.stringify(cr.json)).toBeLessThan(300);
});

test.afterAll(async () => {
  // Con la caja cerrada la anulación no toca la venta; la orden de prueba se anula igual para que no quede activa.
  for (const s of sesiones) await cerrarCaja(s);
  if (ordenLavanderia)
    await apiComo("dueno", "rpc/anular_orden", {
      metodo: "POST",
      cuerpo: { p_orden_id: ordenLavanderia, p_motivo: "Limpieza de prueba" },
    });
  if (ids.credito)
    await apiComo("dueno", "rpc/anular_credito_inicial", {
      metodo: "POST",
      cuerpo: {
        p_operacion_id: crypto.randomUUID(),
        p_credito_id: ids.credito,
        p_motivo: "Limpieza de prueba",
      },
    });
});

test.use({ storageState: rutaAuth("dueno"), viewport: { width: 390, height: 844 } });

for (const ruta of rutas) {
  test(`/panel/${ruta} no desborda a 390 px`, async ({ page, context }) => {
    const negocio = negocioDe(ruta);
    await context.addCookies([
      { name: "negocio_activo", value: negocio, domain: "localhost", path: "/" },
    ]);
    let url = `/panel/${ruta}`.replace(/\/$/, "");
    if (ruta.includes("[")) {
      const id = ID_DE[ruta];
      expect(id, `sin id para ${ruta}`).toBeTruthy();
      url = url.replace(/\[\w+\]/, id!);
    }
    await ir(page, url);
    await expect(page.locator("main h1").first()).toBeVisible();
    const [ancho, visible] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(ancho, `scrollWidth ${ancho} > clientWidth ${visible}`).toBeLessThanOrEqual(visible);
  });
}

// M-16: la barra de modos del POS baja a una segunda fila en vez de desbordar. Con la caja abierta aparecen los 5 modos.
for (const negocio of ["tienda", "frial"] as const) {
  test(`/pos de ${negocio} no desborda a 390 px y muestra todos los modos`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "negocio_activo", value: NEGOCIOS[negocio].id, domain: "localhost", path: "/" },
    ]);
    await page.addInitScript(
      ([clave, id]) => localStorage.setItem(clave!, id!),
      [`erp:pos:equipo:${NEGOCIOS[negocio].id}`, equiposPos[negocio]!],
    );
    await page.goto("/pos");
    const modos = page.getByRole("group", { name: "Modo" }).getByRole("button");
    await expect(modos.first()).toBeVisible();
    for (const boton of await modos.all()) await expect(boton).toBeInViewport({ ratio: 1 });
    const [ancho, visible] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(ancho, `scrollWidth ${ancho} > clientWidth ${visible}`).toBeLessThanOrEqual(visible);
  });
}
