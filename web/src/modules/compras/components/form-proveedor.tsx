"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { guardarProveedor } from "../actions";
import type { FilaProveedor } from "../queries";
import { proveedorSchema } from "../schemas";

// Alta (sin proveedor) o edición. Editar reemplaza nombre, contacto y estado.
export function FormProveedor({
  negocioId,
  proveedor,
  alTerminar,
}: {
  negocioId: string;
  proveedor?: FilaProveedor;
  alTerminar: () => void;
}) {
  const { pendiente, error, ejecutar } = useAccion();
  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [contacto, setContacto] = useState(proveedor?.contacto ?? "");
  const [activo, setActivo] = useState(proveedor?.activo ?? true);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const p = proveedor ? `prov-${proveedor.id}` : "prov-nuevo";

  function enviar(e: FormEvent) {
    e.preventDefault();
    const datos = { negocioId, id: proveedor?.id, nombre, contacto, activo };
    if (!proveedorSchema.safeParse(datos).success)
      return setErrorNombre("Escribe el nombre del proveedor.");
    setErrorNombre(null);
    ejecutar(() => guardarProveedor(datos), alTerminar);
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label={proveedor ? "Editar proveedor" : "Proveedor nuevo"}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Campo id={`${p}-nombre`} etiqueta="Nombre" error={errorNombre ?? undefined}>
        <Input
          id={`${p}-nombre`}
          autoComplete="off"
          maxLength={200}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          {...propsCampo(`${p}-nombre`, errorNombre ? { [`${p}-nombre`]: errorNombre } : {})}
        />
      </Campo>
      <Campo id={`${p}-contacto`} etiqueta="Contacto" ayuda="Persona, teléfono o correo.">
        <Input
          id={`${p}-contacto`}
          autoComplete="off"
          maxLength={300}
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
        />
      </Campo>
      {proveedor && (
        <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="accent-primary border-input focus-visible:ring-ring/50 size-4 rounded focus-visible:ring-3"
          />
          Activo (aparece al registrar compras)
        </label>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {error}
        </p>
        <div className="flex gap-2">
          <Button type="submit" disabled={pendiente}>
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            {proveedor ? "Guardar cambios" : "Guardar proveedor"}
          </Button>
          {proveedor && (
            <Button type="button" variant="outline" onClick={alTerminar}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
