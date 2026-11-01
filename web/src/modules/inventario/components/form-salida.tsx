"use client";

import { useRef, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import { registrarSalida, stockProductoAccion } from "../actions";
import {
  ayudaSalida,
  formatearCantidad,
  mensajeCantidad,
  parsearCantidad,
  TIPOS_SALIDA,
  type ProductoElegible,
  type TipoSalida,
  type Ubicacion,
} from "../domain";
import { salidaSchema } from "../schemas";
import { SelectUbicacion } from "./select-ubicacion";
import { CampoMotivo } from "./campo-motivo";
import { PieOperacion } from "./pie-operacion";
import { ResumenStock } from "./resumen-stock";
import { SelectorProducto } from "./selector-producto";
import { SelectorSeries } from "./selector-series";
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
    if (!Object.keys(nuevos).length && !salidaSchema.safeParse(datos).success)
      nuevos["sal-cantidad"] = mensajeCantidad(producto?.unidad, conSigno);
    setErrores(nuevos);
    const primero = Object.keys(nuevos)[0];
    if (primero) return formulario.current?.querySelector<HTMLElement>(`#${primero}`)?.focus();

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
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="sal-tipo" etiqueta="Tipo">
          <SelectNativo
            id="sal-tipo"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoSalida);
              setSeries([]);
            }}
          >
            {TIPOS_SALIDA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo id="sal-ubicacion" etiqueta="Ubicación">
          <SelectUbicacion
            ubicaciones={ubicaciones}
            id="sal-ubicacion"
            value={ubicacionId}
            onChange={(e) => {
              setUbicacionId(e.target.value);
              setSeries([]);
            }}
          />
        </Campo>
      </div>
      <Campo
        id="sal-cantidad"
        etiqueta="Cantidad"
        ayuda={ayudaSalida(conSigno, producto?.unidad)}
        error={errores["sal-cantidad"]}
      >
        <Input
          id="sal-cantidad"
          value={cantidadTexto}
          onChange={(e) => {
            setCantidadTexto(e.target.value);
            setSeries([]);
          }}
          inputMode={conSigno ? "text" : producto?.unidad === "kg" ? "decimal" : "numeric"}
          autoComplete="off"
          className="h-10 sm:max-w-64"
          {...propsCampo("sal-cantidad", errores, true)}
        />
      </Campo>
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
      <PieOperacion etiqueta="Registrar" pendiente={pendiente} error={error} exito={exito} />
    </form>
  );
}
