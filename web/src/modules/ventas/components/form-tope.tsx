"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { fijarTopeDescuento } from "../actions";
import { topeTextoSchema } from "../schemas-panel";

const MENSAJE = "Escribe un porcentaje de 0 a 100, con hasta 2 decimales. Ej.: 10 o 7,5.";

export function FormTope({ negocioId, vigente }: { negocioId: string; vigente: number }) {
  const { pendiente, error, ejecutar } = useAccion();
  const [texto, setTexto] = useState(String(vigente).replace(".", ","));
  const [invalido, setInvalido] = useState(false);
  const [hecho, setHecho] = useState(false);

  function enviar(e: FormEvent) {
    e.preventDefault();
    setHecho(false);
    if (!topeTextoSchema.safeParse(texto).success) return setInvalido(true);
    setInvalido(false);
    ejecutar(
      () => fijarTopeDescuento({ negocioId, tope: texto }),
      () => setHecho(true),
    );
  }
  const errores: Record<string, string> = invalido ? { "tope-valor": MENSAJE } : {};
  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Tope de descuento"
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 sm:max-w-56">
          <Campo id="tope-valor" etiqueta="Tope (%)" error={invalido ? MENSAJE : undefined}>
            <Input
              id="tope-valor"
              inputMode="decimal"
              autoComplete="off"
              className="cifra text-right"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              {...propsCampo("tope-valor", errores)}
            />
          </Campo>
        </div>
        <Button type="submit" disabled={pendiente} className="self-start sm:mt-[1.375rem]">
          {pendiente && <Loader2 className="animate-spin" aria-hidden />}
          Guardar tope
        </Button>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden">
        {error}
      </p>
      <p role="status" className="text-sm font-medium">
        {hecho && !error ? "Tope guardado." : ""}
      </p>
    </form>
  );
}
