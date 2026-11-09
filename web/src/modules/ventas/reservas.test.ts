import { describe, expect, it } from "vitest";
import type { ProductoPos } from "./domain";
import {
  armarReserva,
  saldoReserva,
  sePuedeReservar,
  totalReserva,
  type FormReserva,
  type ReservaActiva,
} from "./reservas";
import { reservaPayloadSchema } from "./schemas-reservas";

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const producto = (extra: Partial<ProductoPos> = {}): ProductoPos => ({
  id: uuid(2),
  codigo: "A",
  codigoBarras: null,
  nombre: "Funda",
  unidad: "unidad",
  tipo: "producto",
  controlaSerie: false,
  garantiaMeses: null,
  precios: {
    contado: 1000,
    credito: null,
    mayorista: null,
    minimo: null,
    normal: null,
    express: null,
  },
  stockPorUbicacion: {},
  stockTotal: 0,
  ...extra,
});
const form = (extra: Partial<FormReserva> = {}): FormReserva => ({
  clienteId: uuid(1),
  producto: producto(),
  cantidadTexto: "5",
  precioTexto: "12",
  anticipoTexto: "20",
  medio: "efectivo",
  qrConfirmado: false,
  ...extra,
});

describe("armarReserva", () => {
  it("arma el payload en bolivianos con las claves exactas", () => {
    const r = armarReserva(form(), uuid(9), uuid(8), uuid(3));
    expect(r).toEqual({
      ok: true,
      payload: {
        id: uuid(9),
        dispositivo_id: uuid(8),
        caja_sesion_id: uuid(3),
        cliente_id: uuid(1),
        producto_id: uuid(2),
        cantidad: 5,
        precio_acordado: 12,
        anticipo: 20,
        medio: "efectivo",
      },
    });
    expect(reservaPayloadSchema.safeParse((r as { payload: unknown }).payload).success).toBe(true);
  });
  it("rechaza lo mismo que el servidor", () => {
    const e = (f: Partial<FormReserva>, caja: string | null = uuid(3)) => {
      const r = armarReserva(form(f), uuid(9), uuid(8), caja);
      return r.ok ? null : r.error;
    };
    expect(e({}, null)).toMatch(/caja/);
    expect(e({ clienteId: null })).toMatch(/cliente/);
    expect(e({ producto: null })).toMatch(/producto/);
    expect(e({ producto: producto({ controlaSerie: true }) })).toMatch(/no se puede reservar/);
    expect(e({ producto: producto({ tipo: "servicio" }) })).toMatch(/no se puede reservar/);
    expect(e({ cantidadTexto: "1,5" })).toMatch(/entera/);
    expect(e({ cantidadTexto: "0" })).toMatch(/entera/);
    expect(e({ precioTexto: "0" })).toMatch(/Precio/);
    expect(e({ anticipoTexto: "" })).toMatch(/Anticipo/);
    expect(e({ anticipoTexto: "60,01" })).toMatch(/superar/);
    expect(e({ medio: "qr" })).toMatch(/QR/);
  });
  it("el anticipo igual al total es válido; kg admite 3 decimales", () => {
    expect(armarReserva(form({ anticipoTexto: "60" }), uuid(9), uuid(8), uuid(3)).ok).toBe(true);
    expect(
      armarReserva(form({ medio: "qr", qrConfirmado: true }), uuid(9), uuid(8), uuid(3)).ok,
    ).toBe(true);
    const kg = producto({ unidad: "kg" });
    const r = armarReserva(
      form({ producto: kg, cantidadTexto: "1,25", precioTexto: "10", anticipoTexto: "12,50" }),
      uuid(9),
      uuid(8),
      uuid(3),
    );
    expect(r.ok && r.payload.cantidad).toBe(1.25);
  });
});

describe("totales de una reserva", () => {
  const r: ReservaActiva = {
    id: uuid(9),
    clienteId: uuid(1),
    clienteNombre: "C",
    productoId: uuid(2),
    productoNombre: "Funda",
    ubicacionId: uuid(4),
    cantidad: 5,
    precioAcordado: 12,
    anticipo: 20,
    medio: "qr",
    creadaEn: "2026-11-08T10:00:00Z",
  };
  it("total y saldo en centavos", () => {
    expect(totalReserva(r)).toBe(6000);
    expect(saldoReserva(r)).toBe(4000);
    expect(sePuedeReservar(producto())).toBe(true);
  });
});
