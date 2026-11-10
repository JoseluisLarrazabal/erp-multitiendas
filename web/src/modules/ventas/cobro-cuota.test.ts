import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import type { PagoCuotaPayload } from "@/modules/creditos";
import {
  alcanceCuotas,
  cobrarCuota,
  cuotaSinConfirmar,
  esCuotaRepetida,
  cuotasSinConfirmar,
  fijarCuotaSinConfirmar,
  hayCuotasSinConfirmar,
  puedeDescartarCuota,
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

const A = alcanceCuotas("n", "e");
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
    // Otro equipo o negocio no ve ni se bloquea por esta entrada (el usuario no entra en la clave).
    expect(cuotasSinConfirmar(alcanceCuotas("n", "otro-equipo"))).toEqual([]);
    expect(hayCuotasSinConfirmar(alcanceCuotas("otro-negocio", "e"))).toBe(false);
    fijarCuotaSinConfirmar(A, payload.credito_id, null, payload.id);
    expect(hayCuotasSinConfirmar(A)).toBe(false);
  });
  it("fijar devuelve true al guardar y false si no hay forma de escribir: ahí no se envía", () => {
    sesion();
    const p = { payload, cliente: "Ana", detalle: "d" };
    expect(fijarCuotaSinConfirmar(A, payload.credito_id, p)).toBe(true);
    expect(cuotaSinConfirmar(A, payload.credito_id)?.payload.id).toBe(payload.id);
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(fijarCuotaSinConfirmar(A, payload.credito_id, p)).toBe(false);
  });
  it("no pisa ni borra la entrada de otro cobro", () => {
    sesion();
    const mia = { payload, cliente: "Ana", detalle: "d" };
    const otra = { ...mia, payload: { ...payload, id: "a0000000-0000-4000-8000-000000000009" } };
    expect(fijarCuotaSinConfirmar(A, payload.credito_id, mia)).toBe(true);
    // Otra pestaña no pisa mi entrada con un cobro distinto del mismo crédito.
    expect(fijarCuotaSinConfirmar(A, payload.credito_id, otra)).toBe(false);
    expect(cuotaSinConfirmar(A, payload.credito_id)?.payload.id).toBe(payload.id);
    // Ni la borra creyendo tener otro id (ni sin id).
    expect(fijarCuotaSinConfirmar(A, payload.credito_id, null, otra.payload.id)).toBe(true);
    expect(fijarCuotaSinConfirmar(A, payload.credito_id, null)).toBe(true);
    expect(cuotaSinConfirmar(A, payload.credito_id)?.payload.id).toBe(payload.id);
    // Con su propio id sí se borra.
    fijarCuotaSinConfirmar(A, payload.credito_id, null, payload.id);
    expect(hayCuotasSinConfirmar(A)).toBe(false);
  });
  it("no se descarta antes de 60 s desde el último envío; sin fecha (entrada antigua) sí", () => {
    const base = { payload, cliente: "Ana", detalle: "d" };
    const t0 = Date.parse("2026-01-01T00:00:00Z");
    const g = { ...base, guardadoEn: "2026-01-01T00:00:00Z" };
    expect(puedeDescartarCuota(g, t0 + 59_999)).toBe(false);
    expect(puedeDescartarCuota(g, t0 + 60_000)).toBe(true);
    expect(puedeDescartarCuota(base, t0)).toBe(true);
  });
  it("guardadoEn se conserva al leer y es opcional", () => {
    const m = sesion();
    fijarCuotaSinConfirmar(A, payload.credito_id, {
      payload,
      cliente: "Ana",
      detalle: "d",
      guardadoEn: "2026-01-01T00:00:00Z",
    });
    expect(cuotaSinConfirmar(A, payload.credito_id)?.guardadoEn).toBe("2026-01-01T00:00:00Z");
    m.set(A, JSON.stringify({ [payload.credito_id]: { payload, cliente: "A", detalle: "d" } }));
    expect(cuotaSinConfirmar(A, payload.credito_id)?.guardadoEn).toBeUndefined();
  });
  it("ignora entradas dañadas o con otro formato", () => {
    const m = sesion();
    m.set(A, JSON.stringify({ x: { payload: { id: "no" }, cliente: "A", detalle: "d" } }));
    expect(cuotasSinConfirmar(A)).toEqual([]);
    m.set(A, "{no es json");
    expect(hayCuotasSinConfirmar(A)).toBe(false);
  });
});

describe("esCuotaRepetida", () => {
  it("solo ERP_OPERACION_REPETIDA cuenta como ya registrada", () => {
    expect(esCuotaRepetida("ERP_OPERACION_REPETIDA")).toBe(true);
    expect(esCuotaRepetida("ERP_PAGO_EXCEDE_SALDO")).toBe(false);
    expect(esCuotaRepetida(null)).toBe(false);
  });
});
