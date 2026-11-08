import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { itemsVisibles } from "@/components/panel/panel-items";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import { createClient } from "@/lib/supabase/server";
import { etiquetaRol } from "@/modules/usuarios";
import { exigirPanel } from "@/modules/usuarios/panel";
import {
  listarReconciliacion,
  PAGINA_RECONCILIACION,
  textoPorRevisar,
} from "@/modules/ventas/panel";

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
      {/* Mismo permiso que /panel/reconciliacion; no frena los accesos mientras se cuenta. */}
      {permisos.includes("ver_reportes") && (
        <Suspense fallback={null}>
          <AvisoPorRevisar negocioId={activo.negocioId} />
        </Suspense>
      )}
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

// Si la lectura falla no se avisa: /panel/reconciliacion muestra el error.
async function AvisoPorRevisar({ negocioId }: { negocioId: string }) {
  const r = await listarReconciliacion(
    await createClient(),
    negocioId,
    null,
    PAGINA_RECONCILIACION,
  );
  if (!r.ok) return null;
  const aviso = textoPorRevisar(
    r.data.filas.filter((f) => !f.revisada).length,
    r.data.siguiente !== null,
  );
  if (!aviso) return null;
  return (
    <Link
      href="/panel/reconciliacion"
      data-testid="aviso-por-revisar"
      className="bg-card hover:bg-muted focus-visible:ring-ring mb-4 flex min-h-12 items-center gap-3 rounded-xl border border-amber-500/60 p-4 text-sm font-semibold outline-none focus-visible:ring-3"
    >
      <TriangleAlert className="size-[18px]" aria-hidden />
      {aviso}
    </Link>
  );
}
