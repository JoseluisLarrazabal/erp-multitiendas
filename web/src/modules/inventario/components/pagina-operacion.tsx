import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EncabezadoPagina } from "@/modules/catalogo/panel";
import type { Resultado } from "@/modules/usuarios";
import type { Ubicacion } from "../domain";

// Armazón de las páginas de operación (entrada, salida, traslado, conteo): encabezado, vuelta al inventario y los
// estados de ubicaciones (error, ninguna, pocas) antes de mostrar el formulario.
export function PaginaOperacion({
  titulo,
  descripcion,
  ubicaciones,
  minimo = 1,
  children,
}: {
  titulo: string;
  descripcion: string;
  ubicaciones: Resultado<Ubicacion[]>;
  // Ubicaciones que hacen falta para operar (el traslado necesita 2).
  minimo?: number;
  children: (ubicaciones: readonly Ubicacion[]) => React.ReactNode;
}) {
  const tarjeta = "text-muted-foreground bg-card rounded-xl border p-6 text-sm";
  return (
    <>
      <EncabezadoPagina
        titulo={titulo}
        descripcion={descripcion}
        acciones={
          <Link
            href="/panel/inventario"
            className={buttonVariants({ variant: "outline", className: "h-10" })}
          >
            <ArrowLeft aria-hidden /> Inventario
          </Link>
        }
      />
      {!ubicaciones.ok && (
        <p role="alert" className="text-destructive text-sm">
          {ubicaciones.error}
        </p>
      )}
      {ubicaciones.ok && ubicaciones.data.length === 0 && (
        <p className={tarjeta}>Este negocio no tiene ubicaciones. Se crean por script o seed.</p>
      )}
      {ubicaciones.ok && ubicaciones.data.length > 0 && ubicaciones.data.length < minimo && (
        <p className={tarjeta}>Hace falta al menos {minimo} ubicaciones para esta operación.</p>
      )}
      {ubicaciones.ok &&
        ubicaciones.data.length >= Math.max(minimo, 1) &&
        children(ubicaciones.data)}
    </>
  );
}
