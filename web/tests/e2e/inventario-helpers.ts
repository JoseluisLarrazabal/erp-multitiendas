import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { apiComo, NEGOCIOS } from "./helpers";

// Datos de las pruebas de inventario: cada prueba crea sus productos por PostgREST con la sesión guardada del dueño
// (código, nombre y barras únicos por corrida), sin logins nuevos.
export const corrida = Date.now().toString(36).toUpperCase();
const marca = String(Date.now() % 1e8).padStart(8, "0");
let contador = 0;
export const tienda = NEGOCIOS.tienda.id;

export type Producto = { id: string; codigo: string; nombre: string; barras: string };

export async function crearProducto(
  extra: { stockMinimo?: number; unidad?: "unidad" | "kg" } = {},
) {
  contador += 1;
  const n = `${corrida}${contador}`;
  const barras = `8${marca}${String(contador).padStart(4, "0")}`;
  const p = { codigo: `INV-${n}`, nombre: `Producto INV ${n}`, barras };
  const r = await apiComo("dueno", "rpc/guardar_producto", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: tienda,
      p_datos: {
        codigo: p.codigo,
        codigo_barras: barras,
        nombre: p.nombre,
        tipo: "producto",
        unidad: extra.unidad ?? "unidad",
        stock_minimo: extra.stockMinimo ?? null,
      },
    },
  });
  expect(r.status).toBeLessThan(300);
  return { ...p, id: r.json as string } satisfies Producto;
}

export async function ubicaciones() {
  const r = await apiComo("dueno", `ubicaciones?select=id,nombre&negocio_id=eq.${tienda}`);
  const filas = r.json as { id: string; nombre: string }[];
  return {
    tienda: filas.find((u) => u.nombre === "Tienda")!.id,
    deposito: filas.find((u) => u.nombre === "Depósito")!.id,
  };
}

export async function entradaApi(
  p: Producto,
  ubicacionId: string,
  cantidad: number,
  costo: number | null = null,
  operacionId: string = randomUUID(),
) {
  return apiComo("dueno", "rpc/registrar_entrada", {
    metodo: "POST",
    cuerpo: {
      p_operacion_id: operacionId,
      p_negocio_id: tienda,
      p_producto_id: p.id,
      p_ubicacion_id: ubicacionId,
      p_cantidad: cantidad,
      p_costo_unitario: costo,
      p_motivo: null,
    },
  });
}

export const fila = (page: Page, p: Producto) =>
  page
    .getByRole("list", { name: "Stock por producto" })
    .getByRole("listitem")
    .filter({ hasText: p.nombre });
