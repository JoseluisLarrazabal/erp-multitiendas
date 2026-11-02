import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { listarReconciliacion } from "./lecturas-panel";

const uuid = (n: number) => `a0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const fila = (n: number, pagos: unknown = []) => ({
  id: uuid(n),
  numero: `V-${n}`,
  creada_en_cliente: "2026-11-01T10:00:00Z",
  recibida_en: "2026-11-01T11:00:00Z",
  total: 10,
  vendedor_id: null,
  vendedor_nombre: null,
  enviada_por: null,
  enviada_por_nombre: null,
  motivos_revision: ["stock_negativo"],
  pagos_pendientes: pagos,
});

// Cliente mínimo: rpc devuelve las filas; ventas.select().in() no marca ninguna como revisada.
function cliente(filas: unknown[]) {
  const llamadas: unknown[] = [];
  const supabase = {
    rpc: (_nombre: string, args: unknown) => {
      llamadas.push(args);
      return Promise.resolve({ data: filas, error: null });
    },
    from: () => ({
      select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
    }),
  } as unknown as SupabaseClient<Database>;
  return { supabase, llamadas };
}

describe("listarReconciliacion", () => {
  it("exactamente porPagina filas: no hay siguiente y pide una de más", async () => {
    const { supabase, llamadas } = cliente([fila(1), fila(2)]);
    const r = await listarReconciliacion(supabase, "n", null, 2);
    expect(r.ok && r.data.filas.map((f) => f.id)).toEqual([uuid(1), uuid(2)]);
    expect(r.ok && r.data.siguiente).toBeNull();
    expect(llamadas[0]).toMatchObject({ p_limite: 3 });
  });

  it("porPagina + 1 filas: recorta y el cursor es la última fila mostrada", async () => {
    const { supabase } = cliente([fila(1), fila(2), fila(3)]);
    const r = await listarReconciliacion(supabase, "n", null, 2);
    expect(r.ok && r.data.filas).toHaveLength(2);
    expect(r.ok && r.data.siguiente).toBe(uuid(2));
  });

  it("sin filas: ok y vacío", async () => {
    const { supabase } = cliente([]);
    const r = await listarReconciliacion(supabase, "n", null, 2);
    expect(r).toEqual({ ok: true, data: { filas: [], siguiente: null } });
  });

  it("pagos_pendientes mal formado: falla", async () => {
    const { supabase } = cliente([fila(1, [{ id: "no-es-uuid", monto: "x" }])]);
    const r = await listarReconciliacion(supabase, "n", null, 2);
    expect(r.ok).toBe(false);
  });
});
