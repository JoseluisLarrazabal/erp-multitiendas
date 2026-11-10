"use client";

import { useState } from "react";
import { Banknote, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatearBs } from "@/lib/format/moneda";
import type { FilaProveedor } from "../queries";
import { AnularPagoProveedor } from "./anular-pago-proveedor";
import { FormPago } from "./form-pago";
import { FormProveedor } from "./form-proveedor";

export function NuevoProveedor({ negocioId }: { negocioId: string }) {
  const [clave, setClave] = useState(0);
  const [hecho, setHecho] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {/* La key reinicia el formulario tras guardar. */}
      <FormProveedor
        key={clave}
        negocioId={negocioId}
        alTerminar={() => {
          setClave(clave + 1);
          setHecho(true);
        }}
      />
      <p role="status" className="text-sm font-medium">
        {hecho ? "Proveedor guardado." : ""}
      </p>
    </div>
  );
}

export function ListaProveedores({
  negocioId,
  proveedores,
  puedeAnular,
}: {
  negocioId: string;
  proveedores: readonly FilaProveedor[];
  puedeAnular: boolean;
}) {
  const [abierto, setAbierto] = useState<{ id: string; modo: "editar" | "pagar" } | null>(null);
  const cerrar = () => setAbierto(null);
  return (
    <ul
      aria-label="Proveedores"
      className="bg-card divide-y rounded-xl border shadow-[0_2px_5px_#34345a0d]"
    >
      {proveedores.map((p) => (
        <li key={p.id} className="px-4 py-3">
          {abierto?.id === p.id && abierto.modo === "editar" ? (
            <FormProveedor negocioId={negocioId} proveedor={p} alTerminar={cerrar} />
          ) : (
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto]">
              <span className="min-w-0 truncate font-medium">
                {p.nombre}
                {!p.activo && <span className="text-muted-foreground"> (inactivo)</span>}
              </span>
              <span className="text-muted-foreground min-w-0 truncate text-sm max-md:order-3 max-md:col-span-2">
                {p.contacto ?? ""}
              </span>
              <span className="text-sm tabular-nums max-md:order-2 md:text-right">
                Deuda {formatearBs(p.deuda)}
              </span>
              <div className="flex gap-2 max-md:order-4 max-md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 md:min-h-8"
                  disabled={p.deuda <= 0}
                  aria-label={`Registrar pago a ${p.nombre}`}
                  onClick={() => setAbierto({ id: p.id, modo: "pagar" })}
                >
                  <Banknote aria-hidden /> Pagar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 md:min-h-8"
                  aria-label={`Editar a ${p.nombre}`}
                  onClick={() => setAbierto({ id: p.id, modo: "editar" })}
                >
                  <Pencil aria-hidden /> Editar
                </Button>
                {puedeAnular && <AnularPagoProveedor proveedorId={p.id} nombre={p.nombre} />}
              </div>
            </div>
          )}
          {abierto?.id === p.id && abierto.modo === "pagar" && (
            <div className="mt-3">
              <FormPago negocioId={negocioId} proveedor={p} alTerminar={cerrar} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
