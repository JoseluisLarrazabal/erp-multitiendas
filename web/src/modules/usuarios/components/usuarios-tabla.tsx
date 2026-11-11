import { etiquetaRol, accionesDeFila, type FilaUsuario } from "../domain";
import { Etiqueta } from "@/components/ui/etiqueta";
import { AccionesFila } from "./acciones-fila";
import { CambiarRol } from "./cambiar-rol";

type Props = {
  filas: readonly FilaUsuario[];
  negocioId: string;
  negocioNombre: string;
  roles: readonly string[];
  llamadorEsDueno: boolean;
};

// Tabla en escritorio; en móvil cada fila se apila como tarjeta.
export function UsuariosTabla({ filas, negocioId, negocioNombre, roles, llamadorEsDueno }: Props) {
  return (
    <div>
      <table role="table" className="w-full text-sm">
        <caption className="sr-only">Personal de {negocioNombre}</caption>
        <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
          <tr
            role="row"
            className="text-muted-foreground border-foreground border-b-2 text-left text-[13px]"
          >
            <th
              scope="col"
              role="columnheader"
              className="h-10 px-3 font-semibold first:pl-0 last:pr-0"
            >
              Nombre
            </th>
            <th
              scope="col"
              role="columnheader"
              className="h-10 px-3 font-semibold first:pl-0 last:pr-0"
            >
              Rol
            </th>
            <th
              scope="col"
              role="columnheader"
              className="h-10 px-3 font-semibold first:pl-0 last:pr-0"
            >
              Estado
            </th>
            <th
              scope="col"
              role="columnheader"
              className="h-10 px-3 font-semibold first:pl-0 last:pr-0"
            >
              Acciones
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="block md:table-row-group">
          {filas.map((fila) => {
            const acciones = accionesDeFila(fila, llamadorEsDueno);
            const hayAcciones = Object.values(acciones).some(Boolean);
            return (
              <tr
                key={fila.usuarioId}
                role="row"
                className="hover:bg-surface grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 border-b py-3 md:table-row"
              >
                <th
                  scope="row"
                  role="rowheader"
                  className="min-w-0 text-left font-semibold md:table-cell md:h-11 md:px-3 md:py-1.5 md:first:pl-0 md:last:pr-0"
                >
                  <span className="block truncate">{fila.nombre}</span>
                  {fila.esYo && (
                    <span className="text-muted-foreground text-[13px] font-normal">Tú</span>
                  )}
                </th>
                <td
                  role="cell"
                  className="text-muted-foreground col-start-2 row-start-1 md:table-cell md:h-11 md:px-3 md:py-1.5 md:first:pl-0 md:last:pr-0"
                >
                  {acciones.cambiarRol ? (
                    <CambiarRol
                      key={fila.rol}
                      fila={fila}
                      negocioId={negocioId}
                      negocioNombre={negocioNombre}
                      roles={roles}
                    />
                  ) : (
                    etiquetaRol(fila.rol)
                  )}
                </td>
                <td
                  role="cell"
                  className="md:table-cell md:h-11 md:px-3 md:py-1.5 md:first:pl-0 md:last:pr-0"
                >
                  <Etiqueta tono={fila.activo ? "exito" : "neutro"}>
                    {fila.activo ? "Activo" : "Desactivado"}
                  </Etiqueta>
                </td>
                <td
                  role="cell"
                  className="col-span-2 md:table-cell md:h-11 md:px-3 md:py-1.5 md:first:pl-0 md:last:pr-0"
                >
                  {hayAcciones && (
                    <AccionesFila
                      fila={fila}
                      negocioId={negocioId}
                      negocioNombre={negocioNombre}
                      acciones={acciones}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
