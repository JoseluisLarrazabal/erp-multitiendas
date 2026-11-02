import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baseOffline } from "@/lib/offline/db";
import type { FilaCola, LecturaCola } from "@/lib/offline/cola";
import { equipoTieneCola, resumirCola } from "./use-cola";

const fila = (extra: Partial<FilaCola> = {}): FilaCola => ({
  orden: 1,
  id: "a0000000-0000-4000-8000-000000000001",
  tipo: "venta",
  negocioId: "n1",
  dispositivoId: "otro",
  usuarioId: "u1",
  payload: {},
  nota: null,
  estado: "pendiente",
  intentos: 0,
  proximoIntento: 0,
  error: null,
  numeroImpreso: null,
  entregada: true,
  ...extra,
});
const vacia: LecturaCola = { filas: [], ilegibles: 0, ordenesIlegibles: [] };

afterEach(() => vi.restoreAllMocks());

describe("bloqueo del equipo", () => {
  it("antes de la primera lectura y con la lectura fallida bloquea; solo la fallida lo dice", () => {
    expect(resumirCola(null, ["n1"], "e1")).toMatchObject({
      bloqueaEquipo: true,
      lecturaFallida: false,
    });
    expect(resumirCola("error", ["n1"], "e1")).toMatchObject({
      bloqueaEquipo: true,
      lecturaFallida: true,
    });
  });

  it("con la cola leída y vacía, o con filas de otro equipo, no bloquea", () => {
    expect(resumirCola(vacia, ["n1"], "e1").bloqueaEquipo).toBe(false);
    expect(resumirCola({ ...vacia, filas: [fila()] }, ["n1"], "e1").bloqueaEquipo).toBe(false);
    expect(
      resumirCola({ ...vacia, filas: [fila({ dispositivoId: "e1" })] }, ["n1"], "e1").bloqueaEquipo,
    ).toBe(true);
  });

  it("equipoTieneCola devuelve true si IndexedDB no se puede leer", async () => {
    await baseOffline().cola.clear();
    expect(await equipoTieneCola("e1")).toBe(false);
    vi.spyOn(baseOffline().cola, "orderBy").mockImplementation(() => {
      throw new Error("IndexedDB");
    });
    expect(await equipoTieneCola("e1")).toBe(true);
  });
});
