"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, Package } from "lucide-react";
import { errorDeFoto, FOTO_ORIGINAL_MAX_BYTES, FOTO_TIPOS } from "../domain";
import { comprimirFoto } from "../foto";

type Props = { urlActual: string | null; nombre: string; alElegir: (archivo: File | null) => void };

// Vista previa local (URL de objeto) de la foto elegida; sin elegir, la actual firmada. Valida antes de subir.
export function FotoCampo({ urlActual, nombre, alElegir }: Props) {
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La URL de objeto retiene memoria hasta revocarse: se libera al cambiar la foto o desmontar.
  useEffect(() => () => (vista ? URL.revokeObjectURL(vista) : undefined), [vista]);

  async function cambiar(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const original = input.files?.[0] ?? null;
    // Tipo y tope del original antes de comprimir; el tope del bucket (5 MB), sobre el resultado.
    let problema = original ? errorDeFoto(original, FOTO_ORIGINAL_MAX_BYTES) : null;
    let archivo = original;
    if (original && !problema) {
      archivo = await comprimirFoto(original);
      problema = errorDeFoto(archivo);
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
      <span className="text-sm font-medium">Foto</span>
      <div className="flex items-center gap-4">
        <span className="bg-muted text-muted-foreground grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border">
          {imagen ? (
            // Vista previa local o URL firmada: no pasa por el optimizador de next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagen}
              alt={`Foto de ${nombre || "el producto"}`}
              className="size-full object-cover"
            />
          ) : (
            <Package className="size-8" aria-label="Sin foto" role="img" />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label
            htmlFor="producto-foto"
            className="border-input hover:bg-muted focus-within:ring-ring/50 inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-within:ring-3"
          >
            <ImagePlus className="size-4" aria-hidden />
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
          <p id="producto-foto-ayuda" className="text-muted-foreground text-xs">
            JPG, PNG o WebP. Se achica sola antes de subir.
          </p>
        </div>
      </div>
      <p role="alert" className="text-destructive text-xs empty:hidden">
        {error}
      </p>
    </div>
  );
}
