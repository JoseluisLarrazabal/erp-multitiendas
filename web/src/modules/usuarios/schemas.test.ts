import { describe, expect, it } from "vitest";
import {
  claveSchema,
  crearUsuarioSchema,
  registrarDispositivoSchema,
  loginSchema,
} from "./schemas";

describe("loginSchema", () => {
  it("normaliza el correo", () => {
    const r = loginSchema.parse({ correo: "  Dueno@ERP.test ", contrasena: "x" });
    expect(r.correo).toBe("dueno@erp.test");
  });
  it("rechaza correo inválido, contraseña vacía o demasiado larga", () => {
    expect(loginSchema.safeParse({ correo: "no-es-correo", contrasena: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ correo: "a@b.co", contrasena: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ correo: "a@b.co", contrasena: "x".repeat(129) }).success).toBe(
      false,
    );
  });
});

describe("claveSchema", () => {
  it("pide 8 o más con letras y dígitos", () => {
    expect(claveSchema.safeParse("Clave-prueba-1").success).toBe(true);
    for (const mala of ["corta1", "sololetrasaqui", "1234567890"]) {
      expect(claveSchema.safeParse(mala).success).toBe(false);
    }
  });
});

describe("crearUsuarioSchema", () => {
  it("acepta los IDs del seed y normaliza el correo", () => {
    const r = crearUsuarioSchema.parse({
      negocioId: "a0000000-0000-0000-0000-000000000001",
      rol: "vendedor",
      correo: " Nuevo@ERP.test ",
      nombre: " Ana ",
      clave: "Clave-prueba-1",
    });
    expect(r.correo).toBe("nuevo@erp.test");
    expect(r.nombre).toBe("Ana");
  });
});

describe("registrarDispositivoSchema", () => {
  const base = {
    negocioId: "a0000000-0000-0000-0000-000000000001",
    ubicacionId: "b0000000-0000-0000-0000-000000000001",
    nombre: "Caja 2",
  };
  it("pasa el prefijo a mayúsculas y rechaza formatos ajenos", () => {
    expect(registrarDispositivoSchema.parse({ ...base, prefijo: "c2" }).prefijo).toBe("C2");
    for (const mal of ["", "CC", "C123", "2C"]) {
      expect(registrarDispositivoSchema.safeParse({ ...base, prefijo: mal }).success).toBe(false);
    }
  });
});
