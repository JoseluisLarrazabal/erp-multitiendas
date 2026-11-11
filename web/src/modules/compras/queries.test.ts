import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { resumenDeudaProveedores } from "./queries";

const cliente = (resp: { data: unknown; error: unknown }) =>
  ({ rpc: async () => resp }) as unknown as SupabaseClient<Database>;
const fila = (deuda: number) => ({ deuda, proveedor_id: "p", total_compras: 0, total_pagos: 0 });

describe("resumenDeudaProveedores", () => {
  it("solo cuentan las deudas mayores a 0", async () => {
    const r = await resumenDeudaProveedores(
      cliente({ data: [fila(100.5), fila(0), fila(-20), fila(50)], error: null }),
      "n",
    );
    expect(r).toEqual({ ok: true, data: { proveedores: 2, total: 150.5 } });
  });
  it("sin deudas queda en 0 y 0", async () => {
    const r = await resumenDeudaProveedores(cliente({ data: [fila(0)], error: null }), "n");
    expect(r).toEqual({ ok: true, data: { proveedores: 0, total: 0 } });
  });
  it("un error de la RPC no se calla", async () => {
    const r = await resumenDeudaProveedores(cliente({ data: null, error: { message: "x" } }), "n");
    expect(r.ok).toBe(false);
  });
});
