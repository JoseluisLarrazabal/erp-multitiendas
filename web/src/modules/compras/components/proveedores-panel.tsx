"use client";

import { useState } from "react";
import { Banknote, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
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

const COLUMNAS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_24rem]";

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
    <ListaFilas
      etiqueta="Proveedores"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span>Proveedor</span>
          <span>Contacto</span>
          <span className="text-right">Deuda</span>
          <span />
        </>
      }
    >
      {proveedores.map((p) => (
        <Fila key={p.id} columnas={`grid-cols-[1fr_auto] ${COLUMNAS}`}>
          {abierto?.id === p.id && abierto.modo === "editar" ? (
            <div className="col-span-full">
              <FormProveedor negocioId={negocioId} proveedor={p} alTerminar={cerrar} />
            </div>
          ) : (
            <>
              <span className="min-w-0 truncate font-semibold">
                {p.nombre}
                {!p.activo && (
                  <span className="text-muted-foreground font-normal"> (inactivo)</span>
                )}
              </span>
              <span className="text-muted-foreground min-w-0 truncate text-sm max-md:order-3 max-md:col-span-2">
                {p.contacto ?? ""}
              </span>
              <span
                className={`cifra text-[13px] max-md:order-2 md:text-right ${p.deuda > 0 ? "" : "text-muted-foreground"}`}
              >
                <span className="font-sans">Deuda</span> {formatearBs(p.deuda)}
              </span>
              <div className="flex flex-wrap gap-2 max-md:order-4 max-md:col-span-2 md:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={p.deuda <= 0}
                  aria-label={`Registrar pago a ${p.nombre}`}
                  onClick={() => setAbierto({ id: p.id, modo: "pagar" })}
                >
                  <Banknote aria-hidden /> Pagar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Editar a ${p.nombre}`}
                  onClick={() => setAbierto({ id: p.id, modo: "editar" })}
                >
                  <Pencil aria-hidden /> Editar
                </Button>
                {puedeAnular && <AnularPagoProveedor proveedorId={p.id} nombre={p.nombre} />}
              </div>
            </>
          )}
          {abierto?.id === p.id && abierto.modo === "pagar" && (
            <div className="bg-surface order-last col-span-full mt-2 rounded-lg border p-4">
              <FormPago negocioId={negocioId} proveedor={p} alTerminar={cerrar} />
            </div>
          )}
        </Fila>
      ))}
    </ListaFilas>
  );
}
