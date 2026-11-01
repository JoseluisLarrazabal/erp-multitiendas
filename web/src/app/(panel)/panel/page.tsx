import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { etiquetaRol } from "@/modules/usuarios";
import { exigirPanel } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Inicio · ERP Multitiendas" };

export default async function PanelInicio() {
  const { activo } = await exigirPanel();

  return (
    <>
      <div className="mb-7">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Inicio</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {activo.nombre} · {etiquetaRol(activo.rol)}
        </p>
      </div>
      <section className="bg-card flex flex-col items-start gap-3 rounded-xl border p-6 shadow-[0_2px_5px_#34345a0d]">
        <span className="bg-secondary text-secondary-foreground grid size-9 place-items-center rounded-lg">
          <Boxes className="size-[18px]" aria-hidden />
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight">Todavía no hay módulos activos</h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Aquí aparecerán los resúmenes del negocio cuando se habiliten los módulos de ventas,
          inventario y reportes. Por ahora puedes cambiar de negocio y abrir el punto de venta.
        </p>
      </section>
    </>
  );
}
