"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Campo, validarCampos, type Errores } from "@/components/panel/campo";
import { formatearBs } from "@/lib/format/moneda";
import {
  mensajeCantidad,
  MENSAJE_DATOS,
  parsearCantidad,
  type Ubicacion,
} from "@/modules/inventario";
import { SelectUbicacion, useOperacion } from "@/modules/inventario/panel-cliente";
import { registrarCompra } from "../actions";
import {
  ETIQUETA_MEDIO,
  MEDIOS_PAGO,
  parsearCostoCompra,
  totalCentavos,
  type MedioPago,
} from "../domain";
import { compraSchema } from "../schemas";
import { FilaCompra, type ItemCompra } from "./fila-compra";
import { PieCompra } from "./pie-compra";

const CAMPOS = {
  proveedorId: { id: "cmp-proveedor", mensaje: "Elige un proveedor." },
  ubicacionId: { id: "cmp-ubicacion", mensaje: "Elige una ubicación." },
  medio: { id: "cmp-medio", mensaje: "Elige cómo se pagó." },
  items: { id: "cmp-agregar", mensaje: "No repitas un producto: súmalo en una sola línea." },
};

const nueva = (clave: number): ItemCompra => ({
  clave,
  producto: null,
  cantidad: "",
  costo: "",
  lote: "",
  vence: "",
});

export function FormCompra({
  negocioId,
  proveedores,
  ubicaciones,
  esFrial,
  hoy,
}: {
  negocioId: string;
  proveedores: readonly { id: string; nombre: string }[];
  ubicaciones: readonly Ubicacion[];
  // Frial (M-8): cada línea lleva lote y vencimiento. `hoy` es YYYY-MM-DD en Bolivia, calculado en el servidor.
  esFrial: boolean;
  hoy: string;
}) {
  const { pendiente, error, enviar } = useOperacion();
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? "");
  const [condicion, setCondicion] = useState<"contado" | "credito">("credito");
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [items, setItems] = useState<ItemCompra[]>([nueva(1)]);
  const [errores, setErrores] = useState<Errores>({});
  const [exito, setExito] = useState<string | null>(null);
  const [general, setGeneral] = useState<string | null>(null);

  const total = totalCentavos(items);
  const cambiar = (clave: number, cambio: Partial<ItemCompra>) =>
    setItems((prev) => prev.map((i) => (i.clave === clave ? { ...i, ...cambio } : i)));

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExito(null);
    const nuevos: Errores = {};
    for (const i of items) {
      const id = `cmp-${i.clave}`;
      if (!i.producto) nuevos[`${id}-producto`] = "Elige un producto.";
      else if (parsearCantidad(i.cantidad, i.producto.unidad) === null)
        nuevos[`${id}-cantidad`] = mensajeCantidad(i.producto.unidad);
      if (parsearCostoCompra(i.costo) === null)
        nuevos[`${id}-costo`] = "Escribe un costo de 0 o más, con hasta 4 decimales. Ej.: 12,5.";
      if (esFrial) {
        if (i.producto?.controlaSerie)
          nuevos[`${id}-producto`] = "Un producto con serie no se compra en el frial.";
        if (!i.lote.trim()) nuevos[`${id}-lote`] = "Escribe el lote (hasta 40 caracteres).";
        if (!i.vence) nuevos[`${id}-vence`] = "Indica la fecha de vencimiento.";
        else if (i.vence < hoy)
          nuevos[`${id}-vence`] = "La fecha de vencimiento no puede ser pasada.";
      }
    }
    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      return e.currentTarget.querySelector<HTMLElement>(`#${Object.keys(nuevos)[0]}`)?.focus();
    }
    const entrada = {
      negocioId,
      proveedorId,
      ubicacionId,
      condicion,
      ...(condicion === "contado" && { medio }),
      items: items.map((i) => ({
        productoId: i.producto!.id,
        cantidad: i.cantidad,
        costo: i.costo,
        ...(esFrial && { lote: i.lote, vence: i.vence }),
      })),
    };
    const v = validarCampos(
      e.currentTarget,
      compraSchema,
      { operacionId: crypto.randomUUID(), ...entrada },
      CAMPOS,
    );
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    setGeneral(null);
    const montoTexto = formatearBs((total ?? 0) / 100);
    enviar(
      (operacionId) => registrarCompra({ operacionId, ...entrada }),
      () => {
        setItems([nueva(Math.max(...items.map((i) => i.clave)) + 1)]);
        setExito(`Compra registrada por ${montoTexto}.`);
      },
    );
  }

  return (
    <form
      onSubmit={alEnviar}
      noValidate
      aria-label="Registrar compra"
      className="flex max-w-4xl flex-col gap-5"
    >
      <div className="bg-card shadow-card grid gap-5 rounded-xl border p-5 sm:grid-cols-2 md:p-6">
        <Campo id="cmp-proveedor" etiqueta="Proveedor" error={errores["cmp-proveedor"]}>
          <SelectNativo
            id="cmp-proveedor"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
          >
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo id="cmp-ubicacion" etiqueta="Ubicación de entrada">
          <SelectUbicacion
            ubicaciones={ubicaciones}
            id="cmp-ubicacion"
            value={ubicacionId}
            onChange={(e) => setUbicacionId(e.target.value)}
          />
        </Campo>
        <Campo id="cmp-condicion" etiqueta="Condición">
          <SelectNativo
            id="cmp-condicion"
            value={condicion}
            onChange={(e) => setCondicion(e.target.value as "contado" | "credito")}
          >
            <option value="credito">A crédito (queda deuda)</option>
            <option value="contado">Al contado (se paga ahora)</option>
          </SelectNativo>
        </Campo>
        {condicion === "contado" && (
          <Campo id="cmp-medio" etiqueta="Medio de pago" error={errores["cmp-medio"]}>
            <SelectNativo
              id="cmp-medio"
              value={medio}
              onChange={(e) => setMedio(e.target.value as MedioPago)}
            >
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MEDIO[m]}
                </option>
              ))}
            </SelectNativo>
          </Campo>
        )}
      </div>
      <div className="bg-card shadow-card flex flex-col gap-4 rounded-xl border p-5 md:p-6">
        <div className="divide-y">
          {items.map((i) => (
            <FilaCompra
              key={i.clave}
              negocioId={negocioId}
              esFrial={esFrial}
              hoy={hoy}
              item={i}
              errores={errores}
              puedeQuitar={items.length > 1}
              alCambiar={(c) => cambiar(i.clave, c)}
              alQuitar={() => setItems((prev) => prev.filter((x) => x.clave !== i.clave))}
            />
          ))}
        </div>
        <div>
          <Button
            type="button"
            id="cmp-agregar"
            variant="outline"
            onClick={() =>
              setItems((prev) => [...prev, nueva(Math.max(...prev.map((x) => x.clave)) + 1)])
            }
          >
            <Plus aria-hidden /> Agregar producto
          </Button>
          {errores["cmp-agregar"] && (
            <p className="text-destructive mt-1 text-xs">{errores["cmp-agregar"]}</p>
          )}
        </div>
      </div>
      <PieCompra total={total} pendiente={pendiente} error={general ?? error} exito={exito} />
    </form>
  );
}
