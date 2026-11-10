import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import type { PagoCuotaPayload } from "@/modules/creditos";
import {
  alcanceCuotas,
  cobrarCuota,
  cuotaSinConfirmar,
  cuotasSinConfirmar,
  fijarCuotaSinConfirmar,
  hayCuotasSinConfirmar,
} from "./cobro-cuota";

const payload: PagoCuotaPayload = {
  id: "a0000000-0000-4000-8000-000000000001",
  credito_id: "a0000000-0000-4000-8000-000000000002",
  dispositivo_id: "a0000000-0000-4000-8000-000000000003",
  caja_sesion_id: "a0000000-0000-4000-8000-000000000004",
  efectivo: 10,
  qr: 0,
};
type Resp = { data: unknown; error: { message: string; code?: string } | null };
const ok: Resp = { data: { id: payload.id, saldo: 5 }, error: null };
const caida: Resp = { data: null, error: { message: "fetch failed" } };
const excede: Resp = { data: null, error: { message: "ERP_PAGO_EXCEDE_SALDO", code: "P0001" } };

function cliente(respuestas: Resp[], existe = false) {
  const llamadas: unknown[] = [];
  const supabase = {
    rpc: vi.fn((_fn: string, args: unknown) => {
      llamadas.push(args);
      const r = respuestas[Math.min(llamadas.length - 1, respuestas.length - 1)]!;
      return { abortSignal: () => Promise.resolve(r) };
    }),
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => ({
            abortSignal: () => Promise.resolve({ data: existe ? [{ id: "x" }] : [], error: null }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
  return { supabase, llamadas };
}
const sinEspera = () => Promise.resolve();

describe("cobrarCuota (sin cola offline)", () => {
  it("cobra directo y devuelve ok", async () => {
    const c = cliente([ok]);
    expect(
      await cobrarCuota(c.supabase, payload, { alVerificar: vi.fn(), esperar: sinEspera }),
    ).toEqual({ t: "ok" });
    expect(c.llamadas).toEqual([{ p_pago: payload }]);
  });
  it("un rechazo del servidor es definitivo y no se reintenta", async () => {
    const c = cliente([excede]);
    const s = await cobrarCuota(c.supabase, payload, { alVerificar: vi.fn(), esperar: sinEspera });
    expect(s).toMatchObject({ t: "rechazada", codigo: "ERP_PAGO_EXCEDE_SALDO" });
    expect(c.llamadas).toHaveLength(1);
  });
  it("sin respuesta reintenta el MISMO payload y avisa que verifica", async () => {
    const alVerificar = vi.fn();
    const c = cliente([caida, caida, ok]);
    expect(await cobrarCuota(c.supabase, payload, { alVerificar, esperar: sinEspera })).toEqual({
      t: "ok",
    });
    expect(alVerificar).toHaveBeenCalledTimes(2);
    expect(new Set(c.llamadas.map((a) => JSON.stringify(a))).size).toBe(1);
  });
  it("tras agotar los reintentos comprueba si el pago quedó registrado", async () => {
    const quedo = await cobrarCuota(cliente([caida], true).supabase, payload, {
      alVerificar: vi.fn(),
      esperar: sinEspera,
    });
    expect(quedo).toEqual({ t: "ok" });
    const c = cliente([caida], false);
    const no = await cobrarCuota(c.supabase, payload, { alVerificar: vi.fn(), esperar: sinEspera });
    expect(no).toEqual({ t: "sin-confirmar" });
    expect(c.llamadas).toHaveLength(4);
  });
});

const A = alcanceCuotas("n", "e", "u");
describe("cobros de cuota sin confirmar (sobreviven a recargar)", () => {
  function sesion() {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    });
    return m;
  }
  it("se guardan con su payload e id, se leen validados y se borran", () => {
    sesion();
    expect(hayCuotasSinConfirmar(A)).toBe(false);
    fijarCuotaSinConfirmar(A, payload.credito_id, {
      payload,
      cliente: "Ana",
      detalle: "venta W2-000001",
    });
    expect(hayCuotasSinConfirmar(A)).toBe(true);
    expect(cuotaSinConfirmar(A, payload.credito_id)?.payload).toEqual(payload);
    expect(cuotasSinConfirmar(A).map((p) => p.cliente)).toEqual(["Ana"]);
    // Otro equipo o usuario no ve ni se bloquea por esta entrada.
    expect(cuotasSinConfirmar(alcanceCuotas("n", "otro-equipo", "u"))).toEqual([]);
    expect(hayCuotasSinConfirmar(alcanceCuotas("n", "e", "otro-usuario"))).toBe(false);
    fijarCuotaSinConfirmar(A, payload.credito_id, null);
    expect(hayCuotasSinConfirmar(A)).toBe(false);
  });
  it("ignora entradas dañadas o con otro formato", () => {
    const m = sesion();
    m.set(A, JSON.stringify({ x: { payload: { id: "no" }, cliente: "A", detalle: "d" } }));
    expect(cuotasSinConfirmar(A)).toEqual([]);
    m.set(A, "{no es json");
    expect(hayCuotasSinConfirmar(A)).toBe(false);
  });
});
