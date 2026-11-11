import { describe, expect, it } from "vitest";
import { ITEMS, gruposVisibles, itemDeRuta, itemsVisibles } from "./panel-nav";

const etiquetas = (permisos: string[], tipo = "tienda") =>
  itemsVisibles(permisos, tipo).map((i) => i.etiqueta);

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
    expect(etiquetas(["editar_productos"])).not.toContain("Datos del negocio");
    expect(etiquetas(["usuarios"])).toContain("Datos del negocio");
  });
});

describe("Reportes (fase 5)", () => {
  it("se ve con ver_reportes y no sin él", () => {
    expect(etiquetas(["ver_reportes"])).toContain("Reportes");
    expect(etiquetas(["vender", "caja"])).not.toContain("Reportes");
    expect(itemDeRuta("/panel/reportes")?.etiqueta).toBe("Reportes");
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

describe("Reconciliación", () => {
  it("solo con ver_reportes", () => {
    expect(etiquetas(["ver_reportes"])).toContain("Reconciliación");
    expect(etiquetas(["anular", "caja", "ajustar_inventario"])).not.toContain("Reconciliación");
  });
});

describe("Órdenes", () => {
  it("solo en lavandería, con ver_reportes o cambiar_estado_orden", () => {
    expect(etiquetas(["ver_reportes"], "lavanderia")).toContain("Órdenes");
    expect(etiquetas(["cambiar_estado_orden"], "lavanderia")).toContain("Órdenes");
    expect(etiquetas(["vender"], "lavanderia")).not.toContain("Órdenes");
    expect(etiquetas(["ver_reportes"], "tienda")).not.toContain("Órdenes");
    expect(etiquetas(["ver_reportes"], "frial")).not.toContain("Órdenes");
  });
  it("un ítem sin `tipos` se ve en cualquier negocio", () => {
    expect(etiquetas(["ver_reportes"], "lavanderia")).toContain("Ventas");
  });
});

describe("gruposVisibles", () => {
  const conjuntos = [
    [],
    ["ver_reportes"],
    ["vender", "caja"],
    ["editar_productos", "ver_costos"],
    ["usuarios", "gestionar_compras", "gestionar_credito"],
    ITEMS.flatMap((i) => i.permisos ?? []),
  ];
  const tipos = ["tienda", "frial", "lavanderia"];

  it("todo ítem salvo Inicio tiene grupo", () => {
    expect(ITEMS.filter((i) => !i.grupo).map((i) => i.href)).toEqual(["/panel"]);
  });
  it("agrupar no cambia qué ve cada rol: los grupos más Inicio son itemsVisibles", () => {
    for (const permisos of conjuntos) {
      for (const tipo of tipos) {
        const agrupados = gruposVisibles(permisos, tipo).flatMap((g) => g.items.map((i) => i.href));
        const esperado = itemsVisibles(permisos, tipo)
          .map((i) => i.href)
          .filter((h) => h !== "/panel");
        expect(agrupados.sort()).toEqual(esperado.sort());
      }
    }
  });
  it("un grupo sin ítems no aparece", () => {
    expect(gruposVisibles([], "tienda")).toEqual([]);
    expect(gruposVisibles(["usuarios"], "tienda").map((g) => g.grupo)).toEqual([
      "Ventas",
      "Configuración",
    ]);
  });
  it("dentro de cada grupo el orden es el del diseño", () => {
    const todos = ITEMS.flatMap((i) => i.permisos ?? []);
    const orden = Object.fromEntries(
      gruposVisibles(todos, "lavanderia").map((g) => [g.grupo, g.items.map((i) => i.etiqueta)]),
    );
    expect(orden).toEqual({
      Ventas: ["Ventas", "Reconciliación", "Clientes", "Descuento", "Órdenes"],
      Inventario: ["Productos", "Inventario", "Precios"],
      Compras: ["Compras", "Proveedores"],
      Dinero: ["Cajas", "Tipo de cambio", "Reportes"],
      Configuración: ["Usuarios", "Dispositivos", "Datos del negocio"],
    });
    expect(
      gruposVisibles(todos, "tienda")
        .find((g) => g.grupo === "Dinero")!
        .items.map((i) => i.etiqueta),
    ).toEqual(["Cajas", "Créditos", "Tipo de cambio", "Reportes"]);
  });
});
