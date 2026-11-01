import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importar } from "../../src/main.ts";
import { crearXlsx, filaProducto } from "../xlsx.ts";

const URL_API = process.env.SUPABASE_URL ?? "";
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const cliente = createClient(URL_API, CLAVE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dir = mkdtempSync(join(tmpdir(), "importacion-it-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Un negocio propio por corrida: los productos y el kardex no se pueden borrar.
const negocioId = randomUUID();
const negocioSinDeposito = randomUUID();
let archivo = "";

async function crearNegocio(id: string, nombres: string[]) {
  const n = await cliente
    .from("negocios")
    .insert({ id, nombre: `Prueba ${id.slice(0, 8)}`, tipo: "tienda" });
  expect(n.error).toBeNull();
  const u = await cliente
    .from("ubicaciones")
    .insert(
      nombres.map((nombre) => ({
        negocio_id: id,
        nombre,
        tipo: nombre === "Tienda" ? "local" : "deposito",
      })),
    );
  expect(u.error).toBeNull();
}

beforeAll(async () => {
  await crearNegocio(negocioId, ["Tienda", "Depósito"]);
  await crearNegocio(negocioSinDeposito, ["Tienda"]);
  archivo = join(dir, "sintetico.xlsx");
  await crearXlsx(archivo, [
    filaProducto({ codigo: "ej-1", nombre: "Ejemplo uno", stock: 99 }),
    filaProducto({ codigo: "ej-2", nombre: "Ejemplo dos", stock: 99 }),
    filaProducto({
      codigo: "001",
      barras: "0001234",
      nombre: "  Taza   azul ",
      marca: "--",
      categoria: "Cocina",
      stock: 4,
      ubicacion: "tienda",
    }),
    filaProducto({
      codigo: "002",
      barras: "0001234",
      nombre: "Plato",
      marca: "Acme",
      categoria: "cocina",
      stock: 6,
      ubicacion: "deposito",
    }),
    filaProducto({
      codigo: "003",
      barras: "aro 20/29",
      nombre: "Llanta",
      categoria: "Repuestos",
      stock: 2,
    }),
    filaProducto({ codigo: "003", nombre: "Llanta repetida", stock: 50 }),
    filaProducto({ codigo: "004", nombre: "Sin stock", stock: null, ubicacion: "tienda" }),
    filaProducto({ codigo: "005", nombre: "Decimal", stock: "1,5" }),
    ["598"],
  ]);
});

const contar = async (tabla: string, filtro: Record<string, string> = {}) => {
  let q = cliente.from(tabla).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
  const { count, error } = await q;
  expect(error).toBeNull();
  return count ?? 0;
};

describe("importación contra Supabase local", () => {
  it("la corrida seca no escribe", async () => {
    const reporte = await importar({
      archivo,
      negocioId,
      cliente: null,
      rutaReporte: join(dir, "seco.json"),
    });
    expect(reporte.modo).toBe("seco");
    expect(reporte.filas).toEqual({ datos: 9, aceptadas: 4, rechazadas: 2, excluidas: 3 });
    expect(await contar("productos", { negocio_id: negocioId })).toBe(0);
  });

  it("falla si falta una ubicación, antes de escribir nada", async () => {
    await expect(
      importar({
        archivo,
        negocioId: negocioSinDeposito,
        cliente,
        rutaReporte: join(dir, "x.json"),
      }),
    ).rejects.toThrow(/Depósito/);
    expect(await contar("productos", { negocio_id: negocioSinDeposito })).toBe(0);
  });

  it("importa, concilia y es idempotente", async () => {
    const primera = await importar({
      archivo,
      negocioId,
      cliente,
      rutaReporte: join(dir, "1.json"),
    });
    expect(primera.escritura).toMatchObject({
      categoriasCreadas: 2,
      productosCreados: 4,
      productosYaExistian: 0,
      stockInicialCreado: 3,
    });
    expect(primera.conciliacion.filter((c) => !c.ok)).toEqual([]);
    expect(primera.rechazadasPorMotivo).toEqual({ codigo_repetido: 1, stock_decimal: 1 });
    expect(JSON.parse(readFileSync(join(dir, "1.json"), "utf8")).modo).toBe("real");

    const productos = await cliente
      .from("productos")
      .select("codigo, codigo_barras, nombre, marca, modelo")
      .eq("negocio_id", negocioId)
      .order("codigo");
    expect(productos.data).toEqual([
      { codigo: "001", codigo_barras: "0001234", nombre: "Taza azul", marca: null, modelo: null },
      { codigo: "002", codigo_barras: null, nombre: "Plato", marca: "Acme", modelo: null },
      { codigo: "003", codigo_barras: null, nombre: "Llanta", marca: null, modelo: "aro 20/29" },
      { codigo: "004", codigo_barras: null, nombre: "Sin stock", marca: null, modelo: null },
    ]);

    const stock = await cliente.from("stock").select("cantidad").eq("negocio_id", negocioId);
    expect(stock.data?.map((s) => Number(s.cantidad)).sort()).toEqual([2, 4, 6]);

    // Auditoría: los productos quedan registrados con usuario null (service_role no tiene auth.uid()).
    expect(primera.conciliacion.find((c) => c.control.startsWith("Productos auditados"))?.ok).toBe(
      true,
    );
    expect(
      await contar("auditoria", { negocio_id: negocioId, tabla: "productos", accion: "insert" }),
    ).toBe(4);

    const segunda = await importar({
      archivo,
      negocioId,
      cliente,
      rutaReporte: join(dir, "2.json"),
    });
    expect(segunda.escritura).toMatchObject({
      categoriasCreadas: 0,
      categoriasYaExistian: 2,
      productosCreados: 0,
      productosYaExistian: 4,
      stockInicialCreado: 0,
      stockInicialYaExistia: 3,
    });
    expect(segunda.conciliacion.filter((c) => !c.ok)).toEqual([]);
    expect(await contar("productos", { negocio_id: negocioId })).toBe(4);
    expect(await contar("movimientos_inventario", { negocio_id: negocioId })).toBe(3);
  });

  it("concilia solo lo de esta corrida: un producto previo del negocio no da DIF", async () => {
    const id = randomUUID();
    await crearNegocio(id, ["Tienda", "Depósito"]);
    const previo = await cliente
      .from("productos")
      .insert({ negocio_id: id, codigo: "PRE", nombre: "Previo", tipo: "producto", unidad: "unidad" })
      .select("id")
      .single();
    expect(previo.error).toBeNull();
    const ubic = await cliente.from("ubicaciones").select("id").eq("negocio_id", id).eq("nombre", "Tienda").single();
    const rpc = await cliente.rpc("registrar_stock_inicial", {
      p_negocio_id: id,
      p_items: [{ producto_id: previo.data?.id, ubicacion_id: ubic.data?.id, cantidad: 100 }],
    });
    expect(rpc.error).toBeNull();

    const reporte = await importar({
      archivo,
      negocioId: id,
      cliente,
      rutaReporte: join(dir, "previo.json"),
      esperadas: 6,
    });
    expect(reporte.conciliacion.filter((c) => !c.ok)).toEqual([]);
    expect(reporte.conciliacion.some((c) => c.control.startsWith("Aceptadas + rechazadas"))).toBe(
      true,
    );
  });

  it("reimportar con otra ubicación no duplica el stock inicial del producto", async () => {
    const id = randomUUID();
    await crearNegocio(id, ["Tienda", "Depósito"]);
    const f1 = join(dir, "u1.xlsx");
    const f2 = join(dir, "u2.xlsx");
    await crearXlsx(f1, [
      ["x"],
      ["x"],
      filaProducto({ codigo: "U1", nombre: "Uno", stock: 5, ubicacion: "tienda" }),
    ]);
    await crearXlsx(f2, [
      ["x"],
      ["x"],
      filaProducto({ codigo: "U1", nombre: "Uno", stock: 5, ubicacion: "deposito" }),
    ]);
    const a = await importar({ archivo: f1, negocioId: id, cliente, rutaReporte: join(dir, "a.json") });
    expect(a.escritura).toMatchObject({ stockInicialCreado: 1 });
    const b = await importar({ archivo: f2, negocioId: id, cliente, rutaReporte: join(dir, "b.json") });
    expect(b.escritura).toMatchObject({ stockInicialCreado: 0, stockInicialYaExistia: 1 });
    expect(await contar("movimientos_inventario", { negocio_id: id })).toBe(1);
  });

  it("service_role no inserta en el kardex directamente", async () => {
    const r = await cliente.from("movimientos_inventario").insert({
      negocio_id: negocioId,
      ubicacion_id: randomUUID(),
      producto_id: randomUUID(),
      tipo: "inicial",
      cantidad: 1,
    });
    expect(r.error?.code).toBe("42501");
  });
});
