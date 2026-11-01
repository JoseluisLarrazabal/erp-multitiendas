import { formatearCantidad, type Ubicacion, type Unidad } from "../domain";

// "Stock: Tienda 5 · Depósito 10" del producto elegido. Negativo con texto, no solo color (RN-04).
export function ResumenStock({
  ubicaciones,
  stock,
  unidad,
  cargando,
}: {
  ubicaciones: readonly Ubicacion[];
  stock: Record<string, number> | null;
  unidad: Unidad;
  cargando: boolean;
}) {
  if (cargando) return <p className="text-muted-foreground text-sm">Leyendo el stock…</p>;
  if (!stock) return null;
  return (
    <p className="text-muted-foreground text-sm">
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
    </p>
  );
}
