import { describe, expect, it } from "vitest";
import { parsearMontoInicial } from "./domain";

describe("parsearMontoInicial", () => {
  it("vacío es cero; acepta coma y punto; rechaza el resto", () => {
    expect(parsearMontoInicial("")).toBe(0);
    expect(parsearMontoInicial("100,5")).toBe(10050);
    expect(parsearMontoInicial("100.25")).toBe(10025);
    expect(parsearMontoInicial("1,234")).toBeNull();
    expect(parsearMontoInicial("-5")).toBeNull();
    expect(parsearMontoInicial("abc")).toBeNull();
  });
});
