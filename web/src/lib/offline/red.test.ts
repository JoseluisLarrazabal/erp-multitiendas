import { afterEach, describe, expect, it, vi } from "vitest";
import { avisarRed, leerSinRed } from "./red";

afterEach(() => {
  avisarRed(true);
  vi.useRealTimers();
});

describe("marca de fallo de red", () => {
  it("expira a los 20 s para volver a comprobar", () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { onLine: true });
    avisarRed(false);
    expect(leerSinRed()).toBe(true);
    vi.advanceTimersByTime(19_999);
    expect(leerSinRed()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(leerSinRed()).toBe(false);
    // Si la siguiente petición vuelve a fallar, se marca de nuevo.
    avisarRed(false);
    expect(leerSinRed()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("una respuesta limpia la marca y el temporizador", () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { onLine: true });
    avisarRed(false);
    avisarRed(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(leerSinRed()).toBe(false);
    vi.unstubAllGlobals();
  });
});
