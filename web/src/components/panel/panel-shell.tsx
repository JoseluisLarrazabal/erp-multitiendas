"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, ShoppingCart, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { ITEMS, PanelNav } from "./panel-nav";

type Props = {
  negocio: React.ReactNode;
  usuario: React.ReactNode;
  children: React.ReactNode;
};

export function PanelShell({ negocio, usuario, children }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  const titulo = ITEMS.find((i) => i.href === ruta)?.etiqueta ?? "Panel";

  const botonAbrir = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const estuvoAbierto = useRef(false);

  // Foco: al abrir entra al menú; al cerrar vuelve al botón que lo abrió.
  useEffect(() => {
    if (!abierto) {
      if (estuvoAbierto.current) botonAbrir.current?.focus();
      estuvoAbierto.current = false;
      return;
    }
    estuvoAbierto.current = true;
    // Mientras el panel entra deslizándose el navegador no acepta el foco; se reintenta frame a frame.
    let id = 0;
    let intentos = 0;
    const enfocar = () => {
      botonCerrar.current?.focus();
      if (document.activeElement !== botonCerrar.current && intentos++ < 30) {
        id = requestAnimationFrame(enfocar);
      }
    };
    enfocar();
    return () => cancelAnimationFrame(id);
  }, [abierto]);

  // Si se ensancha la ventana con el menú abierto, el fondo no debe quedar inerte.
  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const alCambiar = () => md.matches && setAbierto(false);
    md.addEventListener("change", alCambiar);
    return () => md.removeEventListener("change", alCambiar);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", alTecla);
    return () => document.removeEventListener("keydown", alTecla);
  }, [abierto]);

  return (
    <div className="flex min-h-dvh">
      {abierto && (
        <div
          className="bg-foreground/40 fixed inset-0 z-10 md:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}
      <aside
        id="menu-lateral"
        className={cn(
          "bg-card fixed inset-y-0 left-0 z-20 flex w-[248px] flex-col gap-6 border-r px-3.5 pt-5 pb-3.5 duration-200 md:visible md:sticky md:top-0 md:h-dvh md:translate-x-0",
          abierto
            ? "visible translate-x-0 transition-transform" // visible sin transición: así admite foco ya
            : "invisible -translate-x-full transition-[transform,visibility]",
        )}
      >
        <div className="flex items-center gap-2.5 px-2.5 text-[17px] font-bold tracking-tight">
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg">
            <Sparkles className="size-[17px]" aria-hidden />
          </span>
          <span className="flex-1 whitespace-nowrap">ERP Multitiendas</span>
          <Button
            variant="ghost"
            size="icon"
            ref={botonCerrar}
            className="size-10 md:hidden"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
          >
            <X aria-hidden />
          </Button>
        </div>
        {negocio}
        <PanelNav alNavegar={() => setAbierto(false)} />
        <div className="mt-auto flex flex-col gap-3">
          {/* <a>, no next/link: ir a /pos con navegación suave dejaría el service worker mal enlazado. */}
          <a
            href="/pos"
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] outline-none focus-visible:ring-3"
          >
            <ShoppingCart className="size-[17px]" aria-hidden />
            Punto de venta
          </a>
          {usuario}
        </div>
      </aside>
      <div className="min-w-0 flex-1" inert={abierto}>
        <header className="bg-card flex h-[70px] items-center gap-2 border-b px-4 md:px-10">
          <Button
            variant="ghost"
            size="icon"
            ref={botonAbrir}
            className="size-10 md:hidden"
            aria-label="Abrir menú"
            aria-expanded={abierto}
            aria-controls="menu-lateral"
            onClick={() => setAbierto(true)}
          >
            <Menu aria-hidden />
          </Button>
          <p className="text-muted-foreground text-xs">
            ERP Multitiendas / <strong className="text-foreground font-semibold">{titulo}</strong>
          </p>
        </header>
        <main className="mx-auto max-w-[1370px] px-4 pt-6 pb-10 md:px-10 md:pt-9">{children}</main>
      </div>
    </div>
  );
}
