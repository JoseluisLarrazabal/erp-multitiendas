"use client";

import { useRef, useState, type FormEvent } from "react";
import { Campo, validarCampos, type Errores } from "@/components/panel/campo";
import { registrarConsumo, stockProductoAccion } from "../actions";
import {
  ayudaCantidad,
  formatearCantidad,
  mensajeCantidad,
  MENSAJE_DATOS,
  parsearCantidad,
  type ProductoElegible,
  type Ubicacion,
} from "../domain";
import { consumoSchema } from "../schemas";
import { camposConsumo } from "./campos-operacion";
import { CampoCantidad } from "./campo-cantidad";
import { CampoMotivo } from "./campo-motivo";
import { PieOperacion } from "./pie-operacion";
import { ResumenStock } from "./resumen-stock";
import { SelectorProducto } from "./selector-producto";
import { SelectUbicacion } from "./select-ubicacion";
import { useCarga } from "./use-carga";
import { useOperacion } from "./use-operacion";

// Consumo de un insumo de lavandería (RF-INS-02): baja el stock y suma al gasto en insumos.
export function FormConsumo({
  negocioId,
  ubicaciones,
}: {
  negocioId: string;
  ubicaciones: readonly Ubicacion[];
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const { operacionId, pendiente, error, enviar } = useOperacion();
  const [producto, setProducto] = useState<ProductoElegible | null>(null);
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? "");
  const [cantidadTexto, setCantidadTexto] = useState("");
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
    const nuevos: Errores = {};
    if (!producto) nuevos["con-producto"] = "Elige un insumo.";
    else if (parsearCantidad(cantidadTexto, producto.unidad) === null)
      nuevos["con-cantidad"] = mensajeCantidad(producto.unidad);
    if (!motivo.trim()) nuevos["con-motivo"] = "El motivo es obligatorio.";
    const primero = Object.keys(nuevos)[0];
    if (primero) {
      setErrores(nuevos);
      setGeneral(null);
      return formulario.current?.querySelector<HTMLElement>(`#${primero}`)?.focus();
    }
    const datos = {
      operacionId,
      negocioId,
      productoId: producto!.id,
      ubicacionId,
      cantidad: cantidadTexto,
      motivo,
    };
    const v = validarCampos(e.currentTarget, consumoSchema, datos, camposConsumo(producto!.unidad));
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    setGeneral(null);
    const usado = producto!;
    const cantidadNum = v.datos.cantidad;
    enviar(
      (id) => registrarConsumo({ ...datos, operacionId: id }),
      () => {
        setProducto(null);
        setCantidadTexto("");
        setMotivo("");
        setExito(
          `Consumo registrado: ${formatearCantidad(cantidadNum, usado.unidad)} de ${usado.nombre}.`,
        );
      },
    );
  }

  return (
    <form
      ref={formulario}
      onSubmit={alEnviar}
      noValidate
      aria-label="Registrar consumo de insumo"
      className="flex max-w-2xl flex-col gap-5"
    >
      <SelectorProducto
        negocioId={negocioId}
        id="con-producto"
        tipo="insumo"
        valor={producto}
        alElegir={(p) => {
          setProducto(p);
          setErrores({});
        }}
        idSiguiente="con-cantidad"
        error={errores["con-producto"]}
      />
      <ResumenStock
        ubicaciones={ubicaciones}
        stock={stock.datos}
        unidad={producto?.unidad ?? "unidad"}
        cargando={stock.cargando}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="con-ubicacion" etiqueta="Ubicación">
          <SelectUbicacion
            ubicaciones={ubicaciones}
            id="con-ubicacion"
            value={ubicacionId}
            onChange={(e) => setUbicacionId(e.target.value)}
          />
        </Campo>
        <CampoCantidad
          id="con-cantidad"
          unidad={producto?.unidad}
          ayuda={ayudaCantidad(producto?.unidad)}
          valor={cantidadTexto}
          alCambiar={setCantidadTexto}
          errores={errores}
          className="h-10"
        />
      </div>
      <CampoMotivo
        id="con-motivo"
        etiqueta="Motivo"
        ayuda="Obligatorio: queda en el kardex. Ej.: lavado de la mañana."
        valor={motivo}
        alCambiar={setMotivo}
        errores={errores}
      />
      <PieOperacion
        etiqueta="Registrar consumo"
        pendiente={pendiente}
        error={general ?? error}
        exito={exito}
      />
    </form>
  );
}
