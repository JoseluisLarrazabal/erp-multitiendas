import { describe, expect, it } from "vitest";
import { esUrlLocal } from "../src/main.ts";

describe("esUrlLocal", () => {
  it("acepta solo hosts locales", () => {
    expect(esUrlLocal("http://127.0.0.1:54321")).toBe(true);
    expect(esUrlLocal("http://localhost:54321")).toBe(true);
    expect(esUrlLocal("http://[::1]:54321")).toBe(true);
    expect(esUrlLocal("https://proyecto.supabase.co")).toBe(false);
    expect(esUrlLocal("http://127.0.0.1.evil.example")).toBe(false);
  });
});
