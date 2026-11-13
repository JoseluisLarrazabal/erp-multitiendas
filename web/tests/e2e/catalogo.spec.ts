import { expect, test, type Page } from "@playwright/test";
import {
  apiComo,
  crearProductosEnLote,
  ir,
  NEGOCIOS,
  rutaAuth,
  vigilarCsp,
  worker,
} from "./helpers";

// RF-CAT-01, 03, 04, 11, 12. Cada prueba crea sus propios productos (código y barras únicos por corrida):
// no depende del orden ni de lo que dejó otra. Reutilizan las sesiones de auth.setup, sin logins nuevos.
// Los workers arrancan a la vez: con solo la hora (ms) dos podían compartir corrida y chocar en código y barras
// ("Ya hay un producto con ese código"). El índice del worker los separa.
const corrida = `${Date.now().toString(36).toUpperCase()}${worker}`;
const marca = `${String(Date.now() % 1e7).padStart(7, "0")}${worker}`;
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

type Datos = {
  codigo: string;
  nombre: string;
  barras?: string;
  tipo?: string;
  marca?: string;
  categoria?: string; // nombre de una categoría ya creada
};

async function crearProducto(page: Page, p: Datos) {
  await ir(page, "/panel/productos/nuevo");
  if (p.tipo) await page.getByLabel("Tipo").selectOption(p.tipo);
  await page.getByLabel("Código", { exact: true }).fill(p.codigo);
  if (p.barras) await page.getByLabel("Código de barras").fill(p.barras);
  await page.getByLabel("Nombre").fill(p.nombre);
  if (p.marca) await page.getByLabel("Marca").fill(p.marca);
  if (p.categoria) await page.getByLabel("Categoría").selectOption({ label: p.categoria });
  await page.getByRole("button", { name: "Crear producto" }).click();
}

async function productoCreado(page: Page, p: Datos) {
  await crearProducto(page, p);
  await page.waitForURL(/\/panel\/productos\/[0-9a-f-]{36}$/);
}

// Con `q` la grilla de precios lleva el foco a su primera celda al montar (efecto posterior a la hidratación). Los
// tests que escriben con el teclado sin enfocar antes esperan ese foco; los que enfocan una celda no lo pierden.
async function irAGrilla(page: Page, url: string) {
  await ir(page, url);
  await expect(page.locator('input[data-fila="0"]:not(:disabled)').first()).toBeFocused();
}

test.describe("dueño: catálogo", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("crea un producto y lo encuentra por código de barras; código repetido da error @cross", async ({
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

  // RF-CAT-02: la búsqueda se combina con marca y categoría. Dos productos que solo se distinguen por ellas.
  test("filtra por marca y por categoría: incluye lo que coincide y excluye el resto @cross", async ({
    page,
  }) => {
    test.setTimeout(60_000); // 2 categorías y 2 productos por la UI: con muchos workers a la vez pasa de 30 s
    const categoriaA = `Cat A ${corrida}${++contador}`;
    const categoriaB = `Cat B ${corrida}${++contador}`;
    for (const nombre of [categoriaA, categoriaB]) {
      await ir(page, "/panel/productos/categorias");
      await page.getByLabel("Nombre de la categoría").fill(nombre);
      await page.getByRole("button", { name: "Crear categoría" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Categoría creada" })).toBeVisible();
    }
    const marcaA = `MarcaA${corrida}${++contador}`;
    const marcaB = `MarcaB${corrida}${++contador}`;
    const token = `Filtro${corrida}${++contador}`;
    const a = { ...unico(), marca: marcaA, categoria: categoriaA };
    const b = { ...unico(), marca: marcaB, categoria: categoriaB };
    a.nombre += ` ${token}`;
    b.nombre += ` ${token}`;
    await productoCreado(page, a);
    await productoCreado(page, b);

    const lista = page.getByRole("list", { name: "Productos" });
    // `q` acota a los productos de esta prueba; el filtro es lo que se verifica.
    await ir(page, `/panel/productos?q=${token}`);
    await expect(lista).toContainText(a.nombre);
    await expect(lista).toContainText(b.nombre);

    await page.getByLabel("Marca").selectOption(marcaA);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(new RegExp(`marca=${marcaA}`));
    await expect(lista).toContainText(a.nombre);
    await expect(lista).not.toContainText(b.nombre);

    await ir(page, `/panel/productos?q=${token}`);
    await page.getByLabel("Categoría").selectOption({ label: categoriaB });
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/categoria=[0-9a-f-]{36}/);
    await expect(lista).toContainText(b.nombre);
    await expect(lista).not.toContainText(a.nombre);
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

  test("la foto se amplía al hacer clic, en la lista y en la ficha; Escape cierra y devuelve el foco", async ({
    page,
  }) => {
    const p = unico();
    await ir(page, "/panel/productos/nuevo");
    await page.getByLabel("Código", { exact: true }).fill(p.codigo);
    await page.getByLabel("Nombre").fill(p.nombre);
    await page
      .locator("#producto-foto")
      .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Crear producto" }).click();
    await page.waitForURL(/\/panel\/productos\/[0-9a-f-]{36}$/);

    const ampliar = (raiz: Page) =>
      raiz.getByRole("button", { name: `Ampliar foto de ${p.nombre}` });
    const ventana = page.getByRole("dialog", { name: p.nombre });

    await ir(page, `/panel/productos?q=${p.codigo}`);
    const miniatura = ampliar(page);
    const chica = (await miniatura.boundingBox())!;
    await miniatura.click();
    await expect(ventana).toBeVisible();
    const grande = (await ventana.getByRole("img", { name: `Foto de ${p.nombre}` }).boundingBox())!;
    expect(grande.width).toBeGreaterThan(chica.width * 4);
    await expect(ventana.getByRole("button", { name: "Cerrar" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ventana).toBeHidden();
    await expect(miniatura).toBeFocused();

    await miniatura.click();
    await expect(ventana).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(ventana).toBeHidden();

    await page.getByRole("link", { name: p.nombre }).click();
    await page.waitForURL(/\/panel\/productos\/[0-9a-f-]{36}$/);
    const vista = ampliar(page);
    await vista.click();
    await expect(ventana.getByRole("img", { name: `Foto de ${p.nombre}` })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ventana).toBeHidden();
    await expect(vista).toBeFocused();
  });

  test("la foto grande se achica a 1.200 px y se sube como WebP", async ({ page }) => {
    const p = unico();
    await ir(page, "/panel/productos/nuevo");
    await page.getByLabel("Código", { exact: true }).fill(p.codigo);
    await page.getByLabel("Nombre").fill(p.nombre);
    // PNG de 2.400x1.600 armado en la página y puesto en el input como lo haría el selector de archivos.
    await page.evaluate(async () => {
      const lienzo = new OffscreenCanvas(2400, 1600);
      const ctx = lienzo.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, 2400, 1600);
      g.addColorStop(0, "#e11");
      g.addColorStop(1, "#11e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 2400, 1600);
      const blob = await lienzo.convertToBlob({ type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "grande.png", { type: "image/png" }));
      const input = document.querySelector<HTMLInputElement>("#producto-foto")!;
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.getByRole("img", { name: `Foto de ${p.nombre}` })).toBeVisible();
    await page.getByRole("button", { name: "Crear producto" }).click();
    await page.waitForURL(/\/panel\/productos\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop();
    const fila = await apiComo("dueno", `productos?select=foto_path&id=eq.${id}`);
    expect((fila.json as { foto_path: string }[])[0]!.foto_path).toMatch(/\.webp$/);
    const foto = page.getByRole("img", { name: `Foto de ${p.nombre}` });
    await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1200);
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

    await irAGrilla(page, `/panel/precios?q=${corrida}`);
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
    await irAGrilla(page, `/panel/precios?q=${p.codigo}`);
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
    await irAGrilla(page, `/panel/precios?q=${p.codigo}`);
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
    await irAGrilla(page, `/panel/precios?q=${p.codigo}`);
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

// RF-CAT-12: el navegador pide /api/dolar-paralelo (que a su vez consulta paralelo.bo). Se intercepta esa llamada del
// navegador: nunca se toca internet y la respuesta es determinista. El proxy del servidor lo cubre route.test.ts.
test.describe("dueño: dólar paralelo", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("muestra la referencia, avisa si está desactualizada y 'Usar este valor' solo llena el campo", async ({
    page,
  }) => {
    const respuesta = (leidoEn: string) => ({
      status: 200,
      json: { disponible: true, valor: 9.5, leidoEn },
    });
    await page.route("**/api/dolar-paralelo", (r) =>
      r.fulfill(respuesta(new Date().toISOString())),
    );
    await ir(page, "/panel/tipo-cambio");
    await expect(page.getByText("Paralelo Bs 9,50")).toBeVisible();
    await expect(page.getByText("(desactualizado)")).toHaveCount(0);
    const form = page.getByRole("form", { name: "Tipo de cambio nuevo" });
    await expect(form).toContainText("Paralelo: Bs 9,50");
    await form.getByRole("button", { name: "Usar este valor" }).click();
    await expect(form.getByLabel("Bs por 1 USD")).toHaveValue("9,50");
    await expect(form.getByLabel("Bs por 1 USD")).toBeFocused();
    // Solo sugiere: no registra nada hasta que se envíe el formulario.
    await expect(
      page.getByRole("status").filter({ hasText: "Tipo de cambio registrado" }),
    ).toHaveCount(0);

    // Lectura de hace 30 minutos (el umbral es 15): se marca como desactualizada.
    await page.unroute("**/api/dolar-paralelo");
    await page.route("**/api/dolar-paralelo", (r) =>
      r.fulfill(respuesta(new Date(Date.now() - 30 * 60_000).toISOString())),
    );
    await ir(page, "/panel/tipo-cambio");
    await expect(page.getByText("(desactualizado)")).toBeVisible();
  });

  test("si paralelo.bo no responde dice 'sin datos' y no ofrece el botón; ni con la red caída", async ({
    page,
  }) => {
    await page.route("**/api/dolar-paralelo", (r) =>
      r.fulfill({ status: 200, json: { disponible: false } }),
    );
    await ir(page, "/panel/tipo-cambio");
    await expect(page.getByText("Paralelo: sin datos").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Usar este valor" })).toHaveCount(0);
    // El formulario sigue sirviendo para registrar a mano.
    await expect(page.getByLabel("Bs por 1 USD")).toBeEnabled();

    await page.unroute("**/api/dolar-paralelo");
    await page.route("**/api/dolar-paralelo", (r) => r.abort());
    await ir(page, "/panel/tipo-cambio");
    await expect(page.getByText("Paralelo: sin datos").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Usar este valor" })).toHaveCount(0);
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
    const menu = page.getByRole("navigation", { name: "Principal" });
    for (const n of ["Productos", "Precios", "Tipo de cambio"]) {
      await expect(menu.getByRole("link", { name: n, exact: true })).toBeVisible();
    }
  });
});
