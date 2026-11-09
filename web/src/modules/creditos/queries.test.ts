import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { cargarClientesConSaldo } from "./queries";

const fila = (n: number, total: number) => ({
  credito_id: `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  cliente_id: `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  cliente_nombre: `Cliente ${n}`,
  cliente_documento: null,
  origen: "venta",
  venta_numero: null,
  creado_en: "2026-11-01T00:00:00Z",
  total: 10,
  pagado: 0,
  saldo: 10,
  cuotas_vencidas: 0,
  monto_vencido: 0,
  dias_atraso: 0,
  proxima_vence: null,
  proxima_monto: null,
  total_filas: total,
});

// 7 clientes, de a 3 por página: 3 páginas; la 3.ª trae 1.
function servidor() {
  const pedidos: number[] = [];
  const supabase = {
    rpc: (_fn: string, args: { p_offset: number; p_limite: number }) => {
      pedidos.push(args.p_offset);
      const filas = Array.from({ length: 7 }, (_, i) => i)
        .slice(args.p_offset, args.p_offset + args.p_limite)
        .map((i) => fila(i + 1, 7));
      return { abortSignal: () => Promise.resolve({ data: filas, error: null }) };
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, pedidos };
}

describe("cargarClientesConSaldo", () => {
  it("una página válida se pide una vez", async () => {
    const s = servidor();
    const r = await cargarClientesConSaldo(s.supabase, "n", 2, 3);
    expect(r.ok && [r.data.pagina, r.data.total, r.data.cuentas.length]).toEqual([2, 7, 3]);
    expect(s.pedidos).toEqual([3]);
  });
  it("una página pasada la última vuelve a la última válida con su total", async () => {
    const s = servidor();
    const r = await cargarClientesConSaldo(s.supabase, "n", 9, 3);
    expect(r.ok && [r.data.pagina, r.data.total, r.data.cuentas.length]).toEqual([3, 7, 1]);
    expect(s.pedidos).toEqual([24, 0, 6]);
  });
});
