import { describe, expect, it } from "vitest";
import { masSi } from "./texto";

describe("masSi", () => {
  it("agrega + solo cuando hay más que lo mostrado", () => {
    expect(masSi(true)).toBe("+");
    expect(masSi(false)).toBe("");
  });
});
