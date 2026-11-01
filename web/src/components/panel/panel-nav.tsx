"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CircleDollarSign,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Lo incompleto no se muestra: solo rutas que existen. Cada módulo agrega la suya al entregarse.
// `permisos`: basta tener uno.
type Item = { href: string; etiqueta: string; icono: LucideIcon; permisos?: string[] };

export const ITEMS: Item[] = [
  { href: "/panel", etiqueta: "Inicio", icono: LayoutDashboard },
  { href: "/panel/usuarios", etiqueta: "Usuarios", icono: Users, permisos: ["usuarios"] },
  {
    href: "/panel/dispositivos",
    etiqueta: "Dispositivos",
    icono: MonitorSmartphone,
    permisos: ["usuarios"],
  },
  {
    href: "/panel/productos",
    etiqueta: "Productos",
    icono: Package,
    permisos: ["editar_productos", "ver_costos"],
  },
  {
    href: "/panel/precios",
    etiqueta: "Precios",
    icono: CircleDollarSign,
    permisos: ["editar_productos"],
  },
  {
    href: "/panel/tipo-cambio",
    etiqueta: "Tipo de cambio",
    icono: Banknote,
    permisos: ["editar_productos"],
  },
];

// Ruta de un ítem o de una pantalla suya (/panel/productos/nuevo cuenta como Productos). Inicio solo es exacto.
export const itemDeRuta = (ruta: string) =>
  ITEMS.filter(
    (i) => ruta === i.href || (i.href !== "/panel" && ruta.startsWith(`${i.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0];

// Ocultar es comodidad: cada página vuelve a exigir el permiso en el servidor.
export const itemsVisibles = (permisos: readonly string[]) =>
  ITEMS.filter((i) => !i.permisos || i.permisos.some((p) => permisos.includes(p)));

export function PanelNav({
  permisos,
  alNavegar,
}: {
  permisos: readonly string[];
  alNavegar: () => void;
}) {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {itemsVisibles(permisos).map(({ href, etiqueta, icono: Icono }) => {
        const activo = itemDeRuta(ruta)?.href === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={alNavegar}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] outline-none focus-visible:ring-3",
              activo && "bg-secondary text-secondary-foreground hover:bg-secondary font-semibold",
            )}
          >
            <Icono className="size-[17px]" aria-hidden />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
