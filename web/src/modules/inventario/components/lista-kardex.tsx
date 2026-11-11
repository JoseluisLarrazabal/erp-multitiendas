import { Fila, ListaFilas } from "@/components/ui/lista-filas";
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

const COLUMNAS = "md:grid-cols-[9rem_10rem_8rem_9rem_8rem_minmax(0,1fr)]";

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
  // Con ajustar_inventario, los consumos llevan "Revertir" (salvo los ya revertidos).
  puedeRevertir?: boolean;
}) {
  const nombre = (id: string) => ubicaciones.find((u) => u.id === id)?.nombre ?? "—";
  return (
    <ListaFilas
      etiqueta="Movimientos"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span>Fecha</span>
          <span>Movimiento</span>
          <span>Ubicación</span>
          <span className="text-right">Cantidad</span>
          <span>Usuario</span>
          <span>Motivo y referencia</span>
        </>
      }
    >
      {movimientos.map((m) => (
        <Fila key={m.id} columnas={`grid-cols-2 text-sm md:items-start ${COLUMNAS}`}>
          <span className="text-muted-foreground text-[13px] tabular-nums">
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
              "cifra text-right text-[13px] font-semibold",
              m.cantidad < 0 && "text-destructive",
            )}
          >
            <span className="sr-only">Cantidad: </span>
            {m.tipo === "ajuste_costo" ? "—" : formatearCantidadConSigno(m.cantidad, unidad)}
            {m.costoUnitario !== null && (
              <span className="text-muted-foreground block text-[13px] font-normal whitespace-nowrap">
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
            {m.referencia && (
              <span className="text-muted-foreground block text-[13px]">Ref.: {m.referencia}</span>
            )}
            {puedeRevertir && m.tipo === "consumo" && m.cantidad < 0 && !m.revertido && (
              <BotonRevertirConsumo movimientoId={m.id} />
            )}
          </span>
        </Fila>
      ))}
    </ListaFilas>
  );
}
