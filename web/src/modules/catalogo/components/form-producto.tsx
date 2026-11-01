"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validarCampos, type Campos, type Errores } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { guardarProducto } from "../actions";
import { MENSAJE_DATOS, type Categoria, type ProductoDetalle } from "../domain";
import { subirYAsignarFoto } from "../foto";
import { productoSchema } from "../schemas";
import { CamposProducto } from "./campos-producto";

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
          const hecha = await subirYAsignarFoto(
            negocioId,
            r.data.id,
            foto.current,
            producto?.fotoPath ?? null,
          );
          if (!hecha) {
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
      <CamposProducto
        tipos={tipos}
        categorias={categorias}
        valores={valores}
        errores={errores}
        nombre={nombre}
        alCambiarNombre={setNombre}
        fotoUrl={fotoUrl}
        alElegirFoto={(archivo) => (foto.current = archivo)}
      />
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
