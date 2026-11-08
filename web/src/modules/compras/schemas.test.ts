import { describe, expect, it } from "vitest";
import { compraSchema, pagoSchema, proveedorSchema } from "./schemas";

const id = "11111111-1111-4111-8111-111111111111";
const otro = "22222222-2222-4222-8222-222222222222";
const base = {
  operacionId: id,
  negocioId: id,
  proveedorId: id,
  ubicacionId: id,
  condicion: "credito" as const,
  items: [{ productoId: id, cantidad: "2", costo: "7,5" }],
};

describe("compraSchema", () => {
  it("acepta una compra a crédito sin medio", () => {
    expect(compraSchema.safeParse(base).success).toBe(true);
  });
  it("al contado exige medio", () => {
    expect(compraSchema.safeParse({ ...base, condicion: "contado" }).success).toBe(false);
    expect(compraSchema.safeParse({ ...base, condicion: "contado", medio: "qr" }).success).toBe(
      true,
    );
  });
  it("rechaza cantidad 0, costo inválido, sin ítems y producto repetido", () => {
    const con = (items: unknown) => compraSchema.safeParse({ ...base, items }).success;
    expect(con([{ productoId: id, cantidad: "0", costo: "1" }])).toBe(false);
    expect(con([{ productoId: id, cantidad: "1", costo: "-1" }])).toBe(false);
    expect(con([])).toBe(false);
    expect(con([...base.items, ...base.items])).toBe(false);
    expect(con([...base.items, { productoId: otro, cantidad: "1", costo: "0" }])).toBe(true);
  });
});

describe("pagoSchema", () => {
  const pago = { operacionId: id, negocioId: id, proveedorId: id, monto: "10,50", medio: "qr" };
  it("acepta monto con hasta 2 decimales", () => {
    expect(pagoSchema.safeParse(pago).success).toBe(true);
  });
  it("rechaza monto 0, con 3 decimales y medio desconocido", () => {
    expect(pagoSchema.safeParse({ ...pago, monto: "0" }).success).toBe(false);
    expect(pagoSchema.safeParse({ ...pago, monto: "1,005" }).success).toBe(false);
    expect(pagoSchema.safeParse({ ...pago, medio: "cheque" }).success).toBe(false);
  });
});

describe("proveedorSchema", () => {
  it("exige nombre y normaliza contacto vacío a null", () => {
    expect(proveedorSchema.safeParse({ negocioId: id, nombre: " ", contacto: "" }).success).toBe(
      false,
    );
    const r = proveedorSchema.parse({ negocioId: id, nombre: "Sur", contacto: " " });
    expect(r.contacto).toBeNull();
    expect(r.activo).toBe(true);
  });
});
