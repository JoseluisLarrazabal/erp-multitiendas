import type { Metadata } from "next";
import Link from "next/link";
import { itemsVisibles } from "@/components/panel/panel-items";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { etiquetaRol } from "@/modules/usuarios";
import { exigirPanel } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Inicio · ERP Multitiendas" };

export default async function PanelInicio() {
  const { activo, permisos } = await exigirPanel();
  // Los mismos accesos que el menú; "Inicio" es esta página.
  const accesos = itemsVisibles(permisos, activo.tipo).filter((i) => i.href !== "/panel");

  return (
    <>
      <EncabezadoPagina
        titulo="Inicio"
        descripcion={`${activo.nombre} · ${etiquetaRol(activo.rol)}`}
      />
      <nav aria-label="Accesos">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map(({ href, etiqueta, icono: Icono }) => (
            <li key={href}>
              <Link
                href={href}
                className="bg-card hover:bg-muted focus-visible:ring-ring flex min-h-14 items-center gap-3 rounded-xl border p-4 text-sm font-semibold shadow-[0_2px_5px_#34345a0d] outline-none focus-visible:ring-3"
              >
                <span className="bg-secondary text-secondary-foreground grid size-9 place-items-center rounded-lg">
                  <Icono className="size-[18px]" aria-hidden />
                </span>
                {etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
