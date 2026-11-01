"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import {
  Campo,
  propsCampo,
  validarCampos,
  type Campos,
  type Errores,
} from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { asignarFoto, guardarProducto } from "../actions";
import {
  ETIQUETA_TIPO_PRODUCTO,
  ETIQUETA_UNIDAD,
  MENSAJE_DATOS,
  type Categoria,
  type ProductoDetalle,
} from "../domain";
import { subirFoto } from "../foto";
import { productoSchema } from "../schemas";
import { FotoCampo } from "./foto-campo";

type Props = {
  negocioId: string;
  tipos: readonly string[];
  categorias: readonly Categoria[];
  // Sin producto = alta.
  producto?: ProductoDetalle;
  fotoUrl?: string | null;
};

const CAMPOS: Campos = {
  codigo: { id: "producto-codigo", mensaje: "Escribe el código (hasta 60 caracteres)." },
  nombre: { id: "producto-nombre", mensaje: "Escribe el nombre (hasta 200 caracteres)." },
  codigoBarras: {
    id: "producto-barras",
    mensaje: "El código de barras admite hasta 60 caracteres.",
  },
  garantiaMeses: { id: "producto-garantia", mensaje: "Usa un número entero de meses." },
  stockMinimo: { id: "producto-minimo", mensaje: "Usa un número, con hasta 3 decimales." },
};

export function FormProducto({ negocioId, tipos, categorias, producto, fotoUrl = null }: Props) {
  const router = useRouter();
  const { pendiente, error, ejecutar } = useAccion();
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const foto = useRef<File | null>(null);
  // Si el alta ya creó el producto pero falló la foto, el reintento edita ese producto, no crea otro.
  const idCreado = useRef<string | null>(null);
  const valores = producto;

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const texto = (n: string) => String(f.get(n) ?? "");
    setGuardado(false);
    // Se manda al servidor el texto crudo: el schema transforma, y el servidor lo valida de nuevo desde cero.
    const entrada = {
      negocioId,
      id: producto?.id ?? idCreado.current,
      codigo: texto("codigo"),
      codigoBarras: texto("codigoBarras"),
      nombre: texto("nombre"),
      marca: texto("marca"),
      modelo: texto("modelo"),
      categoriaId: texto("categoriaId") || null,
      tipo: texto("tipo"),
      unidad: texto("unidad"),
      controlaSerie: f.get("controlaSerie") === "on",
      garantiaMeses: texto("garantiaMeses"),
      stockMinimo: texto("stockMinimo"),
    };
    const v = validarCampos(e.currentTarget, productoSchema, entrada, CAMPOS);
    if ("errores" in v) {
      setErrores(v.errores);
      return setGeneral(Object.keys(v.errores).length ? null : MENSAJE_DATOS);
    }
    setErrores({});
    setGeneral(null);
    ejecutar(
      async () => {
        const r = await guardarProducto(entrada);
        if (!r.ok) return r;
        idCreado.current = r.data.id;
        if (foto.current) {
          const ruta = await subirFoto(
            negocioId,
            r.data.id,
            foto.current,
            producto?.fotoPath ?? null,
          );
          const hecho = ruta ? await asignarFoto({ productoId: r.data.id, fotoPath: ruta }) : null;
          if (!hecho?.ok) {
            return {
              ok: false as const,
              error: "El producto se guardó, pero la foto no se pudo subir. Inténtalo de nuevo.",
            };
          }
          foto.current = null;
        }
        return { ok: true as const, data: null };
      },
      () => {
        if (!producto) router.push(`/panel/productos/${idCreado.current}`);
        else {
          setGuardado(true);
          router.refresh();
        }
      },
    );
  }

  const mensaje = general ?? error;
  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Datos del producto"
      className="grid gap-4 sm:grid-cols-2"
    >
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
            onChange={(e) => setNombre(e.target.value)}
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
        <FotoCampo urlActual={fotoUrl} nombre={nombre} alElegir={(a) => (foto.current = a)} />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {mensaje}
        </p>
        <p role="status" className="text-sm font-medium">
          {guardado && !mensaje ? "Producto guardado." : ""}
        </p>
        <Button type="submit" disabled={pendiente} className="h-10 self-start">
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          {producto ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
