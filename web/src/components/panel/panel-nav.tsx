"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

// Lo incompleto no se muestra: solo rutas que existen. Cada módulo agrega la suya al entregarse.
export const ITEMS = [{ href: "/panel", etiqueta: "Inicio", icono: LayoutDashboard }];

export function PanelNav({ alNavegar }: { alNavegar: () => void }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, etiqueta, icono: Icono }) => {
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
