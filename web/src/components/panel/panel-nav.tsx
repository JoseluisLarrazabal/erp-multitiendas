"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { itemDeRuta, itemsVisibles } from "./panel-items";

// Se re-exportan para no tocar a quien ya importa desde aquí.
export { ITEMS, itemDeRuta, itemsVisibles } from "./panel-items";

export function PanelNav({
  permisos,
  tipo,
  alNavegar,
}: {
  permisos: readonly string[];
  tipo: string;
  alNavegar: () => void;
}) {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {itemsVisibles(permisos, tipo).map(({ href, etiqueta, icono: Icono }) => {
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
