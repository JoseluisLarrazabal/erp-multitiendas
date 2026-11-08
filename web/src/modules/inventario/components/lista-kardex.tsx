import { cn } from "@/lib/utils";
import {
  etiquetaMovimiento,
  formatearCantidadConSigno,
  formatearCostoUnitario,
  formatearFechaHora,
  type Movimiento,
  type Ubicacion,
  type Unidad,
} from "../domain";
import { BotonRevertirConsumo } from "./boton-revertir-consumo";

const COLUMNAS = "md:grid-cols-[9rem_11rem_8rem_6rem_9rem_minmax(0,1fr)]";

// Kardex: solo lectura. El costo aparece únicamente si la RPC lo devolvió (ver_costos).
export function ListaKardex({
  movimientos,
  ubicaciones,
  unidad,
  puedeRevertir = false,
}: {
  movimientos: readonly Movimiento[];
  ubicaciones: readonly Ubicacion[];
  unidad: Unidad;
  // Con ajustar_inventario, los consumos llevan "Revertir" (salvo los ya revertidos en esta página).
  puedeRevertir?: boolean;
}) {
  const revertidos = new Set(
    movimientos.filter((m) => m.refTipo === "consumo_revertido").map((m) => m.refId),
  );
  const nombre = (id: string) => ubicaciones.find((u) => u.id === id)?.nombre ?? "—";
  return (
    <div className="bg-card rounded-xl border shadow-[0_2px_5px_#34345a0d]">
      <div
        aria-hidden
        className={cn(
          "text-muted-foreground hidden gap-x-3 border-b px-4 py-2 text-xs font-semibold md:grid",
          COLUMNAS,
        )}
      >
        <span>Fecha</span>
        <span>Movimiento</span>
        <span>Ubicación</span>
        <span className="text-right">Cantidad</span>
        <span>Usuario</span>
        <span>Motivo y referencia</span>
      </div>
      <ul className="divide-y" aria-label="Movimientos">
        {movimientos.map((m) => (
          <li
            key={m.id}
            className={cn(
              "grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm md:items-start",
              COLUMNAS,
            )}
          >
            <span className="text-muted-foreground tabular-nums">
              <span className="sr-only">Fecha: </span>
              {formatearFechaHora(m.fecha)}
            </span>
            <span className="text-right font-semibold md:text-left">
              {etiquetaMovimiento(m.tipo)}
            </span>
            <span className="text-muted-foreground">
              <span className="sr-only">Ubicación: </span>
              {nombre(m.ubicacionId)}
            </span>
            <span
              className={cn(
                "text-right font-semibold tabular-nums",
                m.cantidad < 0 && "text-destructive",
              )}
            >
              <span className="sr-only">Cantidad: </span>
              {m.tipo === "ajuste_costo" ? "—" : formatearCantidadConSigno(m.cantidad, unidad)}
              {m.costoUnitario !== null && (
                <span className="text-muted-foreground block text-xs font-normal">
                  Costo {formatearCostoUnitario(m.costoUnitario)}
                </span>
              )}
            </span>
            <span className="text-muted-foreground">
              <span className="sr-only">Usuario: </span>
              {m.usuario ?? "—"}
            </span>
            <span className="col-span-2 min-w-0 md:col-span-1">
              {m.motivo ?? <span className="text-muted-foreground">Sin motivo</span>}
              {m.refTipo && (
                <span className="text-muted-foreground block text-xs">Ref.: {m.refTipo}</span>
              )}
              {puedeRevertir && m.tipo === "consumo" && m.cantidad < 0 && !revertidos.has(m.id) && (
                <BotonRevertirConsumo movimientoId={m.id} />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
