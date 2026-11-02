import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { encolar, leerFilas } from "./cola";
import { baseOffline } from "./db";
import { borrarDatos, guardarDato, leerDato } from "./datos";

const schema = z.object({ n: z.number() });
const esperar = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  await baseOffline().datos.clear();
  await baseOffline().cola.clear();
});

describe("datos locales", () => {
  it("guarda y lee con Zod; una fila inválida se ignora", async () => {
    guardarDato("a", { n: 1 });
    guardarDato("b", { n: "x" });
    await esperar();
    expect(await leerDato("a", schema)).toEqual({ n: 1 });
    expect(await leerDato("b", schema)).toBeNull();
    expect(await leerDato("no-existe", schema)).toBeNull();
  });

  it("borrarDatos vacía el contexto y nunca toca la cola", async () => {
    guardarDato("a", { n: 1 });
    await encolar({
      id: "a0000000-0000-4000-8000-000000000001",
      tipo: "venta",
      negocioId: "n",
      dispositivoId: "d",
      usuarioId: "u",
      payload: {},
      nota: null,
      numeroImpreso: null,
    });
    await esperar();
    await borrarDatos();
    expect(await leerDato("a", schema)).toBeNull();
    expect((await leerFilas()).filas).toHaveLength(1);
  });
});
