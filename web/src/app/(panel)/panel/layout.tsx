import { PanelShell } from "@/components/panel/panel-shell";
import { BotonCerrarSesion, etiquetaRol, SelectorNegocio } from "@/modules/usuarios";
import { exigirPanel } from "@/modules/usuarios/panel";

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export default async function PanelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { usuario, negocios, activo, permisos } = await exigirPanel();
  return (
    <PanelShell
      permisos={permisos}
      negocio={<SelectorNegocio negocios={negocios} activoId={activo.negocioId} />}
      usuario={
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-2.5 px-1">
            <span
              aria-hidden
              className="bg-foreground text-background grid size-[30px] shrink-0 place-items-center rounded-full text-[10px] font-bold"
            >
              {iniciales(usuario.nombre)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs font-semibold">{usuario.nombre}</span>
              <span className="text-muted-foreground block text-[11px]">
                {etiquetaRol(activo.rol)}
              </span>
            </span>
          </div>
          <BotonCerrarSesion />
        </div>
      }
    >
      {children}
    </PanelShell>
  );
}
