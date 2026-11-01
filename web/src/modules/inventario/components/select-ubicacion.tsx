import { SelectNativo } from "@/components/ui/select-nativo";
import type { Ubicacion } from "../domain";

// <select> de ubicaciones; controlado si recibe `value`.
export function SelectUbicacion({
  ubicaciones,
  ...props
}: { ubicaciones: readonly Ubicacion[] } & React.ComponentProps<typeof SelectNativo>) {
  return (
    <SelectNativo {...props}>
      {ubicaciones.map((u) => (
        <option key={u.id} value={u.id}>
          {u.nombre}
        </option>
      ))}
    </SelectNativo>
  );
}
