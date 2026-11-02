import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { guardarDato, leerDato } from "@/lib/offline/datos";
import { baseOffline } from "@/lib/offline/db";
import { z } from "zod";
import { borrarContextoLocal, guardarSesionLocal, leerSesionLocal } from "./contexto-local";

const sesion = (usuarioId: string) => ({
  usuarioId,
  negocios: [{ negocioId: "n1", nombre: "N", tipo: "tienda", rol: "vendedor" }],
  activoId: "n1",
  permisos: ["vender"],
});
const esperar = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  await baseOffline().datos.clear();
});

describe("contexto local de la sesión", () => {
  it("guarda y lee la cuenta de la última vez", async () => {
    await guardarSesionLocal(sesion("u1"));
    await esperar();
    expect(await leerSesionLocal()).toEqual(sesion("u1"));
  });

  it("otra cuenta en el mismo navegador no hereda nada de la anterior", async () => {
    await guardarSesionLocal(sesion("u1"));
    guardarDato("catalogo:u1:n1:x", { n: 1 });
    await esperar();
    await guardarSesionLocal(sesion("u2"));
    await esperar();
    expect((await leerSesionLocal())?.usuarioId).toBe("u2");
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
