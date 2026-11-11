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
  lote: { id: "ent-lote", mensaje: "Escribe el lote (hasta 40 caracteres) junto con su fecha." },
  vence: { id: "ent-vence", mensaje: "Indica la fecha de vencimiento del lote." },
};

export function FormEntrada({
  negocioId,
  ubicaciones,
  verCostos,
  esFrial,
  hoy,
}: {
  negocioId: string;
  ubicaciones: readonly Ubicacion[];
  verCostos: boolean;
  esFrial: boolean;
  // "aaaa-mm-dd" en Bolivia, calculado en el servidor.
  hoy: string;
}) {
  const { operacionId, pendiente, error, enviar } = useOperacion();
  const [producto, setProducto] = useState<ProductoElegible | null>(null);
  // Controlados: tras registrar solo se limpian producto, cantidad y costo; la ubicación se conserva.
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? "");
  const [cantidadTexto, setCantidadTexto] = useState("");
  const [costoTexto, setCostoTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [lote, setLote] = useState("");
  const [vence, setVence] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  // Un producto con series no lleva lote.
  const conLote = esFrial && !producto?.controlaSerie;
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
    if (conLote && vence && vence < hoy)
      nuevos["ent-vence"] = "La fecha de vencimiento no puede ser pasada.";
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
        ...(conLote && { lote, vence }),
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
          ...(conLote && { lote, vence }),
        }),
      () => {
        setProducto(null);
        setCantidadTexto("");
        setCostoTexto("");
        setMotivo("");
        setLote("");
        setVence("");
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
            className="sm:max-w-64"
            {...propsCampo("ent-costo", errores, true)}
          />
        </Campo>
      )}
      {conLote && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            id="ent-lote"
            etiqueta="Lote (opcional)"
            ayuda="Si lo llenas, también la fecha de vencimiento."
            error={errores["ent-lote"]}
          >
            <Input
              id="ent-lote"
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              {...propsCampo("ent-lote", errores, true)}
            />
          </Campo>
          <Campo id="ent-vence" etiqueta="Vence (opcional)" error={errores["ent-vence"]}>
            <Input
              id="ent-vence"
              type="date"
              value={vence}
              onChange={(e) => setVence(e.target.value)}
              min={hoy}
              className="sm:max-w-48"
              {...propsCampo("ent-vence", errores)}
            />
          </Campo>
        </div>
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
