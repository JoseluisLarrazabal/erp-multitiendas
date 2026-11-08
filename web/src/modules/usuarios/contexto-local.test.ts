import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { guardarDato, leerDato } from "@/lib/offline/datos";
import { baseOffline } from "@/lib/offline/db";
import { z } from "zod";
import {
  borrarContextoLocal,
  CADUCADO,
  CADUCIDAD_CONTEXTO_MS,
  contextoCaducado,
  guardarSesionLocal,
  leerSesionLocal,
} from "./contexto-local";
import { desbloquearEscrituras } from "@/lib/offline/datos";

const sesion = (usuarioId: string) => ({
  usuarioId,
  negocios: [{ negocioId: "n1", nombre: "N", tipo: "tienda", rol: "vendedor" }],
  activoId: "n1",
  permisos: ["vender"],
});
const esperar = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  desbloquearEscrituras();
  await baseOffline().datos.clear();
});

describe("contexto local de la sesión", () => {
  it("guarda y lee la cuenta de la última vez", async () => {
    await guardarSesionLocal(sesion("u1"));
    await esperar();
    expect(await leerSesionLocal()).toMatchObject(sesion("u1"));
  });

  it("otra cuenta en el mismo navegador no hereda nada de la anterior", async () => {
    await guardarSesionLocal(sesion("u1"));
    guardarDato("catalogo:u1:n1:x", { n: 1 });
    await esperar();
    await guardarSesionLocal(sesion("u2"));
    await esperar();
    expect(await leerSesionLocal()).toMatchObject({ usuarioId: "u2" });
    expect(await leerDato("catalogo:u1:n1:x", z.object({ n: z.number() }))).toBeNull();
  });

  it("una fila inválida se ignora y borrar deja sin contexto", async () => {
    await baseOffline().datos.put({ clave: "ultimo", valor: { usuarioId: "u1" } });
    await baseOffline().datos.put({ clave: "sesion:u1", valor: { usuarioId: "u1" } });
    expect(await leerSesionLocal()).toBeNull();
    await guardarSesionLocal(sesion("u1"));
    await esperar();
    await borrarContextoLocal();
    expect(await leerSesionLocal()).toBeNull();
  });
});

describe("caducidad del contexto (72 h)", () => {
  it("contextoCaducado: justo en el límite vale, pasado caduca, sin fecha caduca", () => {
    expect(contextoCaducado(1_000, 1_000 + CADUCIDAD_CONTEXTO_MS)).toBe(false);
    expect(contextoCaducado(1_000, 1_001 + CADUCIDAD_CONTEXTO_MS)).toBe(true);
  });

  it("un contexto viejo no se lee como sesión y uno renovado sí", async () => {
    await guardarSesionLocal(sesion("u1"));
    const viejo = await baseOffline().datos.get("sesion:u1");
    await baseOffline().datos.put({
      clave: "sesion:u1",
      valor: { ...(viejo!.valor as object), validadaEn: Date.now() - CADUCIDAD_CONTEXTO_MS - 1 },
    });
    expect(await leerSesionLocal()).toBe(CADUCADO);
    await guardarSesionLocal(sesion("u1"));
    expect(await leerSesionLocal()).toMatchObject(sesion("u1"));
  });
});

describe("filas de la versión anterior", () => {
  it("sin fecha se sella y vale", async () => {
    await baseOffline().datos.put({ clave: "ultimo", valor: { usuarioId: "u1" } });
    await baseOffline().datos.put({ clave: "sesion:u1", valor: sesion("u1") });
    expect(await leerSesionLocal()).toMatchObject(sesion("u1"));
    const fila = await baseOffline().datos.get("sesion:u1");
    expect((fila!.valor as { validadaEn?: number }).validadaEn).toBeTypeOf("number");
  });
});

describe("cierre de sesión", () => {
  it("borrar el contexto bloquea las escrituras tardías, sin tocar la cola", async () => {
    await guardarSesionLocal(sesion("u1"));
    try {
      await borrarContextoLocal();
      await guardarSesionLocal(sesion("u1"));
      guardarDato("catalogo:u1:n1:x", { n: 1 });
      await esperar();
      expect(await leerSesionLocal()).toBeNull();
      expect(await leerDato("catalogo:u1:n1:x", z.object({ n: z.number() }))).toBeNull();
    } finally {
      desbloquearEscrituras();
    }
    await guardarSesionLocal(sesion("u1"));
    expect(await leerSesionLocal()).toMatchObject(sesion("u1"));
  });

  it("el cambio de cuenta borra pero no bloquea: la cuenta nueva se guarda", async () => {
    await guardarSesionLocal(sesion("u1"));
    await guardarSesionLocal(sesion("u2"));
    expect(await leerSesionLocal()).toMatchObject({ usuarioId: "u2" });
  });
});
