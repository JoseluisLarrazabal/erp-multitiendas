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

describe("compraSchema: lote y vence (frial)", () => {
  const con = (extra: object) =>
    compraSchema.safeParse({ ...base, items: [{ ...base.items[0], ...extra }] });
  it("acepta lote y vence juntos y los normaliza", () => {
    const r = con({ lote: " L-1 ", vence: "2027-03-10" });
    expect(r.success).toBe(true);
    expect(r.data?.items[0]).toMatchObject({ lote: "L-1", vence: "2027-03-10" });
  });
  it("sin lote ni vence (negocio sin lotes) quedan en null", () => {
    expect(con({}).data?.items[0]).toMatchObject({ lote: null, vence: null });
    expect(con({ lote: "", vence: "" }).data?.items[0]).toMatchObject({ lote: null, vence: null });
  });
  it("uno solo no sirve", () => {
    expect(con({ lote: "L-1" }).success).toBe(false);
    expect(con({ vence: "2027-03-10" }).success).toBe(false);
  });
  it("rechaza fecha inexistente, mal formada o lote de más de 40 caracteres", () => {
    expect(con({ lote: "L", vence: "2027-02-30" }).success).toBe(false);
    expect(con({ lote: "L", vence: "10/03/2027" }).success).toBe(false);
    expect(con({ lote: "x".repeat(41), vence: "2027-03-10" }).success).toBe(false);
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
