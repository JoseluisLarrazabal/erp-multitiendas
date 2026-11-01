"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import {
  Campo,
  propsCampo,
  validarCampos,
  type Campos,
  type Errores,
} from "@/components/panel/campo";
import { registrarEntrada, stockProductoAccion } from "../actions";
import {
  ayudaCantidad,
  formatearCantidad,
  mensajeCantidad,
  MENSAJE_DATOS,
  parsearCantidad,
  type ProductoElegible,
  type Ubicacion,
} from "../domain";
import { entradaSchema } from "../schemas";
import { SelectUbicacion } from "./select-ubicacion";
import { CampoCantidad } from "./campo-cantidad";
import { CampoMotivo } from "./campo-motivo";
import { PieOperacion } from "./pie-operacion";
import { ResumenStock } from "./resumen-stock";
import { SelectorProducto } from "./selector-producto";
import { useCarga } from "./use-carga";
import { useOperacion } from "./use-operacion";

const CAMPOS: Campos = {
  costo: {
    id: "ent-costo",
    mensaje: "Escribe un costo de 0 o más, con hasta 4 decimales. Ej.: 12,5.",
  },
  motivo: { id: "ent-motivo", mensaje: "El motivo es demasiado largo." },
};

export function FormEntrada({
  negocioId,
  ubicaciones,
  verCostos,
}: {
  negocioId: string;
  ubicaciones: readonly Ubicacion[];
  verCostos: boolean;
}) {
  const { operacionId, pendiente, error, enviar } = useOperacion();
  const [producto, setProducto] = useState<ProductoElegible | null>(null);
  // Controlados: tras registrar solo se limpian producto, cantidad y costo; la ubicación se conserva.
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? "");
  const [cantidadTexto, setCantidadTexto] = useState("");
  const [costoTexto, setCostoTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const stock = useCarga(producto && `${negocioId}|${producto.id}`, () =>
    stockProductoAccion({ negocioId, productoId: producto!.id }),
  );

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExito(null);
    const cantidad = cantidadTexto;
    const costo = verCostos ? costoTexto : "";
    const nuevos: Errores = {};
    if (!producto) nuevos["ent-producto"] = "Elige un producto.";
    else if (parsearCantidad(cantidad, producto.unidad) === null)
      nuevos["ent-cantidad"] = mensajeCantidad(producto.unidad);
    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      return e.currentTarget.querySelector<HTMLElement>(`#${Object.keys(nuevos)[0]}`)?.focus();
    }
    const v = validarCampos(
      e.currentTarget,
      entradaSchema,
      {
        operacionId,
        negocioId,
        productoId: producto!.id,
        ubicacionId,
        cantidad,
        costo,
        motivo,
      },
      CAMPOS,
    );
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    setGeneral(null);
    const entrante = producto!;
    const cantidadNum = v.datos.cantidad;
    enviar(
      (id) =>
        registrarEntrada({
          operacionId: id,
          negocioId,
          productoId: entrante.id,
          ubicacionId: v.datos.ubicacionId,
          cantidad,
          costo,
          motivo,
        }),
      () => {
        setProducto(null);
        setCantidadTexto("");
        setCostoTexto("");
        setMotivo("");
        setExito(
          `Entrada registrada: ${formatearCantidad(cantidadNum, entrante.unidad)} de ${entrante.nombre}.`,
        );
      },
    );
  }

  return (
    <form
      onSubmit={alEnviar}
      noValidate
      aria-label="Registrar entrada"
      className="flex max-w-2xl flex-col gap-5"
    >
      <SelectorProducto
        negocioId={negocioId}
        id="ent-producto"
        valor={producto}
        alElegir={(p) => {
          setProducto(p);
          setErrores({});
        }}
        idSiguiente="ent-cantidad"
        error={errores["ent-producto"]}
      />
      <ResumenStock
        ubicaciones={ubicaciones}
        stock={stock.datos}
        unidad={producto?.unidad ?? "unidad"}
        cargando={stock.cargando}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ent-ubicacion" etiqueta="Ubicación">
          <SelectUbicacion
            ubicaciones={ubicaciones}
            id="ent-ubicacion"
            value={ubicacionId}
            onChange={(e) => setUbicacionId(e.target.value)}
          />
        </Campo>
        <CampoCantidad
          id="ent-cantidad"
          unidad={producto?.unidad}
          ayuda={ayudaCantidad(producto?.unidad)}
          valor={cantidadTexto}
          alCambiar={setCantidadTexto}
          errores={errores}
          className="h-10"
        />
      </div>
      {verCostos && (
        <Campo
          id="ent-costo"
          etiqueta="Costo unitario en Bs (opcional)"
          ayuda="Si lo dejas vacío, el costo promedio no cambia."
          error={errores["ent-costo"]}
        >
          <Input
            id="ent-costo"
            value={costoTexto}
            onChange={(e) => setCostoTexto(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="h-10 sm:max-w-64"
            {...propsCampo("ent-costo", errores, true)}
          />
        </Campo>
      )}
      <CampoMotivo
        id="ent-motivo"
        etiqueta="Motivo (opcional)"
        valor={motivo}
        alCambiar={setMotivo}
        errores={errores}
      />
      <PieOperacion
        etiqueta="Registrar entrada"
        pendiente={pendiente}
        error={general ?? error}
        exito={exito}
      />
    </form>
  );
}
