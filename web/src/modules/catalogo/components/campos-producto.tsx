import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import {
  ETIQUETA_TIPO_PRODUCTO,
  ETIQUETA_UNIDAD,
  type Categoria,
  type ProductoDetalle,
} from "../domain";
import { FotoCampo } from "./foto-campo";

type Props = {
  esFrial: boolean;
  tipos: readonly string[];
  categorias: readonly Categoria[];
  // Valores iniciales (sin producto = alta).
  valores?: ProductoDetalle;
  errores: Errores;
  nombre: string;
  alCambiarNombre: (nombre: string) => void;
  fotoUrl: string | null;
  alElegirFoto: (archivo: File | null) => void;
  alProcesarFoto: (ocupado: boolean) => void;
};

// Los campos del formulario de producto en dos columnas, con la foto aparte a la derecha en pantalla ancha.
export function CamposProducto({
  esFrial,
  tipos,
  categorias,
  valores,
  errores,
  nombre,
  alCambiarNombre,
  fotoUrl,
  alElegirFoto,
  alProcesarFoto,
}: Props) {
  const [unidad, setUnidad] = useState(valores?.unidad ?? "unidad");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="producto-codigo" etiqueta="Código" error={errores["producto-codigo"]}>
          <Input
            id="producto-codigo"
            name="codigo"
            required
            defaultValue={valores?.codigo}
            autoComplete="off"
            {...propsCampo("producto-codigo", errores)}
          />
        </Campo>
        <Campo id="producto-barras" etiqueta="Código de barras" error={errores["producto-barras"]}>
          <Input
            id="producto-barras"
            name="codigoBarras"
            defaultValue={valores?.codigoBarras}
            autoComplete="off"
            inputMode="numeric"
            {...propsCampo("producto-barras", errores)}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo id="producto-nombre" etiqueta="Nombre" error={errores["producto-nombre"]}>
            <Input
              id="producto-nombre"
              name="nombre"
              required
              value={nombre}
              onChange={(e) => alCambiarNombre(e.target.value)}
              autoComplete="off"
              {...propsCampo("producto-nombre", errores)}
            />
          </Campo>
        </div>
        <Campo id="producto-marca" etiqueta="Marca">
          <Input
            id="producto-marca"
            name="marca"
            defaultValue={valores?.marca}
            autoComplete="off"
          />
        </Campo>
        <Campo id="producto-modelo" etiqueta="Modelo">
          <Input
            id="producto-modelo"
            name="modelo"
            defaultValue={valores?.modelo}
            autoComplete="off"
          />
        </Campo>
        <Campo id="producto-categoria" etiqueta="Categoría">
          <SelectNativo
            id="producto-categoria"
            name="categoriaId"
            defaultValue={valores?.categoriaId ?? ""}
          >
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo id="producto-tipo" etiqueta="Tipo">
          <SelectNativo id="producto-tipo" name="tipo" defaultValue={valores?.tipo ?? tipos[0]}>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO_PRODUCTO[t] ?? t}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo
          id="producto-unidad"
          etiqueta="Unidad"
          ayuda="Un producto con movimientos no cambia de unidad."
        >
          <SelectNativo
            id="producto-unidad"
            name="unidad"
            defaultValue={valores?.unidad ?? "unidad"}
            onChange={(e) => setUnidad(e.target.value)}
            aria-describedby="producto-unidad-ayuda"
          >
            {Object.entries(ETIQUETA_UNIDAD).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        {esFrial && unidad === "unidad" && (
          <Campo
            id="producto-peso"
            etiqueta="Peso del paquete (kg)"
            ayuda="Para paquetes de peso fijo. Si cambia el peso, crea otro producto."
            error={errores["producto-peso"]}
          >
            <Input
              id="producto-peso"
              name="pesoPaqueteKg"
              defaultValue={valores?.pesoPaqueteKg}
              inputMode="decimal"
              autoComplete="off"
              {...propsCampo("producto-peso", errores, true)}
            />
          </Campo>
        )}
        <Campo id="producto-minimo" etiqueta="Stock mínimo" error={errores["producto-minimo"]}>
          <Input
            id="producto-minimo"
            name="stockMinimo"
            defaultValue={valores?.stockMinimo}
            inputMode="decimal"
            autoComplete="off"
            {...propsCampo("producto-minimo", errores)}
          />
        </Campo>
        <Campo
          id="producto-garantia"
          etiqueta="Garantía (meses)"
          error={errores["producto-garantia"]}
        >
          <Input
            id="producto-garantia"
            name="garantiaMeses"
            defaultValue={valores?.garantiaMeses}
            inputMode="numeric"
            autoComplete="off"
            {...propsCampo("producto-garantia", errores)}
          />
        </Campo>
        <div className="bg-card flex items-start gap-3 rounded-lg border p-3.5 sm:col-span-2">
          <input
            id="producto-serie"
            type="checkbox"
            name="controlaSerie"
            defaultChecked={valores?.controlaSerie}
            aria-describedby="producto-serie-ayuda"
            className="accent-primary mt-0.5 size-5 shrink-0"
          />
          <div className="flex flex-col gap-0.5 text-sm">
            <label htmlFor="producto-serie" className="font-semibold">
              Controla número de serie
            </label>
            <p id="producto-serie-ayuda" className="text-muted-foreground text-[13px]">
              Al vender, dar salida o trasladar, se elige el número de serie de cada unidad.
            </p>
          </div>
        </div>
      </div>
      <FotoCampo
        urlActual={fotoUrl}
        nombre={nombre}
        alElegir={alElegirFoto}
        alProcesar={alProcesarFoto}
      />
    </div>
  );
}
