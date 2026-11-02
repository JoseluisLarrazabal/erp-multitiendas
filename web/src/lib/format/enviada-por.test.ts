import { describe, expect, it } from "vitest";
import { textoEnviadaPor } from "./enviada-por";

describe("textoEnviadaPor", () => {
  it("avisa solo si quien envió difiere de quien registró", () => {
    expect(textoEnviadaPor("a", "a", "Ana")).toBeNull();
    expect(textoEnviadaPor("a", null, null)).toBeNull();
    expect(textoEnviadaPor("a", "b", "Beto")).toBe("Sin conexión, enviada por Beto");
    expect(textoEnviadaPor("a", "b", null)).toBe("Sin conexión, enviada por otra persona");
  });
});
