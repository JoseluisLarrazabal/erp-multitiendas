import { describe, expect, it } from "vitest";
import { itemDeRuta, itemsVisibles } from "./panel-nav";

const etiquetas = (permisos: string[]) => itemsVisibles(permisos).map((i) => i.etiqueta);

describe("itemsVisibles", () => {
  it("un ítem con varios permisos se ve con cualquiera de ellos", () => {
    expect(etiquetas(["ver_costos"])).toContain("Productos");
    expect(etiquetas(["editar_productos"])).toContain("Productos");
  });
  it("Precios y Tipo de cambio exigen editar_productos; un contador no los ve", () => {
    const contador = etiquetas(["ver_reportes", "ver_costos"]);
    expect(contador).not.toContain("Precios");
    expect(contador).not.toContain("Tipo de cambio");
    expect(etiquetas(["editar_productos"])).toEqual(
      expect.arrayContaining(["Precios", "Tipo de cambio"]),
    );
  });
  it("Inventario se ve con ajustar_inventario o ver_reportes, y no sin ellos", () => {
    expect(etiquetas(["ajustar_inventario"])).toContain("Inventario");
    expect(etiquetas(["ver_reportes"])).toContain("Inventario");
    expect(etiquetas(["editar_productos", "ver_costos"])).not.toContain("Inventario");
  });
  it("Usuarios sigue pidiendo `usuarios`", () => {
    expect(etiquetas(["editar_productos"])).not.toContain("Usuarios");
    expect(etiquetas(["usuarios"])).toContain("Usuarios");
  });
});

describe("ítems de la fase 2", () => {
  it("Ventas: ver_reportes o anular", () => {
    expect(etiquetas(["ver_reportes"])).toContain("Ventas");
    expect(etiquetas(["anular"])).toContain("Ventas");
    expect(etiquetas(["editar_productos"])).not.toContain("Ventas");
  });
  it("Cajas: caja o ver_reportes; un contador la ve, un encargado de solo ajustes no", () => {
    expect(etiquetas(["caja"])).toContain("Cajas");
    expect(etiquetas(["ver_reportes", "ver_costos"])).toContain("Cajas");
    expect(etiquetas(["ajustar_inventario"])).not.toContain("Cajas");
  });
  it("Clientes: vender o editar_productos; Descuento: solo usuarios", () => {
    expect(etiquetas(["vender"])).toContain("Clientes");
    expect(etiquetas(["editar_productos"])).toContain("Clientes");
    expect(etiquetas(["ver_reportes"])).not.toContain("Clientes");
    expect(etiquetas(["editar_productos"])).not.toContain("Descuento");
    expect(etiquetas(["usuarios"])).toContain("Descuento");
  });
});

describe("itemDeRuta", () => {
  it("una pantalla hija cuenta como su ítem; Inicio solo es exacto", () => {
    expect(itemDeRuta("/panel/productos/nuevo")?.etiqueta).toBe("Productos");
    expect(itemDeRuta("/panel/productos")?.etiqueta).toBe("Productos");
    expect(itemDeRuta("/panel/inventario/entrada")?.etiqueta).toBe("Inventario");
    expect(itemDeRuta("/panel/inventario/e0000000-0000-0000-0000-000000000001")?.etiqueta).toBe(
      "Inventario",
    );
    expect(itemDeRuta("/panel/ventas/e0000000-0000-0000-0000-000000000001")?.etiqueta).toBe(
      "Ventas",
    );
    expect(itemDeRuta("/panel/cajas/e0000000-0000-0000-0000-000000000001")?.etiqueta).toBe("Cajas");
    expect(itemDeRuta("/panel")?.etiqueta).toBe("Inicio");
    expect(itemDeRuta("/panel/otra")).toBeUndefined();
  });
});
