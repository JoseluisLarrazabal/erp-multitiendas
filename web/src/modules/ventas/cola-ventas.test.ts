import "fake-indexeddb/auto";
import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encolar,
  leerFilas,
  marcarRechazada,
  reabrir,
  vaciar,
  type Enviador,
  type FilaCola,
} from "@/lib/offline/cola";
import { baseOffline } from "@/lib/offline/db";
import type { Database } from "@/lib/supabase/database.types";
import {
  cobrarEnCola,
  comprobarCuenta,
  MENSAJE_COBRO_FALLIDO,
  protegerCobro,
  enviarVentaDeCola,
  revisarDescarte,
} from "./cola-ventas";
import { leerSesion } from "@/lib/supabase/sesion";
import { MAX_NUMERO_DUPLICADO } from "./domain";
import type { payloadColaVentaSchema } from "./schemas";

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const venta: ReturnType<typeof payloadColaVentaSchema.parse>["venta"] = {
  id: uuid(1),
  dispositivo_id: uuid(2),
  caja_sesion_id: uuid(3),
  numero: "C1-000007",
  cliente_id: null,
  creada_en_cliente: "2026-11-01T10:00:00.000Z",
  descuento: 0,
  total: 25,
  items: [
    {
      producto_id: uuid(4),
      lista: "contado",
      cantidad: 1,
      precio_unitario: 25,
      descuento: 0,
      serie_id: null,
    },
  ],
  pagos: [{ medio: "efectivo", monto: 25 }],
};
const nuevaFila = {
  id: venta.id,
  tipo: "venta",
  negocioId: uuid(9),
  dispositivoId: uuid(2),
  usuarioId: uuid(5),
  payload: { venta, tipo_cambio: 6.96 },
  nota: { numero: "C1-000007" },
  numeroImpreso: "C1-000007",
};
const duplicado = { message: "ERP_NUMERO_DUPLICADO", code: "P0001" };

type Respuesta = { data: unknown; error: { message: string; code: string } | null };
type OpcionesCliente = {
  respuestas: Respuesta[];
  // false: sin sesión. "error": error de red de Auth. "invalida": Auth la rechaza. "cuelga": no responde.
  sesion?: boolean | "error" | "invalida" | "cuelga";
  existe?: boolean;
  // Si no existe la comprobación, falla con este error.
  falloExiste?: boolean;
  respuesta?: () => Promise<Respuesta>;
};
const getSession = (sesion: OpcionesCliente["sesion"]) => async () => {
  if (sesion === "cuelga") return new Promise<never>(() => undefined);
  if (sesion === "error")
    return { data: { session: null }, error: new AuthRetryableFetchError("fetch failed", 0) };
  if (sesion === "invalida")
    return { data: { session: null }, error: new AuthApiError("bad", 401, "bad_jwt") };
  return { data: { session: sesion === false ? null : { user: { id: uuid(5) } } }, error: null };
};
function cliente(opts: OpcionesCliente) {
  const llamadas: { p_venta: { numero: string }; p_offline?: unknown; p_orden?: unknown }[] = [];
  const funciones: string[] = [];
  const rpc = vi.fn((nombre: string, args: (typeof llamadas)[number]) => {
    funciones.push(nombre);
    llamadas.push(args);
    const r = opts.respuestas[Math.min(llamadas.length - 1, opts.respuestas.length - 1)]!;
    return { abortSignal: () => (opts.respuesta ? opts.respuesta() : Promise.resolve(r)) };
  });
  const supabase = {
    auth: { getSession: getSession(opts.sesion) },
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          abortSignal: () => ({
            maybeSingle: async () =>
              opts.falloExiste
                ? { data: null, error: { message: "fetch failed" } }
                : { data: opts.existe ? { id: venta.id } : null, error: null },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
  return { supabase, llamadas, funciones };
}
const exito: Respuesta = { data: { id: venta.id, numero: "C1-000007", total: 25 }, error: null };
const fila = (extra: Partial<FilaCola> = {}) => ({
  ...nuevaFila,
  intentos: 0,
  inesperados: 0,
  ...extra,
});

beforeEach(async () => {
  await baseOffline().cola.clear();
  await encolar(nuevaFila);
});
afterEach(() => vi.useRealTimers());

describe("enviarVentaDeCola", () => {
  it("el primer intento va sin p_offline y el reenvío con vendedor, tipo de cambio y número impreso", async () => {
    const a = cliente({ respuestas: [exito] });
    expect((await enviarVentaDeCola(fila(), a.supabase, true)).resultado.t).toBe("ok");
    expect(a.llamadas[0]).toEqual({ p_venta: venta });

    const b = cliente({ respuestas: [exito] });
    await enviarVentaDeCola(fila({ intentos: 1 }), b.supabase, false);
    expect(b.llamadas[0]).toEqual({
      p_venta: venta,
      p_offline: { vendedor_id: uuid(5), tipo_cambio: 6.96, numero_impreso: "C1-000007" },
    });
  });

  it("con orden llama a crear_orden con p_orden (y p_offline en el reenvío); sin orden, a registrar_venta", async () => {
    const orden = { express: true, prendas: 3, fecha_prometida: "2026-11-05", casillero: "A1" };
    const conOrden = fila({ payload: { venta, tipo_cambio: 6.96, orden } });
    const a = cliente({ respuestas: [exito] });
    await enviarVentaDeCola(conOrden, a.supabase, true);
    expect(a.funciones).toEqual(["crear_orden"]);
    expect(a.llamadas[0]).toEqual({ p_venta: venta, p_orden: orden });

    const b = cliente({ respuestas: [exito] });
    await enviarVentaDeCola({ ...conOrden, intentos: 1 }, b.supabase, false);
    expect(b.llamadas[0]).toMatchObject({ p_orden: orden, p_offline: { vendedor_id: uuid(5) } });

    const c = cliente({ respuestas: [exito] });
    await enviarVentaDeCola(fila(), c.supabase, true);
    expect(c.funciones).toEqual(["registrar_venta"]);
  });

  it("al renumerar una venta con orden, la orden se conserva en la fila", async () => {
    const orden = { express: false, prendas: 2, fecha_prometida: "2026-11-05" };
    await baseOffline().cola.clear();
    await encolar({ ...nuevaFila, payload: { venta, tipo_cambio: 6.96, orden } });
    const c = cliente({ respuestas: [{ data: null, error: duplicado }, exito] });
    await enviarVentaDeCola(
      fila({ payload: { venta, tipo_cambio: 6.96, orden } }),
      c.supabase,
      true,
    );
    expect(c.funciones).toEqual(["crear_orden", "crear_orden"]);
    const [guardada] = (await leerFilas()).filas;
    expect(guardada?.payload).toMatchObject({ orden, venta: { numero: "C1-000008" } });
  });

  it("sin sesión pausa sin llamar al servidor", async () => {
    const c = cliente({ respuestas: [exito], sesion: false });
    expect((await enviarVentaDeCola(fila(), c.supabase, false)).resultado).toEqual({ t: "pausa" });
    expect(c.llamadas).toHaveLength(0);
  });

  it("un fallo de red es red; un rechazo con código es rechazo con su código", async () => {
    const red = cliente({
      respuestas: [{ data: null, error: { message: "AbortError: x", code: "" } }],
    });
    expect((await enviarVentaDeCola(fila(), red.supabase, false)).resultado.t).toBe("red");
    const no = cliente({
      respuestas: [{ data: null, error: { message: "ERP_CAJA_CERRADA", code: "P0001" } }],
    });
    expect((await enviarVentaDeCola(fila(), no.supabase, true)).resultado).toMatchObject({
      t: "rechazo",
      codigo: "ERP_CAJA_CERRADA",
    });
  });

  it("número duplicado en un reenvío: renumera con el mismo id, conserva el número impreso y lo persiste", async () => {
    const c = cliente({ respuestas: [{ data: null, error: duplicado }, exito] });
    const r = await enviarVentaDeCola(fila({ intentos: 1 }), c.supabase, false);
    // intentos 1 = en duda: existeVenta dice que no, así que renumera.
    expect(r.resultado.t).toBe("ok");
    expect(r.numero).toBe("C1-000008");
    expect(c.llamadas.map((l) => l.p_venta.numero)).toEqual(["C1-000007", "C1-000008"]);
    expect(c.llamadas[1]).toMatchObject({ p_offline: { numero_impreso: "C1-000007" } });
    const [guardada] = (await leerFilas()).filas;
    expect(guardada).toMatchObject({ numeroImpreso: "C1-000007", nota: { numero: "C1-000007" } });
    expect(JSON.stringify(guardada?.payload)).toContain("C1-000008");
  });

  it("número duplicado en el primer intento: la nota y el número impreso siguen al nuevo número", async () => {
    const c = cliente({ respuestas: [{ data: null, error: duplicado }, exito] });
    await enviarVentaDeCola(fila(), c.supabase, true);
    const [guardada] = (await leerFilas()).filas;
    expect(guardada).toMatchObject({ numeroImpreso: "C1-000008", nota: { numero: "C1-000008" } });
  });

  it("en duda y número duplicado, si la venta ya existe es éxito: no renumera", async () => {
    const c = cliente({ respuestas: [{ data: null, error: duplicado }], existe: true });
    const r = await enviarVentaDeCola(fila({ intentos: 1 }), c.supabase, false);
    expect(r.resultado.t).toBe("ok");
    expect(c.llamadas).toHaveLength(1);
  });

  it("el tope de renumeraciones rechaza", async () => {
    const c = cliente({ respuestas: [{ data: null, error: duplicado }] });
    const r = await enviarVentaDeCola(fila(), c.supabase, false);
    expect(r.resultado).toMatchObject({ t: "rechazo", codigo: "ERP_NUMERO_DUPLICADO" });
    expect(c.llamadas).toHaveLength(MAX_NUMERO_DUPLICADO + 1);
  });

  it("un payload ilegible se rechaza sin tocar la fila", async () => {
    const c = cliente({ respuestas: [exito] });
    const r = await enviarVentaDeCola(fila({ payload: { venta: 1 } }), c.supabase, false);
    expect(r.resultado.t).toBe("rechazo");
    expect(c.llamadas).toHaveLength(0);
    expect((await leerFilas()).filas).toHaveLength(1);
  });
});

describe("errores sin código ERP_ y ERP_OPERACION_REPETIDA", () => {
  it.each(["PGRST000", "PGRST003", "40P01", "57014", "53300", "503"])(
    "el error %s es red, en el primer intento y en el reenvío",
    async (code) => {
      for (const primerIntento of [true, false]) {
        const c = cliente({ respuestas: [{ data: null, error: { message: "boom", code } }] });
        expect((await enviarVentaDeCola(fila(), c.supabase, primerIntento)).resultado.t).toBe(
          "red",
        );
      }
    },
  );

  it("un error sin código tras 5 errores con respuesta pasa a rechazo con mensaje claro; sin respuesta nunca", async () => {
    const roto = { data: null, error: { message: "boom", code: "PGRST000" } };
    const c = cliente({ respuestas: [roto] });
    expect((await enviarVentaDeCola(fila({ inesperados: 4 }), c.supabase, false)).resultado.t).toBe(
      "red",
    );
    const r = await enviarVentaDeCola(
      fila({ inesperados: 5 }),
      cliente({ respuestas: [roto], existe: false }).supabase,
      false,
    );
    expect(r.resultado).toMatchObject({ t: "rechazo", codigo: null });
    expect(r.resultado.t === "rechazo" && r.resultado.error).toContain("error inesperado");
    // Si la venta ya está en el servidor sigue siendo éxito.
    const existe = cliente({ respuestas: [roto], existe: true });
    expect(
      (await enviarVentaDeCola(fila({ intentos: 9, inesperados: 9 }), existe.supabase, false))
        .resultado.t,
    ).toBe("ok");
    // Sin respuesta (red real): siempre red.
    const sinRespuesta = cliente({
      respuestas: [{ data: null, error: { message: "AbortError", code: "" } }],
    });
    expect(
      (
        await enviarVentaDeCola(
          fila({ intentos: 50, inesperados: 50 }),
          sinRespuesta.supabase,
          false,
        )
      ).resultado.t,
    ).toBe("red");
  });

  it("ERP_OPERACION_REPETIDA con la venta ya en el servidor es éxito, aunque no esté en duda", async () => {
    const repetida = { data: null, error: { message: "ERP_OPERACION_REPETIDA", code: "P0001" } };
    const c = cliente({ respuestas: [repetida], existe: true });
    expect((await enviarVentaDeCola(fila(), c.supabase, false)).resultado.t).toBe("ok");
  });

  it("ERP_OPERACION_REPETIDA sin la venta en el servidor se rechaza, y si no se puede comprobar es red", async () => {
    const repetida = { data: null, error: { message: "ERP_OPERACION_REPETIDA", code: "P0001" } };
    const no = cliente({ respuestas: [repetida] });
    expect((await enviarVentaDeCola(fila(), no.supabase, false)).resultado).toMatchObject({
      t: "rechazo",
      codigo: "ERP_OPERACION_REPETIDA",
    });
    const falla = cliente({ respuestas: [repetida], falloExiste: true });
    expect((await enviarVentaDeCola(fila(), falla.supabase, false)).resultado.t).toBe("red");
  });
});

describe("sesión", () => {
  it("comprobarCuenta: la misma cuenta sigue; sin sesión o de otra cuenta rechaza; sin saber, es red", async () => {
    expect(await comprobarCuenta(cliente({ respuestas: [] }).supabase, uuid(5))).toBe("ok");
    expect(await comprobarCuenta(cliente({ respuestas: [] }).supabase, uuid(6))).toBe("rechazar");
    expect(
      await comprobarCuenta(cliente({ respuestas: [], sesion: false }).supabase, uuid(5)),
    ).toBe("rechazar");
    expect(
      await comprobarCuenta(cliente({ respuestas: [], sesion: "error" }).supabase, uuid(5)),
    ).toBe("red");
  });

  it("un error definitivo de Auth es sin sesión, no red", async () => {
    expect(await leerSesion(cliente({ respuestas: [], sesion: "invalida" }).supabase)).toBe(
      "ninguna",
    );
    expect(await leerSesion(cliente({ respuestas: [], sesion: "error" }).supabase)).toBe("red");
  });

  it("getSession que lanza o que no responde en 8 s es red", async () => {
    const lanza = cliente({ respuestas: [] }).supabase;
    lanza.auth.getSession = () => Promise.reject(new Error("x"));
    expect(await leerSesion(lanza)).toBe("red");

    vi.useFakeTimers();
    const cuelga = leerSesion(cliente({ respuestas: [], sesion: "cuelga" }).supabase);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await cuelga).toBe("red");
  });

  it("un reenvío sin poder leer la sesión o sin sesión es pausa sin sumar intentos ni llamar al servidor", async () => {
    const llamadas: number[] = [];
    for (const sesion of ["error", false, "invalida"] as const) {
      const c = cliente({ respuestas: [exito], sesion });
      expect((await enviarVentaDeCola(fila(), c.supabase, false)).resultado).toEqual({
        t: "pausa",
      });
      llamadas.push(c.llamadas.length);
    }
    expect(llamadas).toEqual([0, 0, 0]);
    // Pasa por el vaciado: la fila queda igual, sin intentos ni espera.
    const c = cliente({ respuestas: [exito], sesion: "error" });
    await vaciar({
      elegible: () => true,
      forzar: true,
      enviadores: { venta: async (f) => (await enviarVentaDeCola(f, c.supabase, false)).resultado },
    });
    expect((await leerFilas()).filas[0]).toMatchObject({ intentos: 0, proximoIntento: 0 });
  });
});

describe("cobrarEnCola", () => {
  const fijo = { ...nuevaFila, numeroImpreso: "C1-000007" };
  // La fila ya armada, con el número que sea; `seq` solo importa en las pruebas de numeración.
  const cobro = { id: venta.id, dispositivoId: uuid(2), ultimo: 6, armar: () => fijo };
  const conNumero = (n: number, seq: number) => {
    const numero = `C1-${String(seq).padStart(6, "0")}`;
    return {
      ...nuevaFila,
      id: uuid(100 + n),
      payload: { venta: { ...venta, id: uuid(100 + n), numero }, tipo_cambio: 6.96 },
      numeroImpreso: numero,
    };
  };
  beforeEach(async () => {
    await baseOffline().cola.clear();
  });

  it("primer intento lento con renumeración: el motor no envía la fila hasta que termina", async () => {
    let liberar!: () => void;
    const lenta = new Promise<void>((r) => (liberar = r));
    let n = 0;
    const c = cliente({
      respuestas: [exito],
      respuesta: async () => {
        n += 1;
        if (n === 1) return { data: null, error: duplicado };
        await lenta;
        return { data: { id: venta.id, numero: "C1-000008", total: 25 }, error: null };
      },
    });
    const cobrando = cobrarEnCola(cobro, c.supabase, true);
    await vi.waitFor(async () => expect((await leerFilas()).filas).toHaveLength(1));
    await vi.waitFor(() => expect(n).toBe(2)); // ya renumeró y espera la respuesta

    const enviador = vi.fn<Enviador>(async () => ({ t: "ok" }));
    await vaciar({ elegible: () => true, forzar: true, enviadores: { venta: enviador } });
    expect(enviador).not.toHaveBeenCalled();

    liberar();
    expect(await cobrando).toEqual({ t: "entregada", numero: "C1-000008", enviada: true });
    expect((await leerFilas()).filas).toHaveLength(0);
  });

  it("sin red: queda en la cola lista para el motor, sin intentos", async () => {
    const c = cliente({ respuestas: [exito] });
    expect(await cobrarEnCola(cobro, c.supabase, false)).toEqual({
      t: "entregada",
      numero: "C1-000007",
      enviada: false,
    });
    expect(c.llamadas).toHaveLength(0);
    expect((await leerFilas()).filas[0]).toMatchObject({
      intentos: 0,
      proximoIntento: 0,
      entregada: true,
    });
  });

  it("falla de red con red: queda con un intento y su espera; un rechazo se quita y se informa", async () => {
    const red = cliente({ respuestas: [{ data: null, error: { message: "x", code: "" } }] });
    expect(await cobrarEnCola(cobro, red.supabase, true)).toMatchObject({
      t: "entregada",
      enviada: false,
    });
    // La nota se entregó: ya no es un primer intento interrumpido.
    expect((await leerFilas()).filas[0]).toMatchObject({ intentos: 1, entregada: true });

    await baseOffline().cola.clear();
    const no = cliente({
      respuestas: [{ data: null, error: { message: "ERP_CAJA_CERRADA", code: "P0001" } }],
    });
    expect(await cobrarEnCola(cobro, no.supabase, true)).toMatchObject({
      t: "rechazada",
      codigo: "ERP_CAJA_CERRADA",
    });
    expect((await leerFilas()).filas).toHaveLength(0);
  });

  it("si no se puede quitar la venta rechazada, no se da por limpia: avisa y la frena", async () => {
    const no = cliente({
      respuestas: [{ data: null, error: { message: "ERP_CAJA_CERRADA", code: "P0001" } }],
    });
    const quitar = vi.spyOn(baseOffline().cola, "where").mockImplementation(((campo: string) => {
      const real = Object.getPrototypeOf(baseOffline().cola).where.call(baseOffline().cola, campo);
      return {
        equals: (v: string) => {
          const q = real.equals(v);
          return {
            ...q,
            delete: () => Promise.reject(new Error("IndexedDB")),
            modify: q.modify.bind(q),
            first: q.first.bind(q),
          };
        },
      };
    }) as never);
    const r = await cobrarEnCola(cobro, no.supabase, true);
    quitar.mockRestore();
    expect(r).toMatchObject({ t: "rechazada", codigo: null });
    expect(r.t === "rechazada" && r.error).toContain("Recarga la página");
    expect((await leerFilas()).filas[0]).toMatchObject({ estado: "rechazada" });
  });
  it("durante el primer intento la fila no está entregada; una pestaña muerta la deja así", async () => {
    let liberar!: () => void;
    const lenta = new Promise<void>((r) => (liberar = r));
    const c = cliente({
      respuestas: [exito],
      respuesta: async () => {
        await lenta;
        return exito;
      },
    });
    const cobrando = cobrarEnCola(cobro, c.supabase, true);
    await vi.waitFor(async () =>
      expect((await leerFilas()).filas[0]).toMatchObject({ entregada: false }),
    );
    liberar();
    await cobrando;
  });

  it("si el primer intento lanza tras renumerar, la nota lleva el número vigente", async () => {
    let n = 0;
    const c = cliente({
      respuestas: [exito],
      respuesta: async () => {
        n += 1;
        if (n === 1) return { data: null, error: duplicado };
        throw new Error("se cortó");
      },
    });
    expect(await cobrarEnCola(cobro, c.supabase, true)).toEqual({
      t: "entregada",
      numero: "C1-000008",
      enviada: false,
    });
  });

  it("dos confirmaciones simultáneas del mismo equipo reciben números distintos", async () => {
    const hechos = await Promise.all(
      [1, 2].map((n) =>
        cobrarEnCola(
          {
            id: uuid(100 + n),
            dispositivoId: uuid(2),
            ultimo: 6,
            armar: (seq) => conNumero(n, seq),
          },
          cliente({ respuestas: [exito] }).supabase,
          false,
        ),
      ),
    );
    const numeros = hechos.map((h) => (h.t === "entregada" ? h.numero : h.t));
    expect(new Set(numeros)).toEqual(new Set(["C1-000007", "C1-000008"]));
  });

  it("sin poder armar la venta no encola nada", async () => {
    const r = await cobrarEnCola(
      { ...cobro, armar: () => null },
      cliente({ respuestas: [] }).supabase,
      true,
    );
    expect(r).toEqual({ t: "no-armada" });
    expect((await leerFilas()).filas).toHaveLength(0);
  });
});

describe("revisarDescarte", () => {
  const revisar = (c: ReturnType<typeof cliente>, usuario = uuid(5), caducada = false) =>
    revisarDescarte(c.supabase, venta.id, usuario, caducada);
  beforeEach(async () => {
    await marcarRechazada(venta.id, "no");
  });

  it("si la venta ya está en el servidor la quita sin pedir más", async () => {
    expect(await revisar(cliente({ respuestas: [], existe: true }))).toEqual({ t: "quitada" });
    expect((await leerFilas()).filas).toHaveLength(0);
  });

  it("si no está, pide la confirmación escrita y no toca la fila", async () => {
    expect(await revisar(cliente({ respuestas: [] }))).toEqual({ t: "confirmar" });
    expect((await leerFilas()).filas).toHaveLength(1);
  });

  it("si no se puede comprobar (red o sin sesión) no descarta", async () => {
    for (const c of [
      cliente({ respuestas: [], falloExiste: true }),
      cliente({ respuestas: [], sesion: "error" }),
      cliente({ respuestas: [], sesion: false }),
    ])
      expect((await revisar(c)).t).toBe("error");
    expect((await leerFilas()).filas).toHaveLength(1);
  });

  it("con otra cuenta o la sesión caducada pide volver a entrar y nunca confirma, aunque la venta no exista", async () => {
    const otra = await revisar(cliente({ respuestas: [] }), uuid(6));
    const caducada = await revisar(cliente({ respuestas: [] }), uuid(5), true);
    for (const r of [otra, caducada])
      expect(r).toEqual({
        t: "error",
        mensaje: expect.stringContaining("Vuelve a entrar con tu cuenta para comprobarla"),
      });
  });

  it("si la fila se reabrió mientras se comprobaba, no la borra", async () => {
    await reabrir(venta.id);
    expect((await revisar(cliente({ respuestas: [], existe: true }))).t).toBe("error");
    expect((await leerFilas()).filas).toHaveLength(1);
  });
});

describe("protegerCobro", () => {
  it("una excepción inesperada devuelve el mensaje de cobro fallido; sin excepción, null", async () => {
    expect(await protegerCobro(async () => undefined)).toBeNull();
    expect(
      await protegerCobro(async () => {
        throw new Error("x");
      }),
    ).toBe(MENSAJE_COBRO_FALLIDO);
    expect(MENSAJE_COBRO_FALLIDO).toContain("Revisa la lista de ventas antes de cobrar de nuevo");
  });
});
