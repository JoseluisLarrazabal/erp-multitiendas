import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ERROR_CONEXION, ERROR_CREDENCIALES, mensajeErrorLogin } from "./login";

describe("mensajeErrorLogin", () => {
  it("credenciales malas y cuenta baneada dan el mismo mensaje genérico", () => {
    expect(mensajeErrorLogin(new AuthApiError("x", 400, "invalid_credentials"))).toBe(
      ERROR_CREDENCIALES,
    );
    expect(mensajeErrorLogin(new AuthApiError("x", 403, "user_banned"))).toBe(ERROR_CREDENCIALES);
  });
  it("red, 429 y 5xx piden reintentar", () => {
    expect(mensajeErrorLogin(new AuthRetryableFetchError("x", 0))).toBe(ERROR_CONEXION);
    expect(mensajeErrorLogin(new AuthApiError("x", 429, "over_request_rate_limit"))).toBe(
      ERROR_CONEXION,
    );
    expect(mensajeErrorLogin(new AuthApiError("x", 500, undefined))).toBe(ERROR_CONEXION);
  });
});
