import { expect, test, type Browser, type Page } from "@playwright/test";
import { apiComo, CLAVE, CUENTAS, iniciarSesionUI, rutaAuth, worker } from "./helpers";

// RF-TR-04, RF-TR-05, RF-TR-08. Cada corrida crea sus propios datos (correo y prefijo únicos).
// Con solo la hora (ms), dos workers que cargan el archivo a la vez compartían corrida y chocaban en correo y nombre;
// el índice del worker los separa.
const corrida = `${Date.now().toString(36)}${worker}`;

async function intentarLogin(browser: Browser, correo: string, clave: string) {
  const contexto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await contexto.newPage();
  await iniciarSesionUI(page, correo, clave);
  return { page, cerrar: () => contexto.close() };
}

async function crearPersona(page: Page, nombre: string, rol: string) {
  await page.goto("/panel/usuarios");
  await page.getByLabel("Nombre").fill(nombre);
  await page.getByLabel("Correo").fill(`${nombre.replace(/\s/g, "-").toLowerCase()}@erp.test`);
  await page.getByLabel("Rol", { exact: true }).selectOption(rol);
  await page.getByLabel("Contraseña inicial").fill("Clave-inicial-1");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Cuenta creada" })).toBeVisible();
  return page.getByRole("row").filter({ hasText: nombre });
}

test.describe("dueño administra usuarios", () => {
  test.use({ storageState: rutaAuth("dueno") });

  test("crea un usuario que entra, y al desactivarlo ya no entra", async ({ page, browser }) => {
    const nombre = `Persona ${corrida}`;
    const correo = `e2e-${corrida}@erp.test`;
    const claveInicial = "Clave-inicial-1";

    await page.goto("/panel/usuarios");
    await page.getByLabel("Nombre").fill(nombre);
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Rol", { exact: true }).selectOption("vendedor");
    await page.getByLabel("Contraseña inicial").fill(claveInicial);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cuenta creada" })).toBeVisible();
    // La clave inicial no queda a la vista.
    await expect(page.getByLabel("Contraseña inicial")).toHaveValue("");
    const fila = page.getByRole("row").filter({ hasText: nombre });
    await expect(fila).toContainText("Activo");

    const nuevo = await intentarLogin(browser, correo, claveInicial);
    await expect(nuevo.page).toHaveURL(/\/pos$/);
    await nuevo.cerrar();

    await fila.getByRole("button", { name: "Desactivar" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toContainText(`¿Desactivar a ${nombre}?`);
    await dialogo.getByRole("button", { name: "Desactivar cuenta" }).click();
    await expect(fila).toContainText("Desactivado");

    const bloqueado = await intentarLogin(browser, correo, claveInicial);
    await expect(
      bloqueado.page.getByRole("alert").filter({ hasText: /incorrectos/ }),
    ).toBeVisible();
    await bloqueado.cerrar();

    await fila.getByRole("button", { name: "Reactivar" }).click();
    await expect(fila).toContainText("Activo");
  });

  test("campos inválidos: error por campo, aria y foco al primero", async ({ page }) => {
    await page.goto("/panel/usuarios");
    await page.getByLabel("Contraseña inicial").fill("corta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    const nombre = page.getByLabel("Nombre");
    await expect(nombre).toBeFocused();
    await expect(nombre).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Escribe el nombre de la persona.")).toBeVisible();
    await expect(page.getByLabel("Correo")).toHaveAttribute(
      "aria-describedby",
      /nuevo-correo-error/,
    );
    await expect(page.getByLabel("Contraseña inicial")).toHaveAttribute(
      "aria-describedby",
      /nuevo-clave-error/,
    );
  });

  test("sin conexión: error inline, sin error boundary y lo escrito se conserva", async ({
    page,
  }) => {
    await page.goto("/panel/usuarios");
    await page.getByLabel("Nombre").fill("Sin red");
    await page.getByLabel("Correo").fill("sin-red@erp.test");
    await page.getByLabel("Contraseña inicial").fill("Clave-inicial-1");
    await page.route("**/panel/usuarios", (ruta) =>
      ruta.request().method() === "POST" ? ruta.abort() : ruta.continue(),
    );
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /No pudimos conectar/ })).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("Sin red");
    await expect(page.getByLabel("Contraseña inicial")).toHaveValue("Clave-inicial-1");
    await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
  });

  test("cambio de rol: las flechas no piden nada, cancelar revierte y confirmar aplica", async ({
    page,
  }) => {
    const nombre = `Rol ${corrida}`;
    const fila = await crearPersona(page, nombre, "vendedor");
    const rol = fila.getByRole("combobox", { name: `Rol de ${nombre}` });
    await expect(rol).toHaveValue("vendedor");

    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
    const dialogo = page.getByRole("alertdialog");

    await rol.focus();
    await rol.press("ArrowDown");
    await expect(dialogo).toContainText(`¿Cambiar a ${nombre} de Vendedor a Empleado?`);
    expect(posts).toEqual([]);
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toBeHidden();
    await expect(rol).toHaveValue("vendedor");
    expect(posts).toEqual([]);

    await rol.selectOption("encargado");
    await expect(dialogo).toContainText("de Vendedor a Encargado");
    await dialogo.getByRole("button", { name: "Cambiar rol" }).click();
    await expect(dialogo).toBeHidden();
    await expect(rol).toHaveValue("encargado");
    await page.reload();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: nombre })
        .getByRole("combobox", { name: `Rol de ${nombre}` }),
    ).toHaveValue("encargado");
  });

  test("diálogo: el foco no se escapa con Tab ni Shift+Tab, Esc lo devuelve, quitar enfoca el título", async ({
    page,
  }) => {
    await page.goto("/panel/usuarios");
    // Una persona de lavandería sumada a la tienda: tiene otro negocio, así que se puede quitar.
    const ajeno = "Empleado Lavandería";
    await page.getByLabel("Persona", { exact: true }).selectOption({ label: ajeno });
    await page.getByRole("button", { name: "Agregar al negocio" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Persona agregada" })).toBeVisible();
    const fila = page.getByRole("row").filter({ hasText: ajeno });
    const quitar = fila.getByRole("button", { name: "Quitar" });
    const dialogo = page.getByRole("alertdialog");
    const dentro = () => dialogo.evaluate((d) => d.contains(document.activeElement));

    await quitar.click();
    await expect(dialogo).toBeVisible();
    // Los guards de base-ui devuelven el foco al siguiente frame: se espera a que aterrice antes de la tecla siguiente
    // (dos Tab en menos de un frame, imposible a mano, sí escapan del diálogo).
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      await expect.poll(dentro).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Shift+Tab");
      await expect.poll(dentro).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(quitar).toBeFocused();

    await quitar.click();
    await dialogo.getByRole("button", { name: "Quitar del negocio" }).click();
    await expect(fila).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Usuarios", level: 1 })).toBeFocused();
  });

  test("correo repetido y mi propia fila sin acciones", async ({ page }) => {
    await page.goto("/panel/usuarios");
    await page.getByLabel("Nombre").fill("Repetido");
    await page.getByLabel("Correo").fill(CUENTAS.dueno);
    await page.getByLabel("Contraseña inicial").fill("Clave-inicial-1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Ya existe una cuenta/ })).toBeVisible();

    const yo = page.getByRole("row").filter({ hasText: "Dueño Demo" });
    await expect(yo).toContainText("Tú");
    await expect(yo.getByRole("button")).toHaveCount(0);
  });

  test("registra un dispositivo y rechaza el prefijo repetido", async ({ page }) => {
    // Los dispositivos no se borran y el prefijo es único por negocio: un número al azar acabaría repitiendo uno de
    // corridas anteriores. Se toma el primero libre de Y10..P99.
    const usados = new Set(
      ((await apiComo("dueno", "dispositivos?select=prefijo")).json as { prefijo: string }[]).map(
        (d) => d.prefijo,
      ),
    );
    const prefijo = [..."YXWVUTSRQP"]
      .flatMap((l) => Array.from({ length: 90 }, (_, i) => `${l}${i + 10}`))
      .find((p) => !usados.has(p));
    if (!prefijo) throw new Error("No quedan prefijos libres para el dispositivo de prueba.");
    const nombre = `Caja ${corrida}`;
    await page.goto("/panel/dispositivos");
    const registrar = async () => {
      await page.getByLabel("Nombre").fill(nombre);
      await page.getByLabel("Prefijo").fill(prefijo.toLowerCase());
      await page.getByRole("button", { name: "Registrar dispositivo" }).click();
    };
    await registrar();
    await expect(
      page.getByRole("status").filter({ hasText: "Dispositivo registrado" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: nombre })).toContainText(prefijo);

    await registrar();
    await expect(
      page.getByRole("alert").filter({ hasText: /Ya hay un dispositivo/ }),
    ).toBeVisible();
  });
});

test.describe("encargado de tienda", () => {
  test.use({ storageState: rutaAuth("encargadoTienda") });

  test("no ve Usuarios ni Dispositivos y su URL directa se rechaza", async ({ page }) => {
    await page.goto("/panel");
    const menu = page.getByRole("navigation", { name: "Principal" });
    await expect(menu.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Dispositivos" })).toHaveCount(0);
    for (const ruta of ["/panel/usuarios", "/panel/dispositivos"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/panel$/);
    }
  });
});

test.describe("encargado de lavandería", () => {
  test.use({ storageState: rutaAuth("encargadoLavanderia") });

  test("administra su personal pero no tiene acciones sobre un dueño", async ({ page }) => {
    await page.goto("/panel/usuarios");
    const dueno = page.getByRole("row").filter({ hasText: "Dueño Demo" });
    await expect(dueno).toBeVisible();
    await expect(dueno.getByRole("button")).toHaveCount(0);
    await expect(dueno.getByRole("combobox")).toHaveCount(0);
    const empleado = page.getByRole("row").filter({ hasText: "Empleado Lavandería" });
    await expect(empleado.getByRole("button", { name: "Quitar" })).toBeVisible();
    // No ofrece el rol dueño al crear.
    await expect(
      page.getByLabel("Rol", { exact: true }).locator("option[value=dueno]"),
    ).toHaveCount(0);
  });
});

test.describe("login", () => {
  test.use({ javaScriptEnabled: false });

  test("sin hidratar el botón está deshabilitado y Enter no envía", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    await page.getByLabel("Correo").fill(CUENTAS.dueno);
    await page.getByLabel("Contraseña").fill(CLAVE);
    await page.getByLabel("Contraseña").press("Enter");
    await expect(page).toHaveURL(/\/login$/);
  });
});
