import { expect, test, type Page } from "@playwright/test";
import { apiComo, elegirNegocio, ir, NEGOCIOS, rutaAuth } from "./helpers";
import { corrida } from "./inventario-helpers";

// Fase 5, PR 2: frial (venta por peso, lote con vencimiento, merma). El dueño opera la caja del equipo F1, propio del
// frial: no comparte caja con ningún otro spec. Serial: una sola caja.
const FRIAL = NEGOCIOS.frial.id;
const COR_001 = "e0000000-0000-0000-0000-000000000007";
const COR_002 = "e0000000-0000-0000-0000-000000000008";

test.describe("frial", () => {
  test.use({ storageState: rutaAuth("dueno") });
  test.describe.configure({ mode: "serial" });

  let equipoId = "";

  async function sesionF1() {
    const r = await apiComo("dueno", "rpc/caja_sesion_abierta", {
      metodo: "POST",
      cuerpo: { p_dispositivo_id: equipoId },
    });
    return (r.json as { id: string }[])[0]?.id ?? null;
  }

  async function cerrarCajaF1() {
    const id = await sesionF1();
    if (!id) return;
    const r = await apiComo("dueno", "rpc/cerrar_caja", {
      metodo: "POST",
      cuerpo: { p_sesion_id: id, p_monto_contado: 0 },
    });
    expect(r.status).toBeLessThan(300);
  }

  test.beforeEach(async ({ page, context }) => {
    const r = await apiComo("dueno", `dispositivos?select=id&negocio_id=eq.${FRIAL}&prefijo=eq.F1`);
    equipoId = (r.json as { id: string }[])[0]!.id;
    await cerrarCajaF1();
    await elegirNegocio(context, FRIAL);
    await page.addInitScript(
      ([clave, id]) => localStorage.setItem(clave!, id!),
      [`erp:pos:equipo:${FRIAL}`, equipoId],
    );
  });
  test.afterEach(async () => {
    await cerrarCajaF1();
  });

  const combo = (page: Page) => page.getByRole("combobox", { name: "Producto" });
  async function elegirProducto(page: Page, codigo: string, nombre: string) {
    await combo(page).fill(codigo);
    await page.getByRole("option", { name: new RegExp(nombre) }).click();
  }

  test("E2E-10: venta por peso, 1,255 kg a Bs 60 son Bs 75,30 y queda en el kardex", async ({
    page,
  }) => {
    await page.goto("/pos");
    await expect(page.getByLabel("Negocio activo")).toHaveValue(FRIAL);
    await page.getByLabel("Efectivo inicial (Bs)").fill("0");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page.getByRole("searchbox", { name: "Buscar producto" })).toBeVisible();
    await expect(page.getByText(/productos en el catálogo/)).toBeVisible();

    await page.getByRole("searchbox", { name: "Buscar producto" }).fill("COR-001");
    await page.keyboard.press("Enter");
    const kg = page.getByLabel("Kg de Corte Demo A");
    await expect(kg).toHaveAttribute("inputmode", "decimal");
    await kg.fill("1,255");
    await expect(page.getByTestId("total")).toHaveText("Bs 75,30");

    await page
      .getByRole("button", { name: /^Cobrar/ })
      .first()
      .click();
    await page
      .getByRole("alertdialog", { name: "Cobrar venta" })
      .getByRole("button", { name: "Confirmar cobro" })
      .click();
    await expect(page.getByRole("article", { name: /Nota de venta/ })).toBeVisible();

    await ir(page, `/panel/inventario/${COR_001}`);
    const venta = page
      .getByRole("list", { name: "Movimientos" })
      .getByRole("listitem")
      .filter({ hasText: "Venta" })
      .first();
    await expect(venta).toContainText(/[−-]1,255/);
  });

  test("entrada con lote y vencimiento: aparece en vencimientos con su saldo", async ({ page }) => {
    const vence = new Date(Date.now() + 5 * 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "America/La_Paz",
    });
    const lote = `L-${corrida}`;
    await ir(page, "/panel/inventario/entrada");
    await elegirProducto(page, "COR-003", "Paquete Demo 1 kg");
    await page.getByLabel("Cantidad").fill("2");

    // Un lote sin fecha no se envía: el error queda en el campo.
    await page.getByLabel("Lote (opcional)").fill(lote);
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText("Indica la fecha de vencimiento del lote.")).toBeVisible();
    await expect(page.getByLabel("Vence (opcional)")).toBeFocused();

    const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "America/La_Paz",
    });
    await page.getByLabel("Vence (opcional)").fill(ayer);
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page.getByText("La fecha de vencimiento no puede ser pasada.")).toBeVisible();

    await page.getByLabel("Vence (opcional)").fill(vence);
    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Entrada registrada: 2 de Paquete Demo 1 kg" }),
    ).toBeVisible();

    await ir(page, "/panel/inventario/vencimientos?dias=7");
    const fila = page
      .getByRole("list", { name: "Lotes por vencer" })
      .getByRole("listitem")
      .filter({ hasText: lote });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText("En 5 días");
    await expect(fila).toContainText(vence.split("-").reverse().join("/"));
    await expect(fila).toContainText("Saldo estimado: 2");
    // El lote vencido del seed se marca con texto.
    await expect(page.getByText(/Vencido hace/).first()).toBeVisible();
    await expect(page.getByText(/el saldo es estimado/i)).toBeVisible();

    // Un filtro inválido avisa y vuelve a 7 días.
    await ir(page, "/panel/inventario/vencimientos?dias=99");
    await expect(page.getByText("Algún filtro de la dirección no era válido")).toBeVisible();
  });

  test("merma: la salida del frial nace como Merma y queda en el kardex", async ({ page }) => {
    const motivo = `Corte ${corrida}`;
    await ir(page, "/panel/inventario/salida");
    await expect(page.getByLabel("Tipo")).toHaveValue("merma");
    await elegirProducto(page, "COR-002", "Corte Demo B");
    await page.getByLabel("Cantidad").fill("0,500");
    await page.getByLabel("Motivo").fill(motivo);
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Movimiento registrado" }),
    ).toBeVisible();

    await ir(page, `/panel/inventario/${COR_002}`);
    const fila = page
      .getByRole("list", { name: "Movimientos" })
      .getByRole("listitem")
      .filter({ hasText: motivo });
    await expect(fila).toContainText("Merma");
    await expect(fila).toContainText(/[−-]0,5/);
  });

  test("peso del paquete: solo con unidad 'unidad' y se conserva al guardar", async ({ page }) => {
    const COR_003 = "e0000000-0000-0000-0000-00000000000b";
    const peso = async () =>
      (
        (await apiComo("dueno", `productos?select=peso_paquete_kg&id=eq.${COR_003}`)).json as {
          peso_paquete_kg: number | null;
        }[]
      )[0]!.peso_paquete_kg;

    await ir(page, "/panel/productos/nuevo");
    await expect(page.getByLabel("Peso del paquete (kg)")).toBeVisible();
    await page.getByLabel("Unidad").selectOption("kg");
    await expect(page.getByLabel("Peso del paquete (kg)")).toHaveCount(0);

    await ir(page, `/panel/productos/${COR_003}`);
    const campo = page.getByLabel("Peso del paquete (kg)");
    await expect(campo).toHaveValue("1");
    await campo.fill("0");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(await peso()).toBe(1);

    await campo.fill("1,000");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Producto guardado.")).toBeVisible();
    expect(await peso()).toBe(1);
  });
});

test.describe("negocio que no es frial", () => {
  test.use({ storageState: rutaAuth("encargadoTienda") });

  test("no ve vencimientos ni campos de lote", async ({ page }) => {
    await ir(page, "/panel/inventario");
    await expect(page.getByRole("link", { name: "Vencimientos" })).toHaveCount(0);

    await page.goto("/panel/inventario/vencimientos");
    await expect(page).toHaveURL(/\/panel$/);

    await ir(page, "/panel/productos/nuevo");
    await expect(page.getByLabel("Peso del paquete (kg)")).toHaveCount(0);

    await ir(page, "/panel/inventario/entrada");
    await expect(page.getByLabel("Lote (opcional)")).toHaveCount(0);
    await expect(page.getByLabel("Vence (opcional)")).toHaveCount(0);
  });
});
