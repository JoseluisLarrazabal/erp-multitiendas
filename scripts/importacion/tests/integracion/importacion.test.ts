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

beforeAll(async () => {
  for (const [id, nombres] of [
    [negocioId, ["Tienda", "Depósito"]],
    [negocioSinDeposito, ["Tienda"]],
  ] as const) {
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
});
