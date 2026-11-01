import { describe, expect, it } from "vitest";
import { leerCatalogo, ventaPayloadSchema } from "./schemas";

const id = (n: number) => `a0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const base = {
  id: id(1),
  dispositivo_id: id(2),
  caja_sesion_id: id(3),
  numero: "C1-000123",
  cliente_id: null,
  creada_en_cliente: new Date("2026-11-01T12:00:00Z").toISOString(),
  descuento: 0,
  total: 80,
  items: [
    {
      producto_id: id(4),
      lista: "contado",
      cantidad: 2,
      precio_unitario: 40,
      descuento: 0,
      serie_id: null,
    },
  ],
  pagos: [{ medio: "efectivo", monto: 80 }],
};

describe("ventaPayloadSchema", () => {
  it("acepta un payload válido, incluso con UUID de seed", () => {
    expect(ventaPayloadSchema.safeParse(base).success).toBe(true);
  });
  it("rechaza crédito, QR sin verificar, número mal formado y claves extra", () => {
    const item = base.items[0]!;
    expect(
      ventaPayloadSchema.safeParse({ ...base, items: [{ ...item, lista: "credito" }] }).success,
    ).toBe(false);
    expect(
      ventaPayloadSchema.safeParse({ ...base, pagos: [{ medio: "qr", monto: 80 }] }).success,
    ).toBe(false);
    expect(
      ventaPayloadSchema.safeParse({
        ...base,
        pagos: [{ medio: "qr", monto: 80, verificado: true }],
      }).success,
    ).toBe(true);
    expect(ventaPayloadSchema.safeParse({ ...base, numero: "c1-1" }).success).toBe(false);
    expect(ventaPayloadSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
  it("rechaza más decimales de los permitidos y fechas sin zona", () => {
    expect(ventaPayloadSchema.safeParse({ ...base, total: 80.005 }).success).toBe(false);
    const item = base.items[0]!;
    expect(
      ventaPayloadSchema.safeParse({ ...base, items: [{ ...item, cantidad: 1.2345 }] }).success,
    ).toBe(false);
    expect(
      ventaPayloadSchema.safeParse({ ...base, items: [{ ...item, cantidad: 1.234 }] }).success,
    ).toBe(true);
    expect(
      ventaPayloadSchema.safeParse({ ...base, creada_en_cliente: "2026-11-01T12:00:00" }).success,
    ).toBe(false);
  });
  it("exige al menos una línea y un pago", () => {
    expect(ventaPayloadSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(ventaPayloadSchema.safeParse({ ...base, pagos: [] }).success).toBe(false);
  });
});

describe("leerCatalogo", () => {
  const producto = {
    id: id(5),
    codigo: "A",
    codigo_barras: null,
    nombre: "Funda",
    unidad: "unidad",
    tipo: "producto",
    controla_serie: false,
    garantia_meses: 6,
    precios: {
      contado: 278.4,
      credito: null,
      mayorista: null,
      minimo: 222.72,
      normal: null,
      express: null,
    },
    stock_por_ubicacion: { [id(9)]: 3 },
    stock_total: 3,
  };
  it("convierte precios a centavos enteros", () => {
    const c = leerCatalogo({
      tipo_cambio: 6.96,
      ubicaciones: [],
      productos: [producto],
      version: "x",
    });
    expect(c?.productos[0]?.precios.contado).toBe(27840);
    expect(c?.productos[0]?.precios.minimo).toBe(22272);
    expect(c?.productos[0]?.precios.mayorista).toBeNull();
  });
  it("rechaza un catálogo mal formado", () => {
    expect(leerCatalogo({ productos: [{ id: 1 }] })).toBeNull();
  });
});
