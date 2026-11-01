import { ETIQUETA_LISTA, type Lista } from "../domain";

const columna = "w-28 min-w-28 px-2 py-2.5 text-right";

// Anchos fijos: a 1280 px caben Producto, Moneda, cuatro listas y Costo sin desplazar. En móvil Producto se acorta.
export function CabeceraGrilla({
  listas,
  verCostos,
}: {
  listas: readonly Lista[];
  verCostos: boolean;
}) {
  return (
    <thead>
      <tr className="text-muted-foreground border-b text-left text-xs font-semibold">
        <th
          scope="col"
          className="bg-card sticky left-0 z-10 w-36 min-w-36 px-2 py-2.5 md:w-48 md:min-w-48"
        >
          Producto
        </th>
        <th scope="col" className="w-24 px-2 py-2.5">
          Moneda
        </th>
        {listas.map((l) => (
          <th key={l} scope="col" className={columna}>
            {ETIQUETA_LISTA[l]}
          </th>
        ))}
        {verCostos && (
          <th scope="col" className={columna}>
            Costo (Bs)
          </th>
        )}
      </tr>
    </thead>
  );
}
