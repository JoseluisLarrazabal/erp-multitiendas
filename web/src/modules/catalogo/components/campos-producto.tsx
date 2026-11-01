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
  tipos: readonly string[];
  categorias: readonly Categoria[];
  // Valores iniciales (sin producto = alta).
  valores?: ProductoDetalle;
  errores: Errores;
  nombre: string;
  alCambiarNombre: (nombre: string) => void;
  fotoUrl: string | null;
  alElegirFoto: (archivo: File | null) => void;
};

// Los campos del formulario de producto, en orden de pantalla. Dentro de un grid de 2 columnas.
export function CamposProducto({
  tipos,
  categorias,
  valores,
  errores,
  nombre,
  alCambiarNombre,
  fotoUrl,
  alElegirFoto,
}: Props) {
  return (
    <>
      <Campo id="producto-codigo" etiqueta="Código" error={errores["producto-codigo"]}>
        <Input
          id="producto-codigo"
          name="codigo"
          required
          defaultValue={valores?.codigo}
          autoComplete="off"
          className="h-10"
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
          className="h-10"
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
            className="h-10"
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
          className="h-10"
        />
      </Campo>
      <Campo id="producto-modelo" etiqueta="Modelo">
        <Input
          id="producto-modelo"
          name="modelo"
          defaultValue={valores?.modelo}
          autoComplete="off"
          className="h-10"
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
          aria-describedby="producto-unidad-ayuda"
        >
          {Object.entries(ETIQUETA_UNIDAD).map(([k, t]) => (
            <option key={k} value={k}>
              {t}
            </option>
          ))}
        </SelectNativo>
      </Campo>
      <Campo id="producto-minimo" etiqueta="Stock mínimo" error={errores["producto-minimo"]}>
        <Input
          id="producto-minimo"
          name="stockMinimo"
          defaultValue={valores?.stockMinimo}
          inputMode="decimal"
          autoComplete="off"
          className="h-10"
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
          className="h-10"
          {...propsCampo("producto-garantia", errores)}
        />
      </Campo>
      <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="controlaSerie"
          defaultChecked={valores?.controlaSerie}
          className="accent-primary size-4"
        />
        Controla número de serie
      </label>
      <div className="sm:col-span-2">
        <FotoCampo urlActual={fotoUrl} nombre={nombre} alElegir={alElegirFoto} />
      </div>
    </>
  );
}
