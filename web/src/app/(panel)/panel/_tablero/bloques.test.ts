import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bloquesTablero } from "./bloques";

// Los permisos salen de la matriz real (dato de producción), no de listas escritas a mano que se desvían de ella.
const MIGRACION = resolve(
  process.cwd(),
  "../supabase/migrations/20261101120100_rol_permisos_matriz.sql",
);
const FILAS_MATRIZ = [
  ...readFileSync(MIGRACION, "utf8").matchAll(/\('(\w+)',\s+'([A-Z]*)',\s+'([A-Z]*)'\)/g),
];
const LETRA = { dueno: "D", encargado: "E", contador: "C", vendedor: "V" } as const;

function permisosDe(rol: keyof typeof LETRA, tipo: string): string[] {
  const columna = tipo === "lavanderia" ? 3 : 2;
  return FILAS_MATRIZ.filter((m) => m[columna]!.includes(LETRA[rol])).map((m) => m[1]!);
}

describe("bloquesTablero", () => {
  it("el dueño de una tienda ve todo menos lo de otros negocios", () => {
    const b = bloquesTablero(permisosDe("dueno", "tienda"), "tienda");
    expect(b).toMatchObject({
      ventas: true,
      utilidad: true,
      cajas: true,
      porRevisar: true,
      stockBajo: true,
      creditos: true,
      masVendidos: true,
      lotes: false,
      ordenes: false,
    });
    expect(b.acciones).toEqual({ pos: true, compra: true, entrada: true, reportes: true });
  });
  it("el encargado también ve utilidad (la matriz le da ver_costos); el vendedor no ve ventas", () => {
    const b = bloquesTablero(permisosDe("encargado", "tienda"), "tienda");
    expect(b).toMatchObject({ ventas: true, utilidad: true });
    expect(bloquesTablero(permisosDe("vendedor", "tienda"), "tienda")).toMatchObject({
      ventas: false,
      utilidad: false,
    });
  });
  it("el contador no tiene acciones de escritura ni reservas", () => {
    const b = bloquesTablero(permisosDe("contador", "tienda"), "tienda");
    expect(b.acciones).toEqual({ pos: false, compra: false, entrada: false, reportes: true });
    expect(b).toMatchObject({ reservas: false, porPagar: false, cuotas: true, utilidad: true });
  });
  it("la matriz se leyó completa", () => {
    expect(FILAS_MATRIZ).toHaveLength(14);
    expect(permisosDe("encargado", "lavanderia")).toContain("gestionar_compras");
  });
  it("lavandería, dueño y encargado: órdenes y pagos a proveedores; sin cuotas, reservas ni más vendidos", () => {
    for (const rol of ["dueno", "encargado"] as const) {
      const b = bloquesTablero(permisosDe(rol, "lavanderia"), "lavanderia");
      expect(b).toMatchObject({
        ordenes: true,
        porPagar: true,
        creditos: true,
        cuotas: false,
        reservas: false,
        masVendidos: false,
        ventas: true,
      });
    }
  });
  it("lavandería, vendedor: órdenes, sin ventas ni pagos a proveedores", () => {
    const b = bloquesTablero(permisosDe("vendedor", "lavanderia"), "lavanderia");
    expect(b).toMatchObject({ ordenes: true, ventas: false, porPagar: false, creditos: false });
  });
  it("las órdenes solo van en lavandería y los lotes solo en el frial", () => {
    expect(bloquesTablero(permisosDe("dueno", "frial"), "frial")).toMatchObject({
      lotes: true,
      ordenes: false,
    });
    expect(bloquesTablero(permisosDe("dueno", "lavanderia"), "lavanderia").lotes).toBe(false);
  });
  it("sin permisos no hay bloques", () => {
    const b = bloquesTablero([], "tienda");
    expect(Object.entries(b).filter(([k, v]) => k !== "acciones" && v === true)).toEqual([]);
  });
});
