"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatearFechaHora } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import { anularPagoProveedor, ultimoPagoProveedor } from "../actions";
import type { UltimoPago } from "../domain";
import { DialogoMotivo } from "./dialogo-motivo";

type Estado =
  | { fase: "cerrado" }
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "listo"; pago: UltimoPago | null };

// Anula el último pago vivo del proveedor. El monto no se lee por columna: se pide a la RPC al abrir el diálogo.
export function AnularPagoProveedor({
  proveedorId,
  nombre,
}: {
  proveedorId: string;
  nombre: string;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cerrado" });
  // Cuenta las aperturas: una respuesta tardía de una apertura ya cerrada no reabre el diálogo.
  const apertura = useRef(0);

  async function abrir() {
    const esta = ++apertura.current;
    setEstado({ fase: "cargando" });
    try {
      const r = await ultimoPagoProveedor({ proveedorId });
      if (esta !== apertura.current) return;
      setEstado(r.ok ? { fase: "listo", pago: r.data } : { fase: "error", mensaje: r.error });
    } catch {
      if (esta !== apertura.current) return;
      setEstado({
        fase: "error",
        mensaje: "No se pudo consultar el último pago. Intenta de nuevo.",
      });
    }
  }

  const pago = estado.fase === "listo" ? estado.pago : null;
  const descripcion =
    estado.fase === "cargando"
      ? "Consultando el último pago…"
      : estado.fase === "error"
        ? estado.mensaje
        : !pago
          ? "Este proveedor no tiene pagos para anular."
          : `Se anula el pago de ${formatearBs(pago.monto)} del ${formatearFechaHora(pago.creadoEn)} y la deuda de ${nombre} sube ese monto. Solo se puede anular el último pago.`;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label={`Anular el último pago a ${nombre}`}
        onClick={abrir}
      >
        Anular último pago
      </Button>
      <DialogoMotivo
        abierto={estado.fase !== "cerrado"}
        alCambiarAbierto={(abierto) => {
          if (abierto) return;
          apertura.current++;
          setEstado({ fase: "cerrado" });
        }}
        titulo={`Anular el último pago a ${nombre}`}
        descripcion={descripcion}
        confirmar="Anular pago"
        id={`anular-pago-${pago?.id ?? proveedorId}`}
        sinConfirmar={!pago}
        accion={(operacionId, motivo) =>
          anularPagoProveedor({ operacionId, pagoId: pago!.id, motivo })
        }
      />
    </>
  );
}
