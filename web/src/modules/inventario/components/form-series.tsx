"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, propsCampo, type Errores } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { registrarSeries } from "../actions";
import { MAX_SERIES, type Ubicacion } from "../domain";
import { seriesSchema } from "../schemas";
import { SelectUbicacion } from "./select-ubicacion";

// Carga números de serie de unidades que ya están en el stock (RF-INV). No genera movimientos.
export function FormSeries({
  negocioId,
  productoId,
  ubicaciones,
}: {
  negocioId: string;
  productoId: string;
  ubicaciones: readonly Ubicacion[];
}) {
  const { pendiente, error, ejecutar } = useAccion();
  const [texto, setTexto] = useState("");
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? "");
  const [errores, setErrores] = useState<Errores>({});
  const [exito, setExito] = useState<string | null>(null);

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExito(null);
    const datos = { negocioId, productoId, ubicacionId, series: texto };
    if (!seriesSchema.safeParse(datos).success) {
      setErrores({ "ser-texto": `Escribe de 1 a ${MAX_SERIES} series, una por línea.` });
      return e.currentTarget.querySelector<HTMLElement>("#ser-texto")?.focus();
    }
    setErrores({});
    let registradas = 0;
    ejecutar(
      async () => {
        const r = await registrarSeries(datos);
        if (!r.ok) return r;
        registradas = r.data.registradas;
        return { ok: true, data: null };
      },
      () => {
        setTexto("");
        setExito(`Se registraron ${registradas} serie(s).`);
      },
    );
  }

  return (
    <form
      onSubmit={alEnviar}
      noValidate
      aria-label="Registrar series"
      className="flex max-w-xl flex-col gap-4"
    >
      <Campo id="ser-ubicacion" etiqueta="Ubicación de esas unidades">
        <SelectUbicacion
          ubicaciones={ubicaciones}
          id="ser-ubicacion"
          value={ubicacionId}
          onChange={(e) => setUbicacionId(e.target.value)}
        />
      </Campo>
      <Campo
        id="ser-texto"
        etiqueta="Números de serie"
        ayuda="Una por línea. No pueden superar el stock de la ubicación."
        error={errores["ser-texto"]}
      >
        <textarea
          id="ser-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          autoComplete="off"
          spellCheck={false}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-lg border bg-transparent px-2.5 py-2 font-mono text-base outline-none focus-visible:ring-3 md:text-sm"
          {...propsCampo("ser-texto", errores, true)}
        />
      </Campo>
      <div>
        <Button type="submit" disabled={pendiente} className="h-10">
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          Registrar series
        </Button>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {error}
      </p>
      <p role="status" className="text-sm font-medium">
        {exito && !error ? exito : ""}
      </p>
    </form>
  );
}
