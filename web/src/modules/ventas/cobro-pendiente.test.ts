import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alcanceCobros,
  fijarCobroPendiente,
  leerCobrosPendientes,
  montosCongelados,
  type PendienteEnLinea,
} from "./cobro-pendiente";
import type { VentaPayload } from "./schemas";
import type { NotaVenta } from "./venta";

const payload: VentaPayload = {
  id: "a0000000-0000-4000-8000-000000000001",
  dispositivo_id: "a0000000-0000-4000-8000-000000000002",
  caja_sesion_id: "a0000000-0000-4000-8000-000000000003",
  numero: "C1-000007",
  cliente_id: null,
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
  pagos: [{ medio: "efectivo", monto: 90 }],
};
const nota = {
  numero: "C1-000007",
  fechaIso: "2026-11-08T10:00:00.000Z",
  vendedor: "Ana",
  negocio: { nombre: "Tienda", nit: null, datosNota: null },
  cliente: null,
  lineas: [],
} as unknown as NotaVenta;
const pendiente: PendienteEnLinea = { payload, nota, guardadoEn: "2026-11-08T10:00:01.000Z" };
const A = alcanceCobros("n", "e");

function almacen() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}
afterEach(() => vi.unstubAllGlobals());

describe("montosCongelados", () => {
  it("no hay montos fijos mientras el envío está en vuelo; sí tras fallar o si se rehidrató", () => {
    expect(montosCongelados(pendiente, { t: "enviando" })).toBeUndefined();
    expect(montosCongelados(undefined, { t: "libre" })).toBeUndefined();
    expect(montosCongelados(pendiente, { t: "rechazada" })).toEqual({ efectivo: 9000, qr: 0 });
    expect(montosCongelados(pendiente, { t: "libre" })).toEqual({ efectivo: 9000, qr: 0 });
  });
});

describe("cobros en línea pendientes (sobreviven a recargar)", () => {
  it("se guardan, se leen validados y se borran", () => {
    const m = almacen();
    expect(leerCobrosPendientes(A)).toEqual({});
    expect(fijarCobroPendiente(A, "credito", pendiente)).toBe(true);
    expect(leerCobrosPendientes(A)).toEqual({ credito: pendiente });
    expect(fijarCobroPendiente(A, "reserva-1", pendiente)).toBe(true);
    expect(Object.keys(leerCobrosPendientes(A))).toEqual(["credito", "reserva-1"]);
    fijarCobroPendiente(A, "credito", null, payload.id);
    fijarCobroPendiente(A, "reserva-1", null, payload.id);
    expect(leerCobrosPendientes(A)).toEqual({});
    expect(m.size).toBe(0);
  });
  it("descarta entradas inválidas y devuelve vacío ante JSON roto", () => {
    const m = almacen();
    m.set(
      A,
      JSON.stringify({ malo: { payload: { id: "no" }, nota, guardadoEn: "x" }, ok: pendiente }),
    );
    expect(Object.keys(leerCobrosPendientes(A))).toEqual(["ok"]);
    m.set(A, "{no es json");
    expect(leerCobrosPendientes(A)).toEqual({});
  });
  it("si setItem lanza, fijar devuelve false", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    });
    expect(fijarCobroPendiente(A, "credito", pendiente)).toBe(false);
  });
  it("no pisa ni borra la entrada de otro cobro; sí reescribe el mismo (renumerar conserva el id)", () => {
    almacen();
    const otro: PendienteEnLinea = {
      ...pendiente,
      payload: { ...payload, id: "a0000000-0000-4000-8000-0000000000ff" },
    };
    expect(fijarCobroPendiente(A, "credito", pendiente)).toBe(true);
    expect(fijarCobroPendiente(A, "credito", otro)).toBe(false);
    expect(fijarCobroPendiente(A, "credito", null, otro.payload.id)).toBe(true);
    expect(fijarCobroPendiente(A, "credito", null)).toBe(true);
    expect(leerCobrosPendientes(A).credito?.payload.id).toBe(payload.id);
    const renumerado = { ...pendiente, payload: { ...payload, numero: "C1-000008" } };
    expect(fijarCobroPendiente(A, "credito", renumerado)).toBe(true);
    expect(leerCobrosPendientes(A).credito?.payload.numero).toBe("C1-000008");
  });
  it("separa por negocio y por equipo, no por usuario", () => {
    almacen();
    fijarCobroPendiente(A, "credito", pendiente);
    expect(leerCobrosPendientes(alcanceCobros("n", "otro-equipo"))).toEqual({});
    expect(leerCobrosPendientes(alcanceCobros("otro-negocio", "e"))).toEqual({});
    expect(Object.keys(leerCobrosPendientes(alcanceCobros("n", "e")))).toEqual(["credito"]);
  });
});
