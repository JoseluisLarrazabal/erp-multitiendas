"use client";

import { useRef, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BusquedaConteo({
  valor,
  alCambiar,
  alBuscar,
}: {
  valor: string;
  alCambiar: (valor: string) => void;
  alBuscar: (e: FormEvent) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  return (
    <form
      onSubmit={(e) => {
        alBuscar(e);
        // El texto queda seleccionado: el siguiente escaneo lo reemplaza sin borrar a mano.
        campo.current?.select();
      }}
      role="search"
      aria-label="Buscar productos a contar"
      className="flex min-w-60 flex-1 items-end gap-2"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="cont-q">Buscar</Label>
        <Input
          ref={campo}
          id="cont-q"
          type="search"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          placeholder="Código, código de barras o nombre"
          autoComplete="off"
          className="h-10"
        />
      </div>
      <Button type="submit" className="h-10">
        <Search aria-hidden /> Buscar
      </Button>
    </form>
  );
}
