"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, propsCampo } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { guardarCliente } from "../actions";
import type { FilaCliente } from "../lecturas-panel";
import { clientePanelSchema } from "../schemas";

const FALTA_NOMBRE = "Escribe el nombre del cliente.";

// Alta (id undefined) o edición de un cliente. Editar reemplaza los cuatro campos.
function FormCliente({
  negocioId,
  cliente,
  alTerminar,
}: {
  negocioId: string;
  cliente?: FilaCliente;
  alTerminar: () => void;
}) {
  const { pendiente, error, ejecutar } = useAccion();
  const [v, setV] = useState({
    nombre: cliente?.nombre ?? "",
    ci_nit: cliente?.ci_nit ?? "",
    telefono: cliente?.telefono ?? "",
    direccion: cliente?.direccion ?? "",
  });
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const p = cliente ? `cli-${cliente.id}` : "cli-nuevo";

  function enviar(e: FormEvent) {
    e.preventDefault();
    const datos = { negocioId, id: cliente?.id, ...v };
    if (!clientePanelSchema.safeParse(datos).success) return setErrorNombre(FALTA_NOMBRE);
    setErrorNombre(null);
    ejecutar(() => guardarCliente(datos), alTerminar);
  }
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value });

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label={cliente ? "Editar cliente" : "Cliente nuevo"}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Campo id={`${p}-nombre`} etiqueta="Nombre" error={errorNombre ?? undefined}>
        <Input
          id={`${p}-nombre`}
          autoComplete="off"
          maxLength={200}
          className="h-10"
          value={v.nombre}
          onChange={set("nombre")}
          {...propsCampo(`${p}-nombre`, errorNombre ? { [`${p}-nombre`]: errorNombre } : {})}
        />
      </Campo>
      <Campo id={`${p}-doc`} etiqueta="CI o NIT" ayuda="Único dentro del negocio.">
        <Input
          id={`${p}-doc`}
          autoComplete="off"
          maxLength={30}
          className="h-10"
          value={v.ci_nit}
          onChange={set("ci_nit")}
        />
      </Campo>
      <Campo id={`${p}-tel`} etiqueta="Teléfono">
        <Input
          id={`${p}-tel`}
          inputMode="tel"
          autoComplete="off"
          maxLength={30}
          className="h-10"
          value={v.telefono}
          onChange={set("telefono")}
        />
      </Campo>
      <Campo id={`${p}-dir`} etiqueta="Dirección">
        <Input
          id={`${p}-dir`}
          autoComplete="off"
          maxLength={300}
          className="h-10"
          value={v.direccion}
          onChange={set("direccion")}
        />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {error}
        </p>
        <div className="flex gap-2">
          <Button type="submit" disabled={pendiente} className="h-10">
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            {cliente ? "Guardar cambios" : "Guardar cliente"}
          </Button>
          {cliente && (
            <Button type="button" variant="outline" className="h-10" onClick={alTerminar}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export function NuevoCliente({ negocioId }: { negocioId: string }) {
  const [clave, setClave] = useState(0);
  const [hecho, setHecho] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {/* La key reinicia el formulario tras guardar. */}
      <FormCliente
        key={clave}
        negocioId={negocioId}
        alTerminar={() => {
          setClave(clave + 1);
          setHecho(true);
        }}
      />
      <p role="status" className="text-sm font-medium">
        {hecho ? "Cliente guardado." : ""}
      </p>
    </div>
  );
}

export function ListaClientes({
  negocioId,
  clientes,
  puedeEditar,
}: {
  negocioId: string;
  clientes: readonly FilaCliente[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <ul aria-label="Clientes" className="bg-card shadow-card divide-y rounded-xl border">
      {clientes.map((c) => (
        <li key={c.id} className="px-4 py-3">
          {editando === c.id ? (
            <FormCliente negocioId={negocioId} cliente={c} alTerminar={() => setEditando(null)} />
          ) : (
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[minmax(0,1.4fr)_9rem_9rem_minmax(0,1fr)_auto]">
              <span className="min-w-0 truncate font-medium">{c.nombre}</span>
              <span className="text-muted-foreground text-sm tabular-nums max-md:order-3 max-md:col-span-2">
                {c.ci_nit ?? "Sin documento"}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums max-md:order-4 max-md:col-span-2">
                {c.telefono ?? ""}
              </span>
              <span className="text-muted-foreground min-w-0 truncate text-sm max-md:order-5 max-md:col-span-2">
                {c.direccion ?? ""}
              </span>
              {puedeEditar && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 md:min-h-8"
                  aria-label={`Editar a ${c.nombre}`}
                  onClick={() => setEditando(c.id)}
                >
                  <Pencil aria-hidden /> Editar
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
