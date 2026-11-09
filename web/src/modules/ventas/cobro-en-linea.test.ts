import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { cobrarEnLinea } from "./cobro-en-linea";
import type { VentaPayload } from "./schemas";

const id = "a0000000-0000-4000-8000-000000000001";
const armar = (seq: number): VentaPayload => ({
  id,
  dispositivo_id: "a0000000-0000-4000-8000-000000000002",
  caja_sesion_id: "a0000000-0000-4000-8000-000000000003",
  numero: `C1-${String(seq).padStart(6, "0")}`,
  cliente_id: null,
  reserva_id: "a0000000-0000-4000-8000-000000000004",
  creada_en_cliente: "2026-11-08T10:00:00.000Z",
  descuento: 0,
  total: 90,
  items: [
    {
      producto_id: "a0000000-0000-4000-8000-000000000005",
      lista: "contado",
      cantidad: 2,
      precio_unitario: 45,
      descuento: 0,
      serie_id: null,
    },
  ],
  pagos: [
    { medio: "anticipo", monto: 30 },
    { medio: "efectivo", monto: 60 },
  ],
});
type Resp = { data: unknown; error: { message: string; code?: string } | null };
const ok = (numero: string): Resp => ({ data: { id, numero, total: 90 }, error: null });
const caida: Resp = { data: null, error: { message: "fetch failed" } };
const duplicado: Resp = { data: null, error: { message: "ERP_NUMERO_DUPLICADO", code: "P0001" } };
const rechazo: Resp = { data: null, error: { message: "ERP_RESERVA_NO_ACTIVA", code: "P0001" } };

function cliente(respuestas: Resp[], existe = false) {
  const llamadas: { fn: string; args: unknown }[] = [];
  const supabase = {
    rpc: vi.fn((fn: string, args: unknown) => {
      llamadas.push({ fn, args });
      const r = respuestas[Math.min(llamadas.length - 1, respuestas.length - 1)]!;
      return { abortSignal: () => Promise.resolve(r) };
    }),
    from: () => ({
      select: () => ({
        eq: () => ({
          abortSignal: () => ({
            maybeSingle: async () => ({ data: existe ? { id } : null, error: null }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
  return { supabase, llamadas };
}
const base = (alVerificar = vi.fn()) => ({
  armar,
  primerNumero: 7,
  alVerificar,
  esperar: async () => undefined,
  mayorEnCola: async () => 0,
});

describe("cobrarEnLinea (reserva o crédito, sin cola offline)", () => {
  it("envía directo y en línea: registrar_venta sin p_offline", async () => {
    const c = cliente([ok("C1-000007")]);
    const s = await cobrarEnLinea(c.supabase, base());
    expect(s).toMatchObject({ t: "ok", numero: "C1-000007" });
    expect(c.llamadas).toHaveLength(1);
    expect(c.llamadas[0]).toMatchObject({ fn: "registrar_venta" });
    expect(c.llamadas[0]!.args).not.toHaveProperty("p_offline");
  });

  it("ante caída avisa, reintenta en memoria el mismo payload y confirma", async () => {
    const c = cliente([caida, caida, ok("C1-000007")]);
    const alVerificar = vi.fn();
    const s = await cobrarEnLinea(c.supabase, base(alVerificar));
    expect(s.t).toBe("ok");
    expect(alVerificar).toHaveBeenCalled();
    expect(c.llamadas).toHaveLength(3);
    expect(c.llamadas[0]!.args).toEqual(c.llamadas[2]!.args);
  });

  it("sin respuesta y sin venta en el servidor: sin confirmar, conserva el payload", async () => {
    const c = cliente([caida]);
    const s = await cobrarEnLinea(c.supabase, base());
    expect(s.t).toBe("sin-confirmar");
    expect(s.t === "sin-confirmar" && s.payload.numero).toBe("C1-000007");
  });

  it("sin respuesta pero la venta ya existe: confirmada", async () => {
    const c = cliente([caida], true);
    expect(await cobrarEnLinea(c.supabase, base())).toMatchObject({ t: "ok", numero: "C1-000007" });
  });

  it("un reintento manual reenvía el payload previo idéntico", async () => {
    const c = cliente([ok("C1-000007")]);
    const previo = armar(7);
    const armarFalla = vi.fn(armar);
    await cobrarEnLinea(c.supabase, { ...base(), previo, armar: armarFalla });
    expect(armarFalla).not.toHaveBeenCalled();
    expect(c.llamadas[0]!.args).toEqual({ p_venta: previo });
  });

  it("un rechazo con código es definitivo; el número duplicado pasa al siguiente", async () => {
    const r = await cobrarEnLinea(cliente([rechazo]).supabase, base());
    expect(r).toMatchObject({ t: "rechazada", codigo: "ERP_RESERVA_NO_ACTIVA" });
    const c = cliente([duplicado, ok("C1-000008")]);
    const d = await cobrarEnLinea(c.supabase, base());
    expect(d).toMatchObject({ t: "ok", numero: "C1-000008" });
    expect(c.llamadas).toHaveLength(2);
  });
});

describe("cobrarEnLinea con una venta a crédito", () => {
  const credito: VentaPayload = {
    ...armar(7),
    reserva_id: undefined,
    cliente_id: "a0000000-0000-4000-8000-000000000009",
    condicion: "credito",
    credito: { cuotas: 3, docs_ci: true, docs_domicilio: true, docs_pagare: true },
    items: [{ ...armar(7).items[0]!, lista: "credito" }],
    pagos: [{ medio: "efectivo", monto: 45 }],
  };
  it("sin respuesta reintenta idéntico y sin confirmar conserva el payload (mismo id y número)", async () => {
    const c = cliente([caida], false);
    const s = await cobrarEnLinea(c.supabase, { ...base(), armar: () => credito });
    expect(s).toMatchObject({ t: "sin-confirmar" });
    expect(
      c.llamadas.every((l) => JSON.stringify(l.args) === JSON.stringify(c.llamadas[0]!.args)),
    ).toBe(true);
    if (s.t === "sin-confirmar") expect(s.payload).toEqual(credito);
  });
  it("un rechazo del servidor no se reintenta", async () => {
    const c = cliente([
      { data: null, error: { message: "ERP_INICIAL_INSUFICIENTE", code: "P0001" } },
    ]);
    const s = await cobrarEnLinea(c.supabase, { ...base(), armar: () => credito });
    expect(s).toMatchObject({ t: "rechazada", codigo: "ERP_INICIAL_INSUFICIENTE" });
    expect(c.llamadas).toHaveLength(1);
  });
});
