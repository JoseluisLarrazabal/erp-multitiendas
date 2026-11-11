import { etiquetaRol, accionesDeFila, type FilaUsuario } from "../domain";
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
    <div className="bg-card shadow-card rounded-xl border">
      <table role="table" className="w-full text-sm">
        <caption className="sr-only">Personal de {negocioNombre}</caption>
        <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
          <tr role="row" className="text-muted-foreground border-b text-left text-xs">
            <th scope="col" role="columnheader" className="px-4 py-3 font-medium">
              Nombre
            </th>
            <th scope="col" role="columnheader" className="px-4 py-3 font-medium">
              Rol
            </th>
            <th scope="col" role="columnheader" className="px-4 py-3 font-medium">
              Estado
            </th>
            <th scope="col" role="columnheader" className="px-4 py-3 font-medium">
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
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 border-b px-4 py-3.5 last:border-b-0 md:table-row"
              >
                <th
                  scope="row"
                  role="rowheader"
                  className="min-w-0 text-left font-semibold md:table-cell md:px-4 md:py-3.5"
                >
                  <span className="block truncate">{fila.nombre}</span>
                  {fila.esYo && (
                    <span className="text-muted-foreground text-xs font-normal">Tú</span>
                  )}
                </th>
                <td
                  role="cell"
                  className="text-muted-foreground col-start-2 row-start-1 md:table-cell md:px-4 md:py-3.5"
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
                <td role="cell" className="md:table-cell md:px-4 md:py-3.5">
                  <span
                    className={
                      fila.activo
                        ? "bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium"
                        : "text-destructive border-destructive/40 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    }
                  >
                    {fila.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td role="cell" className="col-span-2 md:table-cell md:px-4 md:py-3.5">
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
