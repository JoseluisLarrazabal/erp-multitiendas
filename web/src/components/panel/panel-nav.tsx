"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MonitorSmartphone, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Lo incompleto no se muestra: solo rutas que existen. Cada módulo agrega la suya al entregarse.
type Item = { href: string; etiqueta: string; icono: LucideIcon; permiso?: string };

export const ITEMS: Item[] = [
  { href: "/panel", etiqueta: "Inicio", icono: LayoutDashboard },
  { href: "/panel/usuarios", etiqueta: "Usuarios", icono: Users, permiso: "usuarios" },
  {
    href: "/panel/dispositivos",
    etiqueta: "Dispositivos",
    icono: MonitorSmartphone,
    permiso: "usuarios",
  },
];

// Ocultar es comodidad: cada página vuelve a exigir el permiso en el servidor.
export const itemsVisibles = (permisos: readonly string[]) =>
  ITEMS.filter((i) => !i.permiso || permisos.includes(i.permiso));

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
        const activo = ruta === href;
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
