import { describe, expect, it } from "vitest";
import { construirNota, construirPayload, type DatosEnvio } from "./venta";
import type { ResumenCarrito } from "./carrito";

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const resumen = {
  error: null,
  totales: { subtotal: 8000, sumaLineas: 8000, total: 8000 },
  lineas: [
    {
      linea: {
        producto: { id: uuid(4), nombre: "P", codigo: "C", garantiaMeses: null },
        lista: "contado",
        serieId: null,
        serieTexto: null,
      },
      entrada: { cantidadMilesimas: 1000, precio: 8000, descuento: 0 },
    },
  ],
} as unknown as ResumenCarrito;
const datos: DatosEnvio = {
  ventaId: uuid(1),
  dispositivoId: uuid(2),
  cajaId: uuid(3),
  numero: "C1-000001",
  clienteId: null,
  creadaEnCliente: "2026-11-01T10:00:00.000Z",
  descuentoVentaTexto: "",
  efectivo: 0,
  qr: 8000,
  qrVerificado: false,
};

describe("completar una reserva", () => {
  const conReserva: DatosEnvio = {
    ...datos,
    qr: 0,
    efectivo: 5000,
    qrVerificado: true,
    reservaId: uuid(7),
    anticipo: 3000,
  };
  it("manda reserva_id y el pago anticipo solo cuando hay reserva", () => {
    const p = construirPayload(resumen, conReserva);
    expect(p?.reserva_id).toBe(uuid(7));
    expect(p?.pagos).toEqual([
      { medio: "anticipo", monto: 30 },
      { medio: "efectivo", monto: 50 },
    ]);
    const sin = construirPayload(resumen, { ...datos, qr: 8000, qrVerificado: true });
    expect(sin).not.toHaveProperty("reserva_id");
    expect(sin?.pagos.map((x) => x.medio)).toEqual(["qr"]);
  });
  it("la nota incluye el anticipo como pago", () => {
    const nota = construirNota(resumen, conReserva, {
      negocio: { nombre: "N", nit: null, datosNota: null },
      vendedor: "V",
      cliente: null,
      recibido: 5000,
    });
    expect(nota?.pagos).toEqual([
      { medio: "anticipo", monto: 3000 },
      { medio: "efectivo", monto: 5000 },
    ]);
  });
});

describe("QR pendiente de verificar", () => {
  it("el payload lleva verificado:false y la nota lo marca pendiente", () => {
    expect(construirPayload(resumen, datos)?.pagos).toEqual([
      { medio: "qr", monto: 80, verificado: false },
    ]);
    const nota = construirNota(resumen, datos, {
      negocio: { nombre: "N", nit: null, datosNota: null },
      vendedor: "V",
      cliente: null,
      recibido: 0,
    });
    expect(nota?.pagos).toEqual([{ medio: "qr", monto: 8000, pendiente: true }]);
  });

  it("confirmado conserva verificado:true y la nota no lo marca", () => {
    const d = { ...datos, qrVerificado: true };
    expect(construirPayload(resumen, d)?.pagos[0]).toMatchObject({ verificado: true });
    expect(
      construirNota(resumen, d, {
        negocio: { nombre: "N", nit: null, datosNota: null },
        vendedor: "V",
        cliente: null,
        recibido: 0,
      })?.pagos[0],
    ).not.toHaveProperty("pendiente");
  });
});

describe("venta a crédito", () => {
  const lineasCredito = {
    ...resumen,
    lineas: [{ ...resumen.lineas[0]!, linea: { ...resumen.lineas[0]!.linea, lista: "credito" } }],
  } as unknown as ResumenCarrito;
  const credito: DatosEnvio = {
    ...datos,
    clienteId: uuid(8),
    efectivo: 4000,
    qr: 0,
    qrVerificado: true,
    credito: { cuotas: 3, docsCi: true, docsDomicilio: false, docsPagare: true },
  };
  it("manda condicion, el bloque credito y la inicial como único pago; el total es el completo", () => {
    const p = construirPayload(lineasCredito, credito);
    expect(p).toMatchObject({
      condicion: "credito",
      credito: { cuotas: 3, docs_ci: true, docs_domicilio: false, docs_pagare: true },
      total: 80,
      pagos: [{ medio: "efectivo", monto: 40 }],
    });
  });
  it("no arma el payload sin cliente, con una línea fuera de la lista crédito o con reserva", () => {
    expect(construirPayload(lineasCredito, { ...credito, clienteId: null })).toBeNull();
    expect(construirPayload(resumen, credito)).toBeNull();
    expect(construirPayload(lineasCredito, { ...credito, reservaId: uuid(7) })).toBeNull();
  });
  it("la nota dice cuánto queda a crédito y en cuántas cuotas", () => {
    const nota = construirNota(lineasCredito, credito, {
      negocio: { nombre: "N", nit: null, datosNota: null },
      vendedor: "V",
      cliente: null,
      recibido: 4000,
    });
    expect(nota?.credito).toEqual({ ventaId: uuid(1), cuotas: 3, financiado: 4000 });
    expect(nota?.pagos).toEqual([{ medio: "efectivo", monto: 4000 }]);
  });
});
