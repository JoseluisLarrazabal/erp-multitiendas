import { describe, expect, it } from "vitest";
import {
  exigeCliente,
  lineaIgual,
  lineasNoVendibles,
  motivoBloqueo,
  reducirCarrito,
  resumirCarrito,
  sinPrecioEn,
  type Linea,
} from "./carrito";
import type { ProductoPos } from "./domain";

const producto = (extra: Partial<ProductoPos> = {}): ProductoPos => ({
  id: "p1",
  codigo: "A",
  codigoBarras: null,
  nombre: "Funda",
  unidad: "unidad",
  tipo: "producto",
  controlaSerie: false,
  garantiaMeses: null,
  precios: { contado: 4000, mayorista: 3600, minimo: 3200, normal: null, express: null },
  stockPorUbicacion: {},
  stockTotal: 0,
  ...extra,
});
const sinPermiso = { puedeDescontar: false, tope: 0 };
const conPermiso = { puedeDescontar: true, tope: 10 };

describe("carrito", () => {
  it("agregar dos veces el mismo producto suma cantidad; con serie, una línea por unidad", () => {
    let c: Linea[] = [];
    c = reducirCarrito(c, { tipo: "agregar", producto: producto(), id: "l1" });
    c = reducirCarrito(c, { tipo: "agregar", producto: producto(), id: "l2" });
    expect(c).toHaveLength(1);
    expect(c[0]?.cantidadTexto).toBe("2");
    const s = producto({ id: "s", controlaSerie: true });
    c = reducirCarrito(c, { tipo: "agregar", producto: s, id: "l3" });
    c = reducirCarrito(c, { tipo: "agregar", producto: s, id: "l4" });
    expect(c).toHaveLength(3);
  });
  it("una línea de reserva (precioFijo) no se bloquea bajo el mínimo y sin permiso", () => {
    let c = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    c = reducirCarrito(c, {
      tipo: "cambiar",
      id: "l1",
      cambios: { precioTexto: "31", precioFijo: true },
    });
    const r = resumirCarrito(c, "", sinPermiso);
    expect(r.error).toBeNull();
    expect(r.totales?.total).toBe(3100);
  });
  it("una línea de reserva no absorbe el mismo producto y el catálogo nuevo no la toca", () => {
    let c = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    c = reducirCarrito(c, {
      tipo: "cambiar",
      id: "l1",
      cambios: { precioTexto: "31", cantidadTexto: "5", precioFijo: true },
    });
    expect(lineaIgual(c, producto())).toBeNull();
    const nuevo = producto({ precios: { ...producto().precios, contado: 9900 } });
    const r = reducirCarrito(c, { tipo: "reemplazar", productos: new Map([["p1", nuevo]]) });
    expect(r).toEqual(c);
    const fuera = reducirCarrito(c, { tipo: "reemplazar", productos: new Map() });
    expect(fuera).toHaveLength(1);
  });
  it("sin permiso: entre piso y lista pasa; bajo el piso o con descuento se bloquea", () => {
    let c = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    c = reducirCarrito(c, { tipo: "cambiar", id: "l1", cambios: { precioTexto: "35" } });
    expect(resumirCarrito(c, "", sinPermiso).error).toBeNull();
    c = reducirCarrito(c, { tipo: "cambiar", id: "l1", cambios: { precioTexto: "31" } });
    expect(resumirCarrito(c, "", sinPermiso).error).toMatch(/encargado/);
    c = reducirCarrito(c, {
      tipo: "cambiar",
      id: "l1",
      cambios: { precioTexto: "40", descuentoTexto: "1" },
    });
    expect(resumirCarrito(c, "", sinPermiso).error).toMatch(/encargado/);
    expect(resumirCarrito(c, "", conPermiso).error).toBeNull();
  });
  it("con permiso pero tope 0 no hay descuento", () => {
    const c = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    const d = reducirCarrito(c, { tipo: "cambiar", id: "l1", cambios: { descuentoTexto: "1" } });
    expect(resumirCarrito(d, "", { puedeDescontar: true, tope: 0 }).error).toMatch(/encargado/);
  });
  it("descuento sobre el tope se bloquea", () => {
    let c = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    c = reducirCarrito(c, { tipo: "cambiar", id: "l1", cambios: { descuentoTexto: "5" } }); // 12,5 % de 40
    expect(resumirCarrito(c, "", conPermiso).error).toMatch(/tope/);
    c = reducirCarrito(c, { tipo: "cambiar", id: "l1", cambios: { descuentoTexto: "4" } });
    expect(resumirCarrito(c, "", conPermiso).totales?.total).toBe(3600);
  });
  it("serie obligatoria y cantidad entera en unidad", () => {
    let c = reducirCarrito([], {
      tipo: "agregar",
      producto: producto({ controlaSerie: true }),
      id: "l1",
    });
    expect(resumirCarrito(c, "", sinPermiso).error).toBe("Elige la serie");
    c = reducirCarrito(c, {
      tipo: "cambiar",
      id: "l1",
      cambios: { serieId: "s1", cantidadTexto: "1,5" },
    });
    expect(resumirCarrito(c, "", sinPermiso).error).toMatch(/entera/);
  });
  it("catálogo recargado: la línea toma el precio nuevo", () => {
    let c = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    const nuevo = producto({
      precios: { contado: 5000, mayorista: null, minimo: null, normal: null, express: null },
    });
    c = reducirCarrito(c, { tipo: "reemplazar", productos: new Map([["p1", nuevo]]) });
    expect(resumirCarrito(c, "", sinPermiso).totales?.total).toBe(5000);
  });
  it("catálogo recargado: precio editado y descuento se conservan; el sin tocar sigue a la lista", () => {
    const base = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    const editado = reducirCarrito(base, {
      tipo: "cambiar",
      id: "l1",
      cambios: { precioTexto: "35,00", descuentoTexto: "1,00" },
    });
    const nuevo = producto({
      precios: { contado: 5000, mayorista: 3600, minimo: 3200, normal: null, express: null },
    });
    const mapa = new Map([["p1", nuevo]]);
    const r = reducirCarrito(editado, { tipo: "reemplazar", productos: mapa });
    expect(r[0]).toMatchObject({ precioTexto: "35,00", descuentoTexto: "1,00" });
    expect(reducirCarrito(base, { tipo: "reemplazar", productos: mapa })[0]?.precioTexto).toBe(
      "50,00",
    );
  });
  it("catálogo recargado: lista sin precio vuelve a contado, también en `lista`", () => {
    let c = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
    c = reducirCarrito(c, { tipo: "lista", id: "l1", lista: "mayorista" });
    const nuevo = producto({
      precios: { contado: 4000, mayorista: null, minimo: 3200, normal: null, express: null },
    });
    c = reducirCarrito(c, { tipo: "reemplazar", productos: new Map([["p1", nuevo]]) });
    expect(c[0]).toMatchObject({ lista: "contado", precioTexto: "40,00" });
  });
  it("catálogo recargado: se quita la línea del producto que salió o perdió el precio de contado", () => {
    const c = reducirCarrito(
      reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" }),
      { tipo: "agregar", producto: producto({ id: "p2", nombre: "Cable" }), id: "l2" },
    );
    const sinPrecio = producto({
      id: "p2",
      nombre: "Cable",
      precios: { contado: null, mayorista: 100, minimo: null, normal: null, express: null },
    });
    const mapa = new Map([["p2", sinPrecio]]);
    expect(lineasNoVendibles(c, mapa)).toEqual(["Funda", "Cable"]);
    expect(reducirCarrito(c, { tipo: "reemplazar", productos: mapa })).toHaveLength(0);
  });
});

describe("lavandería: lista normal o express", () => {
  const servicio = producto({
    id: "s1",
    tipo: "servicio",
    precios: { contado: null, mayorista: null, minimo: null, normal: 1500, express: 2500 },
  });
  const agregar = (lista: "normal" | "express") =>
    reducirCarrito([], { tipo: "agregar", producto: servicio, id: "l1", lista });
  it("agrega con el precio de la lista y suma solo líneas de la misma lista", () => {
    let c = agregar("normal");
    expect(c[0]).toMatchObject({ lista: "normal", precioTexto: "15,00" });
    c = reducirCarrito(c, { tipo: "agregar", producto: servicio, id: "l2", lista: "normal" });
    expect(c).toHaveLength(1);
    expect(c[0]?.cantidadTexto).toBe("2");
  });
  it("listaTodas cambia lista y precio de todas las líneas", () => {
    const c = reducirCarrito(agregar("normal"), { tipo: "listaTodas", lista: "express" });
    expect(c[0]).toMatchObject({ lista: "express", precioTexto: "25,00" });
    expect(resumirCarrito(c, "", sinPermiso).totales?.total).toBe(2500);
  });
  it("sinPrecioEn nombra los productos sin precio en la lista", () => {
    const sinExpress = { ...servicio, precios: { ...servicio.precios, express: null } };
    const c = reducirCarrito([], {
      tipo: "agregar",
      producto: sinExpress,
      id: "l1",
      lista: "normal",
    });
    expect(sinPrecioEn(c, "express")).toEqual([sinExpress.nombre]);
    expect(sinPrecioEn(c, "normal")).toEqual([]);
  });
  it("el catálogo recargado no quita un servicio que solo tiene normal y express", () => {
    const c = agregar("express");
    expect(lineasNoVendibles(c, new Map([["s1", servicio]]))).toEqual([]);
    expect(
      reducirCarrito(c, { tipo: "reemplazar", productos: new Map([["s1", servicio]]) }),
    ).toHaveLength(1);
    const sinExpress = { ...servicio, precios: { ...servicio.precios, express: null } };
    expect(lineasNoVendibles(c, new Map([["s1", sinExpress]]))).toEqual([servicio.nombre]);
  });
});

describe("cliente obligatorio (RF-VEN-04)", () => {
  const llena = reducirCarrito([], { tipo: "agregar", producto: producto(), id: "l1" });
  const resumen = resumirCarrito(llena, "", sinPermiso);
  it("solo la lavandería lo exige", () => {
    expect(exigeCliente("lavanderia")).toBe(true);
    expect(exigeCliente("tienda")).toBe(false);
    expect(exigeCliente("frial")).toBe(false);
  });
  it("sin cliente en lavandería el cobro dice por qué; con cliente o en tienda, no", () => {
    const o = { cajaAbierta: true, clienteObligatorio: true, hayCliente: false };
    expect(motivoBloqueo(resumen, o)).toBe("Esta venta necesita un cliente.");
    expect(motivoBloqueo(resumen, { ...o, hayCliente: true })).toBeNull();
    expect(motivoBloqueo(resumen, { ...o, clienteObligatorio: false })).toBeNull();
  });
  it("carrito vacío no dice nada; sin caja pide abrirla", () => {
    const vacio = resumirCarrito([], "", sinPermiso);
    const o = { cajaAbierta: true, clienteObligatorio: true, hayCliente: false };
    expect(motivoBloqueo(vacio, o)).toBeNull();
    expect(motivoBloqueo(resumen, { ...o, cajaAbierta: false })).toMatch(/caja/);
  });
});
