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
  inesperados: 0,
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

describe("bloqueo del cierre de caja (M-11)", () => {
  const propia = (extra: Partial<FilaCola>) => fila({ dispositivoId: "e1", ...extra });
  const cierre = (filas: FilaCola[], ilegibles = 0) =>
    resumirCola({ ...vacia, filas, ilegibles }, ["n1"], "e1");

  it("una venta o un movimiento rechazado no bloquea el cierre pero sí el equipo", () => {
    for (const tipo of ["venta", "movimiento"]) {
      const e = cierre([propia({ tipo, estado: "rechazada" })]);
      expect(e.bloqueaCierre).toBe(false);
      expect(e.bloqueaEquipo).toBe(true);
      expect(e.rechazadasEquipo.cantidad + e.rechazadasEquipo.anteriores).toBe(1);
    }
  });

  it("lo pendiente, una apertura rechazada y lo ilegible bloquean el cierre y el equipo", () => {
    for (const e of [
      cierre([propia({ estado: "pendiente" })]),
      cierre([propia({ tipo: "apertura", estado: "rechazada" })]),
      cierre([], 1),
      cierre([propia({ tipo: "venta", estado: "rechazada" }), propia({ orden: 2 })]),
    ]) {
      expect(e.bloqueaCierre).toBe(true);
      expect(e.bloqueaEquipo).toBe(true);
    }
  });

  it("sin leer la cola bloquea el cierre; una rechazada de otro equipo no cuenta", () => {
    expect(resumirCola(null, ["n1"], "e1").bloqueaCierre).toBe(true);
    expect(resumirCola("error", ["n1"], "e1").bloqueaCierre).toBe(true);
    const e = cierre([fila({ estado: "rechazada" })]);
    expect(e.bloqueaCierre).toBe(false);
    expect(e.rechazadasEquipo.cantidad).toBe(0);
  });
});

describe("rechazadas de esta caja y de cajas anteriores", () => {
  const S1 = "b0000000-0000-4000-8000-000000000001";
  const S2 = "b0000000-0000-4000-8000-000000000002";
  const venta = (sesion: string, total: number, n: number) =>
    fila({
      orden: n,
      id: `a0000000-0000-4000-8000-00000000010${n}`,
      dispositivoId: "e1",
      estado: "rechazada",
      payload: {
        venta: {
          id: `a0000000-0000-4000-8000-00000000010${n}`,
          dispositivo_id: "a0000000-0000-4000-8000-000000000002",
          caja_sesion_id: sesion,
          numero: "C1-000001",
          cliente_id: null,
          creada_en_cliente: "2026-11-01T10:00:00Z",
          descuento: 0,
          total,
          pagos: [{ medio: "efectivo", monto: total }],
          items: [
            {
              producto_id: "a0000000-0000-4000-8000-000000000009",
              lista: "contado",
              cantidad: 1,
              precio_unitario: total,
              descuento: 0,
              serie_id: null,
            },
          ],
        },
        tipo_cambio: null,
      },
    });
  const movimiento = (sesion: string, n: number) =>
    fila({
      orden: n,
      id: `a0000000-0000-4000-8000-00000000020${n}`,
      tipo: "movimiento",
      dispositivoId: "e1",
      estado: "rechazada",
      payload: {
        id: `a0000000-0000-4000-8000-00000000020${n}`,
        sesion_id: sesion,
        tipo: "gasto",
        monto: 5,
        motivo: "x",
        creada_en: "2026-11-01T10:00:00Z",
      },
    });
  const filas = [venta(S1, 50, 1), venta(S2, 30, 2), movimiento(S2, 3), movimiento(S1, 4)];

  it("separa por sesión: cantidad y total son de la caja actual, el resto va a anteriores", () => {
    const e = resumirCola({ ...vacia, filas }, ["n1"], "e1", null, S2);
    expect(e.rechazadasEquipo).toEqual({ cantidad: 2, totalVentas: 30, anteriores: 2 });
    expect(e.bloqueaCierre).toBe(false);
  });

  it("sin caja abierta todo cuenta como anterior y el cierre sigue sin bloquearse", () => {
    const e = resumirCola({ ...vacia, filas }, ["n1"], "e1");
    expect(e.rechazadasEquipo).toEqual({ cantidad: 0, totalVentas: 0, anteriores: 4 });
    expect(e.bloqueaCierre).toBe(false);
  });
});

describe("conteo por tipo", () => {
  it("cuenta ventas, aperturas y movimientos pendientes y lista rechazadas de caja", () => {
    const e = resumirCola(
      {
        ...vacia,
        filas: [
          fila({ orden: 1, id: "a0000000-0000-4000-8000-000000000001" }),
          fila({ orden: 2, id: "a0000000-0000-4000-8000-000000000002", tipo: "apertura" }),
          fila({ orden: 3, id: "a0000000-0000-4000-8000-000000000003", tipo: "movimiento" }),
          fila({
            orden: 4,
            id: "a0000000-0000-4000-8000-000000000004",
            tipo: "apertura",
            estado: "rechazada",
            error: "x",
            payload: { id: "a0000000-0000-4000-8000-000000000004" },
          }),
        ],
      },
      ["n1"],
      "e1",
    );
    expect(e.pendientes).toEqual({ ventas: 1, aperturas: 1, movimientos: 1 });
    expect(e.rechazadas).toEqual([
      expect.objectContaining({ tipo: "apertura", titulo: "Apertura de caja", error: "x" }),
    ]);
  });
});
