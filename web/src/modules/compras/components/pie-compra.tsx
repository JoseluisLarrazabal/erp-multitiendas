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
      <p className="border-foreground border-t-2 pt-3 text-lg font-semibold">
        Total: <span className="cifra">{total === null ? "—" : formatearBs(total / 100)}</span>
      </p>
      <PieOperacion etiqueta="Registrar compra" pendiente={pendiente} error={error} exito={exito} />
    </div>
  );
}
