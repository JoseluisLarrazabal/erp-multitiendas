"use client";

import { useState, type FormEvent } from "react";
import { validarCampos, type Errores } from "@/components/panel/campo";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { stockProductoAccion, trasladar } from "../actions";
import {
  ayudaCantidad,
  textoAviso,
  formatearCantidad,
  mensajeCantidad,
  FALLA_STOCK_ORIGEN,
  MENSAJE_DATOS,
  parsearCantidad,
  type ProductoElegible,
  type Ubicacion,
} from "../domain";
import { trasladoSchema } from "../schemas";
import { camposTraslado } from "./campos-operacion";
import { CampoCantidad } from "./campo-cantidad";
import { CampoMotivo } from "./campo-motivo";
import { PieOperacion } from "./pie-operacion";
import { ResumenStock } from "./resumen-stock";
import { SelectorProducto } from "./selector-producto";
import { SelectorSeries } from "./selector-series";
import { UbicacionesTraslado } from "./ubicaciones-traslado";
import { useCarga } from "./use-carga";
import { useOperacion } from "./use-operacion";

export function FormTraslado({
  negocioId,
  ubicaciones,
}: {
  negocioId: string;
  ubicaciones: readonly Ubicacion[];
}) {
  const { operacionId, pendiente, error, enviar, renovar } = useOperacion();
  const [producto, setProducto] = useState<ProductoElegible | null>(null);
  const [origenId, setOrigenId] = useState(ubicaciones[0]?.id ?? "");
  const [destinoId, setDestinoId] = useState(ubicaciones[1]?.id ?? "");
  const [cantidadTexto, setCantidadTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [series, setSeries] = useState<string[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);
  const stock = useCarga(producto && `${negocioId}|${producto.id}`, () =>
    stockProductoAccion({ negocioId, productoId: producto!.id }),
  );

  const cantidad = producto ? parsearCantidad(cantidadTexto, producto.unidad) : null;
  // null = stock desconocido (cargando o fallido): no se inventa 0 ni se avisa de sobre-stock.
  const enOrigen = stock.datos ? (stock.datos[origenId] ?? 0) : null;
  const datos = (id: string) => ({
    operacionId: id,
    negocioId,
    productoId: producto?.id,
    origenId,
    destinoId,
    cantidad: cantidadTexto,
    motivo,
    serieIds: producto?.controlaSerie ? series : null,
  });

  function limpiar() {
    const hecho = producto!;
    setExito(
      `Traslado registrado: ${formatearCantidad(cantidad!, hecho.unidad)} de ${hecho.nombre}.`,
    );
    setProducto(null);
    setCantidadTexto("");
    setMotivo("");
    setSeries([]);
  }

  async function confirmarTraslado() {
    const r = await trasladar(datos(operacionId));
    if (r.ok) {
      renovar();
      limpiar();
    }
    return r;
  }

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExito(null);
    setGeneral(null);
    const nuevos: Errores = {};
    if (!producto) nuevos["tra-producto"] = "Elige un producto.";
    else if (cantidad === null) nuevos["tra-cantidad"] = mensajeCantidad(producto.unidad);
    if (producto?.controlaSerie && cantidad !== null && series.length !== cantidad)
      nuevos["tra-series"] = `Marca exactamente ${cantidad} serie(s).`;
    const primero = Object.keys(nuevos)[0];
    if (primero) {
      setErrores(nuevos);
      return e.currentTarget.querySelector<HTMLElement>(`#${primero}`)?.focus();
    }
    const v = validarCampos(
      e.currentTarget,
      trasladoSchema,
      datos(operacionId),
      camposTraslado(producto?.unidad),
    );
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    if (stock.cargando) return; // el botón ya está deshabilitado; Enter no debe saltarse la lectura
    if (enOrigen !== null && cantidad! > enOrigen) return setAviso(true); // RN-04: se permite, pero se avisa antes
    enviar((id) => trasladar(datos(id)), limpiar);
  }
  const nombreOrigen = ubicaciones.find((u) => u.id === origenId)?.nombre ?? "el origen";
  return (
    <form
      onSubmit={alEnviar}
      noValidate
      aria-label="Registrar traslado"
      className="flex max-w-2xl flex-col gap-5"
    >
      <SelectorProducto
        negocioId={negocioId}
        id="tra-producto"
        conInactivos
        valor={producto}
        alElegir={(p) => {
          setProducto(p);
          setSeries([]);
          setErrores({});
        }}
        idSiguiente="tra-cantidad"
        error={errores["tra-producto"]}
      />
      <ResumenStock
        ubicaciones={ubicaciones}
        stock={stock.datos}
        unidad={producto?.unidad ?? "unidad"}
        cargando={stock.cargando}
        falla={stock.error && FALLA_STOCK_ORIGEN}
      />
      <UbicacionesTraslado
        ubicaciones={ubicaciones}
        origenId={origenId}
        destinoId={destinoId}
        alCambiarOrigen={(id) => {
          setOrigenId(id);
          setSeries([]);
        }}
        alCambiarDestino={setDestinoId}
        errores={errores}
      />
      <CampoCantidad
        id="tra-cantidad"
        unidad={producto?.unidad}
        ayuda={ayudaCantidad(producto?.unidad)}
        valor={cantidadTexto}
        alCambiar={(t) => {
          setCantidadTexto(t);
          setSeries([]);
        }}
        errores={errores}
      />
      {producto?.controlaSerie && cantidad !== null && (
        <SelectorSeries
          id="tra-series"
          negocioId={negocioId}
          productoId={producto.id}
          ubicacionId={origenId}
          necesarias={cantidad}
          seleccion={series}
          alCambiar={setSeries}
          error={errores["tra-series"]}
        />
      )}
      <CampoMotivo
        id="tra-motivo"
        etiqueta="Motivo (opcional)"
        valor={motivo}
        alCambiar={setMotivo}
      />
      <PieOperacion
        etiqueta="Registrar traslado"
        pendiente={pendiente}
        error={general ?? error}
        exito={exito}
        deshabilitado={stock.cargando}
      />
      <ConfirmarAccion
        abierto={aviso}
        alCambiarAbierto={setAviso}
        titulo="El traslado supera el stock del origen"
        descripcion={textoAviso(nombreOrigen, enOrigen ?? 0, cantidad ?? 0, producto?.unidad)}
        confirmar="Trasladar igual"
        destructiva={false}
        accion={confirmarTraslado}
      />
    </form>
  );
}
