import { formatearCantidad, type Ubicacion, type Unidad } from "../domain";

// "Stock: Tienda 5 · Depósito 10" del producto elegido. Negativo con texto, no solo color (RN-04).
export function ResumenStock({
  ubicaciones,
  stock,
  unidad,
  cargando,
  falla,
}: {
  ubicaciones: readonly Ubicacion[];
  stock: Record<string, number> | null;
  unidad: Unidad;
  cargando: boolean;
  // Aviso si no se pudo leer; el formulario decide qué implica para el envío.
  falla?: string | null;
}) {
  return (
    <p role="status" className="text-muted-foreground text-sm empty:sr-only">
      {cargando && "Leyendo el stock…"}
      {!cargando && !stock && falla}
      {!cargando && stock && (
        <>
          Stock actual:{" "}
          {ubicaciones.map((u, i) => {
            const n = stock[u.id] ?? 0;
            return (
              <span key={u.id}>
                {i > 0 && " · "}
                {u.nombre}{" "}
                <strong className={n < 0 ? "text-destructive" : "text-foreground"}>
                  {formatearCantidad(n, unidad)}
                  {n < 0 && " (negativo)"}
                </strong>
              </span>
            );
          })}
        </>
      )}
    </p>
  );
}
