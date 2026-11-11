import {
  Banknote,
  Boxes,
  ChartColumn,
  CircleDollarSign,
  Contact,
  HandCoins,
  ShoppingCart,
  Truck,
  Landmark,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Percent,
  Receipt,
  Store,
  ScanSearch,
  Users,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";

// Lo incompleto no se muestra: solo rutas que existen. Cada módulo agrega la suya al entregarse.
// `permisos`: basta tener uno. `tipos`: solo en negocios de esos tipos (sin él, en todos).
export const GRUPOS = ["Ventas", "Inventario", "Compras", "Dinero", "Configuración"] as const;

export type Item = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  grupo?: (typeof GRUPOS)[number];
  permisos?: string[];
  tipos?: string[];
};

export const ITEMS: Item[] = [
  { href: "/panel", etiqueta: "Inicio", icono: LayoutDashboard },
  {
    href: "/panel/ventas",
    etiqueta: "Ventas",
    grupo: "Ventas",
    icono: Receipt,
    permisos: ["ver_reportes", "anular"],
  },
  {
    href: "/panel/reconciliacion",
    etiqueta: "Reconciliación",
    grupo: "Ventas",
    icono: ScanSearch,
    permisos: ["ver_reportes"],
  },
  {
    href: "/panel/clientes",
    etiqueta: "Clientes",
    grupo: "Ventas",
    icono: Contact,
    permisos: ["vender", "editar_productos"],
  },
  {
    href: "/panel/descuento",
    etiqueta: "Descuento",
    grupo: "Ventas",
    icono: Percent,
    permisos: ["usuarios"],
  },
  {
    href: "/panel/ordenes",
    etiqueta: "Órdenes",
    grupo: "Ventas",
    icono: WashingMachine,
    permisos: ["ver_reportes", "cambiar_estado_orden"],
    tipos: ["lavanderia"],
  },
  {
    href: "/panel/productos",
    etiqueta: "Productos",
    grupo: "Inventario",
    icono: Package,
    permisos: ["editar_productos", "ver_costos"],
  },
  {
    href: "/panel/inventario",
    etiqueta: "Inventario",
    grupo: "Inventario",
    icono: Boxes,
    permisos: ["ajustar_inventario", "ver_reportes"],
  },
  {
    href: "/panel/precios",
    etiqueta: "Precios",
    grupo: "Inventario",
    icono: CircleDollarSign,
    permisos: ["editar_productos"],
  },
  {
    href: "/panel/compras",
    etiqueta: "Compras",
    grupo: "Compras",
    icono: ShoppingCart,
    permisos: ["gestionar_compras"],
  },
  {
    href: "/panel/proveedores",
    etiqueta: "Proveedores",
    grupo: "Compras",
    icono: Truck,
    permisos: ["gestionar_compras"],
  },
  {
    href: "/panel/cajas",
    etiqueta: "Cajas",
    grupo: "Dinero",
    icono: Landmark,
    permisos: ["caja", "ver_reportes"],
  },
  {
    href: "/panel/creditos",
    etiqueta: "Créditos",
    grupo: "Dinero",
    icono: HandCoins,
    permisos: ["gestionar_credito", "ver_reportes"],
    tipos: ["tienda", "frial"],
  },
  {
    href: "/panel/tipo-cambio",
    etiqueta: "Tipo de cambio",
    grupo: "Dinero",
    icono: Banknote,
    permisos: ["editar_productos"],
  },
  {
    href: "/panel/reportes",
    etiqueta: "Reportes",
    grupo: "Dinero",
    icono: ChartColumn,
    permisos: ["ver_reportes"],
  },
  {
    href: "/panel/usuarios",
    etiqueta: "Usuarios",
    grupo: "Configuración",
    icono: Users,
    permisos: ["usuarios"],
  },
  {
    href: "/panel/dispositivos",
    etiqueta: "Dispositivos",
    grupo: "Configuración",
    icono: MonitorSmartphone,
    permisos: ["usuarios"],
  },
  {
    href: "/panel/negocio",
    etiqueta: "Datos del negocio",
    grupo: "Configuración",
    icono: Store,
    permisos: ["usuarios"],
  },
];

// Ruta de un ítem o de una pantalla suya (/panel/productos/nuevo cuenta como Productos). Inicio solo es exacto.
export const itemDeRuta = (ruta: string) =>
  ITEMS.filter(
    (i) => ruta === i.href || (i.href !== "/panel" && ruta.startsWith(`${i.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0];

// Ocultar es comodidad: cada página vuelve a exigir el permiso en el servidor.
export const itemsVisibles = (permisos: readonly string[], tipo: string) =>
  ITEMS.filter(
    (i) =>
      (!i.permisos || i.permisos.some((p) => permisos.includes(p))) &&
      (!i.tipos || i.tipos.includes(tipo)),
  );

// Agrupa para el menú; Inicio queda fuera. Un grupo sin ítems visibles no aparece.
export const gruposVisibles = (permisos: readonly string[], tipo: string) => {
  const v = itemsVisibles(permisos, tipo);
  return GRUPOS.map((grupo) => ({ grupo, items: v.filter((i) => i.grupo === grupo) })).filter(
    (g) => g.items.length,
  );
};
