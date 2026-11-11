"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { anularCompra } from "../actions";
import { DialogoMotivo } from "./dialogo-motivo";

// Anula una compra (contraasiento: revierte el stock, el costo promedio y, al contado, su pago). La barrera real
// es la RPC (permisos gestionar_compras y anular); el botón solo se muestra a quien tiene `anular`.
export function AnularCompra({ compraId, proveedor }: { compraId: string; proveedor: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        aria-label={`Anular la compra de ${proveedor}`}
        onClick={() => setAbierto(true)}
      >
        Anular compra
      </Button>
      <DialogoMotivo
        abierto={abierto}
        alCambiarAbierto={setAbierto}
        titulo={`Anular la compra de ${proveedor}`}
        descripcion="Se deshace el stock que entró y se corrige el costo promedio. Si se pagó al contado, el pago también se revierte. No se puede anular si ya hay stock vendido o pagos al proveedor."
        confirmar="Anular compra"
        id={`anular-${compraId}`}
        focoTrasExito="lista-compras"
        accion={(operacionId, motivo) => anularCompra({ operacionId, compraId, motivo })}
      />
    </>
  );
}
