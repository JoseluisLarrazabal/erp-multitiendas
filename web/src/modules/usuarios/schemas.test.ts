import { describe, expect, it } from "vitest";
import { loginSchema } from "./schemas";

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
