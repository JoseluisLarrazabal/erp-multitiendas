import { PieOperacion } from "@/modules/inventario/panel-cliente";
import { formatearBs } from "@/lib/format/moneda";

// Total en pantalla (centavos enteros) y botón de envío con sus avisos.
export function PieCompra({
  total,
  pendiente,
  error,
  exito,
}: {
  total: number | null;
  pendiente: boolean;
  error: string | null;
  exito: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-semibold tabular-nums">
        Total: {total === null ? "—" : formatearBs(total / 100)}
      </p>
      <PieOperacion etiqueta="Registrar compra" pendiente={pendiente} error={error} exito={exito} />
    </div>
  );
}
