"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Package } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { errorDeFoto, FOTO_ORIGINAL_MAX_BYTES, FOTO_TIPOS } from "../domain";
import { comprimirFoto } from "../foto";

type Props = {
  urlActual: string | null;
  nombre: string;
  alElegir: (archivo: File | null) => void;
  // Avisa al formulario mientras la foto se comprime: no debe guardarse con la foto a medias.
  alProcesar: (ocupado: boolean) => void;
};

// Vista previa local (URL de objeto) de la foto elegida; sin elegir, la actual firmada. Valida antes de subir.
export function FotoCampo({ urlActual, nombre, alElegir, alProcesar }: Props) {
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  // Turno de la última elección: el resultado de una compresión que ya no es la última se descarta.
  const turno = useRef(0);

  // La URL de objeto retiene memoria hasta revocarse: se libera al cambiar la foto o desmontar.
  useEffect(() => () => (vista ? URL.revokeObjectURL(vista) : undefined), [vista]);

  async function cambiar(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const original = input.files?.[0] ?? null;
    const mio = ++turno.current;
    // Tipo y tope del original antes de comprimir; el tope del bucket (5 MB), sobre el resultado.
    let problema = original ? errorDeFoto(original, FOTO_ORIGINAL_MAX_BYTES) : null;
    let archivo = original;
    if (original && !problema) {
      setProcesando(true);
      alProcesar(true);
      archivo = await comprimirFoto(original);
      if (mio !== turno.current) return;
      setProcesando(false);
      alProcesar(false);
      problema = errorDeFoto(archivo);
    } else {
      setProcesando(false);
      alProcesar(false);
    }
    setError(problema);
    if (!archivo || problema) {
      setVista(null);
      alElegir(null);
      if (problema) input.value = "";
      return;
    }
    setVista(URL.createObjectURL(archivo));
    alElegir(archivo);
  }

  const imagen = vista ?? urlActual;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">Foto</span>
      <div className="bg-surface flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-4 text-center">
        <span className="bg-muted text-muted-foreground grid size-32 shrink-0 place-items-center overflow-hidden rounded-lg border">
          {imagen ? (
            // Vista previa local o URL firmada: no pasa por el optimizador de next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagen}
              alt={`Foto de ${nombre || "el producto"}`}
              className="size-full object-cover"
            />
          ) : (
            <Package className="size-10" aria-label="Sin foto" role="img" />
          )}
        </span>
        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <label
            htmlFor="producto-foto"
            className={`${buttonVariants({ variant: "outline" })} focus-within:ring-ring w-fit cursor-pointer focus-within:ring-3`}
          >
            <ImagePlus aria-hidden />
            {imagen ? "Cambiar foto" : "Elegir foto"}
            <input
              id="producto-foto"
              type="file"
              accept={Object.keys(FOTO_TIPOS).join(",")}
              onChange={cambiar}
              className="sr-only"
              aria-describedby="producto-foto-ayuda"
              aria-invalid={error ? true : undefined}
            />
          </label>
          <p id="producto-foto-ayuda" className="text-muted-foreground text-[13px]">
            JPG, PNG o WebP. Se achica sola antes de subir.
          </p>
        </div>
      </div>
      <p role="status" className="text-muted-foreground text-xs empty:hidden">
        {procesando ? "Preparando la foto…" : ""}
      </p>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {error}
      </p>
    </div>
  );
}
