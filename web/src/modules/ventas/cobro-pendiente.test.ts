import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alcanceCobros,
  debeAplicarSola,
  fijarCobroPendiente,
  hayCobrosGuardados,
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

describe("hayCobrosGuardados", () => {
  const almacen = (datos: Record<string, string>) =>
    vi.stubGlobal("localStorage", {
      length: Object.keys(datos).length,
      key: (i: number) => Object.keys(datos)[i] ?? null,
      getItem: (k: string) => datos[k] ?? null,
    });

  it("cuenta cobros en línea y cuotas con contenido de cualquier alcance, y nada más", () => {
    almacen({});
    expect(hayCobrosGuardados()).toBe(false);
    almacen({ "erp:otra-cosa:x": '{"a":1}', "erp:cobros-en-linea": '{"a":1}' });
    expect(hayCobrosGuardados()).toBe(false);
    almacen({ "erp:otra-cosa:x": "1", "erp:cobros-en-linea:n:e": '{"credito":{}}' });
    expect(hayCobrosGuardados()).toBe(true);
    almacen({ "erp:cuotas-sin-confirmar:n:e": '[{"a":1}]' });
    expect(hayCobrosGuardados()).toBe(true);
  });

  it("una clave vacía o ilegible no cuenta", () => {
    for (const v of ["", "{}", "[]", "basura{", "null", "5"]) {
      almacen({ "erp:cobros-en-linea:n:e": v });
      expect(hayCobrosGuardados()).toBe(false);
    }
  });

  it("si el almacenamiento no responde, asume que hay", () => {
    vi.stubGlobal("localStorage", {
      length: 1,
      key: () => {
        throw new Error("bloqueado");
      },
    });
    expect(hayCobrosGuardados()).toBe(true);
  });
});

describe("debeAplicarSola", () => {
  const libre = {
    interactuo: false,
    colaVacia: true,
    cobrosGuardados: false,
    pendiente: false,
    lineas: 0,
  };
  it("solo antes de interactuar y sin cola, cobros ni pendientes", () => {
    expect(debeAplicarSola(libre)).toBe(true);
    expect(debeAplicarSola({ ...libre, interactuo: true })).toBe(false);
    expect(debeAplicarSola({ ...libre, colaVacia: false })).toBe(false);
    expect(debeAplicarSola({ ...libre, colaVacia: null })).toBe(false);
    expect(debeAplicarSola({ ...libre, cobrosGuardados: true })).toBe(false);
    expect(debeAplicarSola({ ...libre, pendiente: true })).toBe(false);
    expect(debeAplicarSola({ ...libre, lineas: 1 })).toBe(false);
  });
});
