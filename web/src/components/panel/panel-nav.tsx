"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { gruposVisibles, ITEMS, itemDeRuta, type Item } from "./panel-items";

// Se re-exportan para no tocar a quien ya importa desde aquí.
export { ITEMS, itemDeRuta, itemsVisibles, gruposVisibles } from "./panel-items";

const clase =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none focus-visible:ring-3";

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
  const actual = itemDeRuta(ruta)?.href;
  const enlace = ({ href, etiqueta, icono: Icono }: Item) => (
    <li key={href}>
      <Link
        href={href}
        onClick={alNavegar}
        aria-current={actual === href ? "page" : undefined}
        className={cn(
          clase,
          "group/item",
          actual === href &&
            "bg-secondary text-secondary-foreground hover:bg-secondary font-semibold",
        )}
      >
        <Icono className={cn("size-[17px]", actual === href && "text-primary")} aria-hidden />
        {etiqueta}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Principal" className="flex flex-col gap-4">
      <ul>{ITEMS.filter((i) => !i.grupo).map(enlace)}</ul>
      {gruposVisibles(permisos, tipo).map(({ grupo, items }) => (
        <div key={grupo} className="flex flex-col gap-1">
          <p id={`grupo-${grupo}`} className="text-muted-foreground px-3 text-xs font-semibold">
            {grupo}
          </p>
          <ul aria-labelledby={`grupo-${grupo}`}>{items.map(enlace)}</ul>
        </div>
      ))}
    </nav>
  );
}
