import { expect, test, type Page } from "@playwright/test";
import { crearProductosEnLote, NEGOCIOS, rutaAuth, vigilarCsp } from "./helpers";

// RF-CAT-01, 03, 04, 11, 12. Cada prueba crea sus propios productos (código y barras únicos por corrida):
// no depende del orden ni de lo que dejó otra. Reutilizan las sesiones de auth.setup, sin logins nuevos.
const corrida = Date.now().toString(36).toUpperCase();
const marca = String(Date.now() % 1e8).padStart(8, "0");
let contador = 0;
const unico = () => {
  contador += 1;
  const n = `${corrida}${contador}`;
  // 13 dígitos, como un EAN: 9 + 8 de la hora de la corrida + 4 de contador, sin choques dentro de una corrida.
  const barras = `9${marca}${String(contador).padStart(4, "0")}`;
  return { codigo: `E2E-${n}`, nombre: `Producto E2E ${n}`, barras };
};

// PNG de 1x1 píxel.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHDSZ0QAAAABJRU5ErkJggg==",
  "base64",
);

// Navega y espera a que hidrate: con la carga de varios workers, un clic o un archivo antes de la hidratación se
// pierde. React marca con __reactProps$ cada nodo que hidrata, así que se espera a que todos los controles lo
// tengan (networkidle no lo garantizaba y tapó una falla de hidratación).
async function ir(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("input, select, button, form")].every((c) =>
      Object.keys(c).some((k) => k.startsWith("__reactProps$")),
    ),
  );
}

type Datos = { codigo: string; nombre: string; barras?: string; tipo?: string };

async function crearProducto(page: Page, p: Datos) {
  await ir(page, "/panel/productos/nuevo");
  if (p.tipo) await page.getByLabel("Tipo").selectOption(p.tipo);
  await page.getByLabel("Código", { exact: true }).fill(p.codigo);
  if (p.barras) await page.getByLabel("Código de barras").fill(p.barras);
  await page.getByLabel("Nombre").fill(p.nombre);
  await page.getByRole("button", { name: "Crear producto" }).click();
}

async function productoCreado(page: Page, p: Datos) {
  await crearProducto(page, p);
  await page.waitForURL(/\/panel\/productos\/[0-9a-f-]{36}$/);
}

test.describe("dueño: catálogo", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("crea un producto y lo encuentra por código de barras; código repetido da error", async ({
    page,
  }) => {
    const p = unico();
    await productoCreado(page, p);
    await expect(page.getByRole("heading", { name: p.nombre, level: 1 })).toBeVisible();

    await ir(page, `/panel/productos?q=${p.barras}`);
    const lista = page.getByRole("list", { name: "Productos" });
    await expect(lista.getByRole("listitem")).toHaveCount(1);
    await expect(lista).toContainText(p.nombre);
    await expect(lista).toContainText("Sin precio");

    await crearProducto(page, { codigo: p.codigo, nombre: "Otro nombre" });
    await expect(
      page.getByRole("alert").filter({ hasText: "Ya hay un producto con ese código." }),
    ).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("Otro nombre");

    await crearProducto(page, { ...unico(), barras: p.barras });
    await expect(page.getByRole("alert").filter({ hasText: "código de barras" })).toBeVisible();
  });

  test("lector simulado: la búsqueda arranca enfocada, se teclea el código y Enter", async ({
    page,
  }) => {
    const p = unico();
    await productoCreado(page, p);
    await ir(page, "/panel/productos");
    await expect(page.getByRole("searchbox", { name: "Buscar" })).toBeFocused();
    await page.keyboard.type(p.barras);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`q=${p.barras}`));
    await expect(page.getByRole("list", { name: "Productos" }).getByRole("listitem")).toHaveCount(
      1,
    );
  });

  test("una búsqueda con coma y paréntesis no rompe la lista", async ({ page }) => {
    await ir(page, "/panel/productos?q=a,b(c)%25_*");
    await expect(page.getByRole("heading", { name: "Productos", level: 1 })).toBeVisible();
    // El anunciador de rutas de Next es un role=alert vacío: solo cuentan los que tienen texto.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
  });

  test("la búsqueda encuentra nombres con coma y guion bajo", async ({ page }) => {
    const p = unico();
    const nombre = `Cable 2,5mm AB_12 ${p.nombre}`;
    await productoCreado(page, { ...p, nombre });
    await ir(page, `/panel/productos?q=${encodeURIComponent(nombre)}`);
    await expect(page.getByRole("list", { name: "Productos" })).toContainText(nombre);
  });

  test("sube una foto y se ve en la ficha (CSP permite el origen de Storage)", async ({ page }) => {
    const verCsp = vigilarCsp(page);
    const p = unico();
    await ir(page, "/panel/productos/nuevo");
    await page.getByLabel("Código", { exact: true }).fill(p.codigo);
    await page.getByLabel("Nombre").fill(p.nombre);
    await page
      .locator("#producto-foto")
      .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("img", { name: `Foto de ${p.nombre}` })).toBeVisible();
    await page.getByRole("button", { name: "Crear producto" }).click();
    await page.waitForURL(/\/panel\/productos\/[0-9a-f-]{36}$/);
    const foto = page.getByRole("img", { name: `Foto de ${p.nombre}` });
    await expect(foto).toBeVisible();
    await expect
      .poll(() => foto.evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(0);
    verCsp();
  });

  test("rechaza una foto de tipo no permitido antes de subir", async ({ page }) => {
    await ir(page, "/panel/productos/nuevo");
    await page.locator("#producto-foto").setInputFiles({
      name: "dibujo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
    await expect(page.getByRole("alert").filter({ hasText: "JPG, PNG o WebP" })).toBeVisible();
  });

  test("desactiva un producto con confirmación y desaparece de la lista", async ({ page }) => {
    const p = unico();
    await productoCreado(page, p);
    await page.getByRole("button", { name: "Desactivar producto" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toContainText(`¿Desactivar ${p.nombre}?`);
    await dialogo.getByRole("button", { name: "Desactivar", exact: true }).click();
    await expect(dialogo).toBeHidden();
    await ir(page, `/panel/productos?q=${p.codigo}`);
    await expect(page.getByText("Ningún producto coincide")).toBeVisible();
    await ir(page, `/panel/productos?q=${p.codigo}&inactivos=1`);
    await expect(page.getByRole("list", { name: "Productos" })).toContainText("Inactivo");
  });

  test("crea y renombra una categoría; el nombre repetido da error", async ({ page }) => {
    const nombre = `Cat ${corrida}${++contador}`;
    await ir(page, "/panel/productos/categorias");
    await page.getByLabel("Nombre de la categoría").fill(nombre);
    await page.getByRole("button", { name: "Crear categoría" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Categoría creada" })).toBeVisible();
    await expect(page.getByRole("form", { name: `Renombrar ${nombre}` })).toBeVisible();

    await page.getByLabel("Nombre de la categoría").fill(nombre);
    await page.getByRole("button", { name: "Crear categoría" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ya hay una categoría" })).toBeVisible();

    const fila = page.getByRole("form", { name: `Renombrar ${nombre}` });
    await fila.getByLabel("Nombre").fill(`${nombre} bis`);
    await fila.getByRole("button", { name: "Renombrar" }).click();
    await expect(page.getByRole("form", { name: `Renombrar ${nombre} bis` })).toBeVisible();
  });

  test("grilla: carga precios, Enter baja de fila, guarda y la lista muestra contado en Bs", async ({
    page,
  }) => {
    const a = unico();
    const b = unico();
    await productoCreado(page, a);
    await productoCreado(page, b);

    await ir(page, `/panel/precios?q=${corrida}`);
    const celdaA = page.getByLabel(`Contado de ${a.nombre}`);
    const celdaB = page.getByLabel(`Contado de ${b.nombre}`);
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    await celdaA.fill("1234,5");
    await celdaA.press("Enter");
    await expect(celdaB).toBeFocused();
    await page.getByLabel(`Crédito de ${a.nombre}`).fill("abc");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "montos inválidos" })).toBeVisible();
    await expect(celdaA).toHaveValue("1234,5");
    await page.getByLabel(`Crédito de ${a.nombre}`).fill("1300");

    // Navegar con cambios sin guardar pide confirmación; cancelar se queda.
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("link", { name: "Productos", exact: true }).click();
    await expect(page).toHaveURL(/\/panel\/precios/);

    await expect(page.getByText("1 fila modificada")).toBeVisible();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se guardaron 1 fila" })).toBeVisible();
    await expect(page.getByText("Sin cambios")).toBeVisible();

    await ir(page, `/panel/productos?q=${a.codigo}`);
    await expect(page.getByRole("list", { name: "Productos" })).toContainText("Bs 1.234,50");
    await ir(page, `/panel/precios?q=${corrida}&sinPrecio=1`);
    await expect(page.getByLabel(`Contado de ${b.nombre}`)).toBeVisible();
    await expect(page.getByLabel(`Contado de ${a.nombre}`)).toHaveCount(0);
  });

  test("lista: con precio en otra lista pero sin contado dice 'Sin precio de contado'", async ({
    page,
  }) => {
    const p = unico();
    await productoCreado(page, p);
    await ir(page, `/panel/precios?q=${p.codigo}`);
    await page.getByLabel(`Crédito de ${p.nombre}`).fill("50");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se guardaron 1 fila" })).toBeVisible();
    await ir(page, `/panel/productos?q=${p.codigo}`);
    await expect(page.getByRole("list", { name: "Productos" })).toContainText(
      "Sin precio de contado",
    );
  });

  test("precios: con búsqueda el foco va a la primera celda, Enter en la última fila va a Guardar; costo 0 es válido", async ({
    page,
  }) => {
    const p = unico();
    await productoCreado(page, p);
    await ir(page, "/panel/precios");
    await expect(page.getByRole("searchbox", { name: "Buscar" })).not.toBeFocused();

    await ir(page, `/panel/precios?q=${p.codigo}`);
    const contado = page.getByLabel(`Contado de ${p.nombre}`);
    await expect(contado).toBeFocused();
    await page.keyboard.type("1500.50");
    await page.getByLabel(`Costo de ${p.nombre}`).fill("0");
    await contado.press("Enter");
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeFocused();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Fin de la página: guarda para pasar a la siguiente" }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Se guardaron 1 fila" })).toBeVisible();

    await ir(page, `/panel/precios?q=${p.codigo}`);
    await expect(page.getByLabel(`Contado de ${p.nombre}`)).toHaveValue("1500,50");
    await expect(page.getByLabel(`Costo de ${p.nombre}`)).toHaveValue("0");
  });

  test("precios: 1.500 se rechaza con el mensaje de miles y el foco va a la celda", async ({
    page,
  }) => {
    const p = unico();
    await productoCreado(page, p);
    await ir(page, `/panel/precios?q=${p.codigo}`);
    await page.getByLabel(`Contado de ${p.nombre}`).fill("1.500");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("sin puntos de miles")).toBeVisible();
    await expect(page.getByLabel(`Contado de ${p.nombre}`)).toBeFocused();
    await expect(page.getByLabel(`Contado de ${p.nombre}`)).toHaveAccessibleDescription(
      /sin puntos de miles/,
    );
  });

  test("precios: guardar en la última página de 'sin precio' no deja la pantalla muerta; Enter final y Siguiente", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const lote = `LOTE-${corrida}-${++contador}`;
    // Con guion final: otro lote cuyo número empiece igual (1 y 12) no entra en la búsqueda.
    const q = `${lote}-`;
    await crearProductosEnLote("dueno", NEGOCIOS.tienda.id, lote, 51);

    // Página 2 de 2: queda 1 producto. Al guardarle precio la lista pasa a 1 página y la URL sigue pidiendo la 2.
    await ir(page, `/panel/precios?q=${q}&sinPrecio=1&pagina=2`);
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await page.getByLabel(`Contado de ${lote} 051`).fill("10");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se guardaron 1 fila" })).toBeVisible();
    await expect(page.getByText("Página 1 de 1")).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(51);
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);

    // Una página fuera de rango desde el inicio también se acota.
    await ir(page, `/panel/precios?q=${q}&sinPrecio=1&pagina=9`);
    await expect(page.getByText("Página 1 de 1")).toBeVisible();

    // Última fila de la página 1 (hay otra detrás): Enter va a Guardar; guardar sin fallas deja el foco en Siguiente.
    await ir(page, `/panel/precios?q=${q}`);
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await page.getByLabel(`Contado de ${lote} 050`).fill("5");
    await page.getByLabel(`Contado de ${lote} 050`).press("Enter");
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Se guardaron 1 fila" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Siguiente" })).toBeFocused();
  });

  test("tipo de cambio: registrarlo cambia los Bs de un producto en USD", async ({ page }) => {
    const p = unico();
    await productoCreado(page, p);
    await ir(page, `/panel/precios?q=${p.codigo}`);
    await page.getByLabel(`Moneda de ${p.nombre}`).selectOption("USD");
    await page.getByLabel(`Contado de ${p.nombre}`).fill("100");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se guardaron 1 fila" })).toBeVisible();

    const registrar = async (valor: string) => {
      await ir(page, "/panel/tipo-cambio");
      await page.getByLabel("Bs por 1 USD").fill(valor);
      await page.getByRole("button", { name: "Registrar tipo de cambio" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Tipo de cambio registrado" }),
      ).toBeVisible();
    };
    const enLista = async (bs: string) => {
      await ir(page, `/panel/productos?q=${p.codigo}`);
      await expect(page.getByRole("list", { name: "Productos" })).toContainText(bs);
    };

    await registrar("7,25");
    await expect(page.getByTestId("tc-vigente")).toContainText("7,25");
    await enLista("Bs 725,00");
    await registrar("7,5");
    await enLista("Bs 750,00");
    await ir(page, "/panel/tipo-cambio");
    await expect(page.getByRole("table")).toContainText("7,25");
    await page.getByLabel("Bs por 1 USD").fill("0");
    await page.getByRole("button", { name: "Registrar tipo de cambio" }).click();
    await expect(page.getByText("mayor a 0")).toBeVisible();

    // Un valor que se aleja más de 20 % del vigente pide confirmación; cancelar no registra nada.
    await expect(page.getByText("Vigente: Bs 7,50")).toBeVisible();
    await page.getByLabel("Bs por 1 USD").fill("75");
    await page.getByRole("button", { name: "Registrar tipo de cambio" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toContainText("¿Registrar Bs 75,00 por 1 USD?");
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByTestId("tc-vigente")).toContainText("7,5");
  });
});

test.describe("vendedor", () => {
  test.use({ storageState: rutaAuth("vendedor") });

  test("no entra a Productos, Precios ni Tipo de cambio por URL", async ({ page }) => {
    for (const ruta of [
      "/panel/precios",
      "/panel/productos",
      "/panel/productos/nuevo",
      "/panel/tipo-cambio",
    ]) {
      await ir(page, ruta);
      await expect(page).toHaveURL(/\/pos$/);
    }
  });
});

test.describe("encargado de lavandería", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("la grilla trae las listas de lavandería, no las de tienda", async ({ page }) => {
    await ir(page, "/panel/precios");
    const tabla = page.getByRole("table");
    for (const col of ["Normal", "Express", "Costo (Bs)"]) {
      await expect(tabla.getByRole("columnheader", { name: col })).toBeVisible();
    }
    await expect(tabla.getByRole("columnheader", { name: "Contado" })).toHaveCount(0);
  });
});

test.describe("encargado de lavandería: grilla", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("Enter en Costo salta el servicio (costo deshabilitado) y baja al siguiente insumo", async ({
    page,
  }) => {
    const u = unico();
    const datos = (letra: string, tipo: string) => ({
      codigo: `${u.codigo}-${letra}`,
      nombre: `${u.nombre} ${letra}`,
      tipo,
    });
    for (const d of [datos("A", "insumo"), datos("B", "servicio"), datos("C", "insumo")]) {
      await productoCreado(page, d);
    }
    await ir(page, `/panel/precios?q=${u.codigo}`);
    await expect(page.getByLabel(`Costo de ${u.nombre} B`)).toBeDisabled();
    await page.getByLabel(`Costo de ${u.nombre} A`).fill("5");
    await page.getByLabel(`Costo de ${u.nombre} A`).press("Enter");
    await expect(page.getByLabel(`Costo de ${u.nombre} C`)).toBeFocused();
  });
});

test.describe("encargado de tienda", () => {
  test.use({ storageState: rutaAuth("encargadoTienda") });

  test("ve Productos, Precios y Tipo de cambio en el menú", async ({ page }) => {
    await ir(page, "/panel");
    for (const n of ["Productos", "Precios", "Tipo de cambio"]) {
      await expect(page.getByRole("link", { name: n, exact: true })).toBeVisible();
    }
  });
});
