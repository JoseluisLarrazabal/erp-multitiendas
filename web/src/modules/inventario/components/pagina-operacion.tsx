import { EstadoVacio } from "@/components/ui/estado-vacio";
import { EncabezadoPagina, EnlaceVolver } from "@/modules/catalogo/panel";
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
  return (
    <>
      <EncabezadoPagina
        titulo={titulo}
        descripcion={descripcion}
        acciones={<EnlaceVolver href="/panel/inventario">Inventario</EnlaceVolver>}
      />
      {!ubicaciones.ok && (
        <p role="alert" className="text-destructive text-sm">
          {ubicaciones.error}
        </p>
      )}
      {ubicaciones.ok && ubicaciones.data.length === 0 && (
        <EstadoVacio>Este negocio no tiene ubicaciones. Se crean por script o seed.</EstadoVacio>
      )}
      {ubicaciones.ok && ubicaciones.data.length > 0 && ubicaciones.data.length < minimo && (
        <EstadoVacio>Hace falta al menos {minimo} ubicaciones para esta operación.</EstadoVacio>
      )}
      {ubicaciones.ok &&
        ubicaciones.data.length >= Math.max(minimo, 1) &&
        children(ubicaciones.data)}
    </>
  );
}
