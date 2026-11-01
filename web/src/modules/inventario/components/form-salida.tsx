"use client";

import { useRef, useState, type FormEvent } from "react";
import { validarCampos, type Errores } from "@/components/panel/campo";
import { registrarSalida, stockProductoAccion } from "../actions";
import {
  ayudaSalida,
  formatearCantidad,
  mensajeCantidad,
  MENSAJE_DATOS,
  parsearCantidad,
  type ProductoElegible,
  type TipoSalida,
  type Ubicacion,
} from "../domain";
import { salidaSchema } from "../schemas";
import { camposSalida } from "./campos-operacion";
import { CampoCantidad } from "./campo-cantidad";
import { CampoMotivo } from "./campo-motivo";
import { PieOperacion } from "./pie-operacion";
import { ResumenStock } from "./resumen-stock";
import { SelectorProducto } from "./selector-producto";
import { SelectorSeries } from "./selector-series";
import { TipoUbicacionSalida } from "./tipo-ubicacion-salida";
import { useCarga } from "./use-carga";
import { useOperacion } from "./use-operacion";

export function FormSalida({
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
  const [tipo, setTipo] = useState<TipoSalida>("danado");
  const [cantidadTexto, setCantidadTexto] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [series, setSeries] = useState<string[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const stock = useCarga(producto && `${negocioId}|${producto.id}`, () =>
    stockProductoAccion({ negocioId, productoId: producto!.id }),
  );

  const conSigno = tipo === "ajuste";
  const cantidad = producto ? parsearCantidad(cantidadTexto, producto.unidad, { conSigno }) : null;
  // Las series se exigen en toda salida de un producto con serie (cantidad negativa).
  const salidaConSerie =
    !!producto?.controlaSerie && cantidad !== null && cantidad < (conSigno ? 0 : Infinity);
  const necesarias = salidaConSerie ? Math.abs(cantidad!) : 0;

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExito(null);
    const nuevos: Errores = {};
    const motivo = motivoTexto.trim();
    if (!producto) nuevos["sal-producto"] = "Elige un producto.";
    else if (cantidad === null || (!conSigno && cantidad <= 0))
      nuevos["sal-cantidad"] = mensajeCantidad(producto.unidad, conSigno);
    else if (salidaConSerie && series.length !== necesarias)
      nuevos["sal-series"] = `Marca exactamente ${necesarias} serie(s).`;
    if (!motivo) nuevos["sal-motivo"] = "El motivo es obligatorio.";
    const datos = {
      operacionId,
      negocioId,
      productoId: producto?.id,
      ubicacionId,
      tipo,
      cantidad: cantidadTexto,
      motivo,
      serieIds: salidaConSerie ? series : null,
    };
    const primero = Object.keys(nuevos)[0];
    if (primero) {
      setErrores(nuevos);
      setGeneral(null);
      return formulario.current?.querySelector<HTMLElement>(`#${primero}`)?.focus();
    }
    const v = validarCampos(
      e.currentTarget,
      salidaSchema,
      datos,
      camposSalida(producto?.unidad, conSigno),
    );
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    setGeneral(null);

    const saliente = producto!;
    enviar(
      (id) => registrarSalida({ ...datos, operacionId: id }),
      () => {
        setProducto(null);
        setCantidadTexto("");
        setMotivoTexto("");
        setSeries([]);
        setExito(
          `Movimiento registrado: ${formatearCantidad(cantidad!, saliente.unidad)} de ${saliente.nombre}.`,
        );
      },
    );
  }

  return (
    <form
      ref={formulario}
      onSubmit={alEnviar}
      noValidate
      aria-label="Registrar salida o ajuste"
      className="flex max-w-2xl flex-col gap-5"
    >
      <SelectorProducto
        negocioId={negocioId}
        id="sal-producto"
        valor={producto}
        alElegir={(p) => {
          setProducto(p);
          setSeries([]);
          setErrores({});
        }}
        idSiguiente="sal-cantidad"
        error={errores["sal-producto"]}
      />
      <ResumenStock
        ubicaciones={ubicaciones}
        stock={stock.datos}
        unidad={producto?.unidad ?? "unidad"}
        cargando={stock.cargando}
      />
      <TipoUbicacionSalida
        ubicaciones={ubicaciones}
        tipo={tipo}
        ubicacionId={ubicacionId}
        alCambiarTipo={(t) => {
          setTipo(t);
          setSeries([]);
        }}
        alCambiarUbicacion={(id) => {
          setUbicacionId(id);
          setSeries([]);
        }}
        errores={errores}
      />
      <CampoCantidad
        id="sal-cantidad"
        unidad={producto?.unidad}
        ayuda={ayudaSalida(conSigno, producto?.unidad)}
        valor={cantidadTexto}
        alCambiar={(t) => {
          setCantidadTexto(t);
          setSeries([]);
        }}
        errores={errores}
        inputMode={conSigno ? "text" : undefined}
      />
      {salidaConSerie && producto && (
        <SelectorSeries
          id="sal-series"
          negocioId={negocioId}
          productoId={producto.id}
          ubicacionId={ubicacionId}
          necesarias={necesarias}
          seleccion={series}
          alCambiar={setSeries}
          error={errores["sal-series"]}
        />
      )}
      <CampoMotivo
        id="sal-motivo"
        etiqueta="Motivo"
        ayuda="Obligatorio: queda en el kardex."
        valor={motivoTexto}
        alCambiar={setMotivoTexto}
        errores={errores}
      />
      <PieOperacion
        etiqueta="Registrar"
        pendiente={pendiente}
        error={general ?? error}
        exito={exito}
      />
    </form>
  );
}
