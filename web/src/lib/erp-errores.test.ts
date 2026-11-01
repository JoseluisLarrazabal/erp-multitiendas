import { describe, expect, it } from "vitest";
import {
  codigoErp,
  errorRpc,
  esFalloDeRed,
  MENSAJE_GENERICO,
  MENSAJE_RED,
  mensajeErp,
} from "./erp-errores";

describe("erp-errores", () => {
  it("extrae el código ERP del mensaje", () => {
    expect(codigoErp({ message: "ERP_DESCUENTO_TOPE", code: "P0001" })).toBe("ERP_DESCUENTO_TOPE");
    expect(codigoErp({ message: "duplicate key" })).toBeNull();
  });
  it("distingue fallo de red de un error de base", () => {
    expect(esFalloDeRed({ message: "TypeError: Failed to fetch", code: "" })).toBe(true);
    expect(esFalloDeRed({ message: "syntax error", code: "42601" })).toBe(false);
    expect(esFalloDeRed({ message: "ERP_SIN_PERMISO", code: "P0001" })).toBe(false);
  });
  it("un código desconocido no muestra el texto de Postgres", () => {
    expect(mensajeErp(null)).toBe(MENSAJE_GENERICO);
    expect(mensajeErp("ERP_NO_EXISTE")).toBe(MENSAJE_GENERICO);
    expect(mensajeErp("ERP_CAJA_CERRADA")).toMatch(/caja/i);
  });
  it("errorRpc: red, código conocido y desconocido", () => {
    expect(errorRpc({ message: "Failed to fetch", code: "" })).toMatchObject({
      error: MENSAJE_RED,
    });
    expect(errorRpc({ message: "ERP_CAJA_CERRADA", code: "P0001" })).toMatchObject({
      codigo: "ERP_CAJA_CERRADA",
      error: mensajeErp("ERP_CAJA_CERRADA"),
    });
    expect(errorRpc({ message: "boom", code: "42601" }).error).toBe(MENSAJE_GENERICO);
  });
});
