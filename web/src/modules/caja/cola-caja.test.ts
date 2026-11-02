import "fake-indexeddb/auto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leerFilas, type FilaCola } from "@/lib/offline/cola";
import { baseOffline } from "@/lib/offline/db";
import type { Database } from "@/lib/supabase/database.types";
import {
  aperturaEnCola,
  describirOperacionCaja,
  encolarApertura,
  encolarMovimiento,
  enviarAperturaDeCola,
  hayAperturaEnCola,
  enviarMovimientoDeCola,
  movimientosDeSesion,
} from "./cola-caja";

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ctx = { negocioId: uuid(1), dispositivoId: uuid(2), usuarioId: uuid(3) };

function cliente(error: { message: string; code?: string } | null) {
  const rpc = vi.fn(() => ({ abortSignal: () => Promise.resolve({ error }) }));
  return {
    rpc,
    supabase: {
      rpc,
      auth: {
        getSession: async () => ({ data: { session: { user: { id: uuid(3) } } }, error: null }),
      },
    } as unknown as SupabaseClient<Database>,
  };
}
const primera = async (): Promise<FilaCola> => {
  const f = (await leerFilas()).filas[0];
  if (!f) throw new Error("sin fila");
  return f;
};

beforeEach(async () => {
  await baseOffline().cola.clear();
});

describe("apertura y movimientos en la cola", () => {
  it("la apertura usa su UUID como caja local y se envía con p_offline", async () => {
    const s = await encolarApertura({ ...ctx, id: uuid(10), montoInicial: 100 });
    expect(s.id).toBe(uuid(10));
    expect((await aperturaEnCola(ctx.dispositivoId))?.id).toBe(uuid(10));
    expect(await aperturaEnCola(uuid(99))).toBeNull();
    // La caja local es una apertura aún en la cola: lo que dependa de ella no puede viajar en línea.
    expect(await hayAperturaEnCola(ctx.dispositivoId)).toBe(true);
    expect(await hayAperturaEnCola(uuid(99))).toBe(false);
    const { rpc, supabase } = cliente(null);
    expect(await enviarAperturaDeCola(await primera(), supabase)).toEqual({ t: "ok" });
    expect(rpc).toHaveBeenCalledWith(
      "abrir_caja",
      expect.objectContaining({
        p_id: uuid(10),
        p_offline: { creada_en: expect.any(String), usuario_id: ctx.usuarioId },
      }),
    );
  });

  it("ERP_CAJA_ABIERTA al sincronizar es un rechazo visible", async () => {
    await encolarApertura({ ...ctx, id: uuid(10), montoInicial: 100 });
    const { supabase } = cliente({ message: "ERP_CAJA_ABIERTA", code: "P0001" });
    const r = await enviarAperturaDeCola(await primera(), supabase);
    expect(r).toMatchObject({ t: "rechazo", codigo: "ERP_CAJA_ABIERTA" });
  });

  it("un fallo de transporte es red y no rechazo", async () => {
    await encolarApertura({ ...ctx, id: uuid(10), montoInicial: 100 });
    const { supabase } = cliente({ message: "Failed to fetch" });
    expect((await enviarAperturaDeCola(await primera(), supabase)).t).toBe("red");
  });

  it("el movimiento manda p_offline y se agrupa por sesión", async () => {
    await encolarMovimiento({
      ...ctx,
      id: uuid(20),
      sesion_id: uuid(10),
      tipo: "gasto",
      monto: 25,
      motivo: "Bolsas",
    });
    const fila = await primera();
    const { rpc, supabase } = cliente(null);
    expect(await enviarMovimientoDeCola(fila, supabase)).toEqual({ t: "ok" });
    expect(rpc).toHaveBeenCalledWith(
      "registrar_movimiento_caja",
      expect.objectContaining({ p_id: uuid(20), p_tipo: "gasto", p_offline: expect.any(Object) }),
    );
    const { filas } = await leerFilas();
    expect(movimientosDeSesion(filas, uuid(10))).toHaveLength(1);
    expect(movimientosDeSesion(filas, uuid(11))).toHaveLength(0);
    expect(describirOperacionCaja(fila)).toEqual({ titulo: "Gasto: Bolsas", total: 25 });
  });
});
