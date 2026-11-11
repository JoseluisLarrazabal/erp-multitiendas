import { describe, expect, it } from "vitest";
import {
  accionesDeFila,
  codigoDeMensaje,
  conservarLista,
  destinoInicial,
  detalleDeError,
  elegirNegocioActivo,
  MENSAJES_ERROR,
  negocioDeRecheck,
  mensajeDeError,
  rolesOfrecidos,
  tieneAccesoPanel,
  type FilaUsuario,
  type NegocioUsuario,
} from "./domain";

const a: NegocioUsuario = { negocioId: "a", nombre: "A", tipo: "tienda", rol: "dueno" };
const b: NegocioUsuario = { negocioId: "b", nombre: "B", tipo: "frial", rol: "dueno" };

describe("elegirNegocioActivo", () => {
  it("usa la preferencia si es un negocio del usuario", () => {
    expect(elegirNegocioActivo([a, b], "b")).toBe(b);
  });
  it("cae al primero si la cookie es ajena, vacía o forjada", () => {
    expect(elegirNegocioActivo([a, b], "otro")).toBe(a);
    expect(elegirNegocioActivo([a, b], undefined)).toBe(a);
  });
  it("devuelve null sin negocios", () => {
    expect(elegirNegocioActivo([], "a")).toBeNull();
  });
});

describe("destinoInicial", () => {
  it("manda al panel con ver_reportes, editar_productos o usuarios", () => {
    for (const p of ["ver_reportes", "editar_productos", "usuarios"]) {
      expect(tieneAccesoPanel([p])).toBe(true);
      expect(destinoInicial(a, ["vender", p])).toBe("/panel");
    }
  });
  it("manda al POS al resto y a sin-acceso sin negocio", () => {
    expect(destinoInicial(a, ["vender", "caja"])).toBe("/pos");
    expect(destinoInicial(null, [])).toBe("/sin-acceso");
  });
});

const fila = (extra: Partial<FilaUsuario> = {}): FilaUsuario => ({
  usuarioId: "u",
  nombre: "Ana",
  rol: "vendedor",
  activo: true,
  esYo: false,
  puedeAdministrar: true,
  puedeRestablecer: true,
  ...extra,
});

describe("accionesDeFila", () => {
  it("mi fila no tiene acciones", () => {
    expect(Object.values(accionesDeFila(fila({ esYo: true }), true)).some(Boolean)).toBe(false);
  });
  it("una fila dueño no tiene acciones si no soy dueño", () => {
    const f = fila({ rol: "dueno" });
    expect(Object.values(accionesDeFila(f, false)).some(Boolean)).toBe(false);
    expect(accionesDeFila(f, true).quitar).toBe(true);
  });
  it("una fila encargado no tiene acciones si no soy dueño", () => {
    const f = fila({ rol: "encargado" });
    expect(Object.values(accionesDeFila(f, false)).some(Boolean)).toBe(false);
    expect(accionesDeFila(f, true).quitar).toBe(true);
  });
  it("desactivar y reactivar dependen del estado y de puede_administrar_cuenta", () => {
    expect(accionesDeFila(fila(), false)).toMatchObject({ desactivar: true, reactivar: false });
    expect(accionesDeFila(fila({ activo: false }), false)).toMatchObject({
      desactivar: false,
      reactivar: true,
    });
    expect(accionesDeFila(fila({ puedeAdministrar: false }), false)).toMatchObject({
      cambiarRol: true,
      desactivar: false,
      reactivar: false,
    });
  });
});

describe("restablecer", () => {
  it("depende de puede_restablecer_clave, no de puede_administrar_cuenta", () => {
    expect(accionesDeFila(fila({ puedeRestablecer: false }), false).restablecer).toBe(false);
    expect(accionesDeFila(fila({ puedeRestablecer: true }), false).restablecer).toBe(true);
  });
});

describe("rolesOfrecidos", () => {
  const roles = ["empleado", "dueno", "encargado"];
  it("ofrece dueno y encargado solo a un dueño y respeta el orden", () => {
    expect(rolesOfrecidos(roles, false)).toEqual(["empleado"]);
    expect(rolesOfrecidos(roles, true)).toEqual(["dueno", "encargado", "empleado"]);
  });
});

describe("errores ERP_*", () => {
  it("todo código traducible tiene mensaje en español y lo desconocido cae al genérico", () => {
    for (const c of Object.keys(MENSAJES_ERROR)) expect(mensajeDeError(c)).not.toBe("");
    expect(mensajeDeError("ERP_CORREO_EXISTE")).toMatch(/correo/);
    expect(mensajeDeError("ERP_NUEVO")).toBe(MENSAJES_ERROR.ERP_INTERNO);
    expect(mensajeDeError(undefined)).toBe(MENSAJES_ERROR.ERP_INTERNO);
  });
  it("extrae el código del texto de Postgres", () => {
    expect(codigoDeMensaje("ERP_PREFIJO_DUPLICADO")).toBe("ERP_PREFIJO_DUPLICADO");
    expect(codigoDeMensaje("otra cosa")).toBeUndefined();
  });
});

describe("detalleDeError", () => {
  it("vacío con código ERP_*, o sin error", () => {
    expect(detalleDeError({ message: "ERP_SIN_PERMISO", code: "P0001" })).toEqual({});
    expect(detalleDeError(null)).toEqual({});
  });
  it("sin código ERP_* devuelve pg y detalle recortado a 300", () => {
    expect(detalleDeError({ message: "boom", code: "23505" })).toEqual({
      pg: "23505",
      detalle: "boom",
    });
    expect(detalleDeError({ code: "X" })).toEqual({ pg: "X", detalle: "sin mensaje" });
    expect(detalleDeError({ message: "a".repeat(500) }).detalle).toHaveLength(300);
  });
});

describe("negocioDeRecheck", () => {
  it("conserva el negocio en pantalla aunque la cookie diga otro", () => {
    expect(negocioDeRecheck([a, b], "b", "a")).toBe(b);
  });
  it("si el activo ya no es del usuario, o aún no hay, usa la cookie", () => {
    expect(negocioDeRecheck([a, b], "z", "b")).toBe(b);
    expect(negocioDeRecheck([a, b], null, "b")).toBe(b);
    expect(negocioDeRecheck([], "a", "a")).toBeNull();
  });
});

describe("conservarLista", () => {
  const lista = { fase: "lista", id: 1 };
  it("un fallo de fondo no saca una sesión lista", () => {
    expect(conservarLista(lista, { fase: "error", id: 2 })).toBe(lista);
    expect(conservarLista(lista, { fase: "sin-conexion", id: 2 })).toBe(lista);
  });
  it("una sesión lista nueva sí reemplaza, y fuera de lista todo cambia", () => {
    const nueva = { fase: "lista", id: 3 };
    expect(conservarLista(lista, nueva)).toBe(nueva);
    const error = { fase: "error", id: 0 };
    expect(conservarLista({ fase: "verificando", id: 0 }, error)).toBe(error);
  });
});
