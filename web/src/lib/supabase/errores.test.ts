import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { esErrorTransitorio, esSinSesion } from "./errores";

const api = (status: number) => new AuthApiError("x", status, undefined);

describe("esErrorTransitorio", () => {
  it("red, 429 y 5xx son transitorios", () => {
    expect(esErrorTransitorio(new AuthRetryableFetchError("x", 0))).toBe(true);
    expect(esErrorTransitorio(api(429))).toBe(true);
    expect(esErrorTransitorio(api(500))).toBe(true);
    expect(esErrorTransitorio(api(503))).toBe(true);
  });
  it("credenciales, baneo y sin sesión no lo son", () => {
    expect(esErrorTransitorio(api(400))).toBe(false);
    expect(esErrorTransitorio(api(403))).toBe(false);
    expect(esErrorTransitorio(new AuthSessionMissingError())).toBe(false);
    expect(esErrorTransitorio(null)).toBe(false);
  });
});

describe("esSinSesion", () => {
  it("sin sesión, 401 y 403", () => {
    expect(esSinSesion(new AuthSessionMissingError())).toBe(true);
    expect(esSinSesion(api(401))).toBe(true);
    expect(esSinSesion(api(403))).toBe(true);
  });
  it("un 500 o un fallo de red no es sin sesión", () => {
    expect(esSinSesion(api(500))).toBe(false);
    expect(esSinSesion(new AuthRetryableFetchError("x", 0))).toBe(false);
  });
});
