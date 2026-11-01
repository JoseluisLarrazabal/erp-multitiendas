"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { stockProductoAccion, trasladar } from "../actions";
import {
  ayudaCantidad,
  textoAviso,
  formatearCantidad,
  mensajeCantidad,
  parsearCantidad,
  type ProductoElegible,
  type Ubicacion,
} from "../domain";
import { trasladoSchema } from "../schemas";
import { SelectUbicacion } from "./select-ubicacion";
import { CampoMotivo } from "./campo-motivo";
import { PieOperacion } from "./pie-operacion";
import { ResumenStock } from "./resumen-stock";
import { SelectorProducto } from "./selector-producto";
import { SelectorSeries } from "./selector-series";
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
  const [exito, setExito] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);
  const stock = useCarga(producto && `${negocioId}|${producto.id}`, () =>
    stockProductoAccion({ negocioId, productoId: producto!.id }),
  );

  const cantidad = producto ? parsearCantidad(cantidadTexto, producto.unidad) : null;
  const enOrigen = stock.datos?.[origenId] ?? 0;
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
    const nuevos: Errores = {};
    if (!producto) nuevos["tra-producto"] = "Elige un producto.";
    else if (cantidad === null) nuevos["tra-cantidad"] = mensajeCantidad(producto.unidad);
    if (origenId === destinoId) nuevos["tra-destino"] = "El destino debe ser distinto del origen.";
    if (producto?.controlaSerie && cantidad !== null && series.length !== cantidad)
      nuevos["tra-series"] = `Marca exactamente ${cantidad} serie(s).`;
    if (!Object.keys(nuevos).length && !trasladoSchema.safeParse(datos(operacionId)).success)
      nuevos["tra-cantidad"] = mensajeCantidad(producto?.unidad);
    setErrores(nuevos);
    const primero = Object.keys(nuevos)[0];
    if (primero) return e.currentTarget.querySelector<HTMLElement>(`#${primero}`)?.focus();
    if (cantidad! > enOrigen) return setAviso(true); // RN-04: se permite, pero se avisa antes
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
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="tra-origen" etiqueta="Origen">
          <SelectUbicacion
            ubicaciones={ubicaciones}
            id="tra-origen"
            value={origenId}
            onChange={(e) => {
              setOrigenId(e.target.value);
              setSeries([]);
            }}
          />
        </Campo>
        <Campo id="tra-destino" etiqueta="Destino" error={errores["tra-destino"]}>
          <SelectUbicacion
            ubicaciones={ubicaciones}
            id="tra-destino"
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            {...propsCampo("tra-destino", errores)}
          />
        </Campo>
      </div>
      <Campo
        id="tra-cantidad"
        etiqueta="Cantidad"
        ayuda={ayudaCantidad(producto?.unidad)}
        error={errores["tra-cantidad"]}
      >
        <Input
          id="tra-cantidad"
          value={cantidadTexto}
          onChange={(e) => {
            setCantidadTexto(e.target.value);
            setSeries([]);
          }}
          inputMode={producto?.unidad === "kg" ? "decimal" : "numeric"}
          autoComplete="off"
          className="h-10 sm:max-w-64"
          {...propsCampo("tra-cantidad", errores, true)}
        />
      </Campo>
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
        error={error}
        exito={exito}
      />
      <ConfirmarAccion
        abierto={aviso}
        alCambiarAbierto={setAviso}
        titulo="El traslado supera el stock del origen"
        descripcion={textoAviso(nombreOrigen, enOrigen, cantidad ?? 0, producto?.unidad)}
        confirmar="Trasladar igual"
        destructiva={false}
        accion={confirmarTraslado}
      />
    </form>
  );
}
