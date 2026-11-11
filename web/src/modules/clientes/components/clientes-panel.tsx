"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fila, ListaFilas } from "@/components/ui/lista-filas";
import { Campo, propsCampo } from "@/components/panel/campo";
import { useAccion } from "@/components/panel/use-accion";
import { guardarCliente } from "../actions";
import type { FilaCliente } from "../lecturas-panel";
import { clientePanelSchema } from "../schemas";

const COLUMNAS = "md:grid-cols-[minmax(0,1.4fr)_9rem_9rem_minmax(0,1fr)_6rem]";
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
          value={v.telefono}
          onChange={set("telefono")}
        />
      </Campo>
      <Campo id={`${p}-dir`} etiqueta="Dirección">
        <Input
          id={`${p}-dir`}
          autoComplete="off"
          maxLength={300}
          value={v.direccion}
          onChange={set("direccion")}
        />
      </Campo>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {error}
        </p>
        <div className="flex gap-2">
          <Button type="submit" disabled={pendiente}>
            {pendiente && <Loader2 className="animate-spin" aria-hidden />}
            {cliente ? "Guardar cambios" : "Guardar cliente"}
          </Button>
          {cliente && (
            <Button type="button" variant="outline" onClick={alTerminar}>
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
    <ListaFilas
      etiqueta="Clientes"
      columnas={COLUMNAS}
      cabeceras={
        <>
          <span>Nombre</span>
          <span>CI o NIT</span>
          <span>Teléfono</span>
          <span>Dirección</span>
          <span />
        </>
      }
    >
      {clientes.map((c) =>
        editando === c.id ? (
          <Fila key={c.id} columnas="grid-cols-1" className="py-4">
            <FormCliente negocioId={negocioId} cliente={c} alTerminar={() => setEditando(null)} />
          </Fila>
        ) : (
          <Fila key={c.id} columnas={`grid-cols-[1fr_auto] ${COLUMNAS}`}>
            <span className="min-w-0 truncate font-semibold">{c.nombre}</span>
            <span
              className={`text-muted-foreground text-[13px] max-md:order-3 max-md:col-span-2 ${c.ci_nit ? "font-mono" : ""}`}
            >
              {c.ci_nit ?? "Sin documento"}
            </span>
            <span className="text-muted-foreground cifra text-[13px] max-md:order-4 max-md:col-span-2">
              {c.telefono ?? ""}
            </span>
            <span className="text-muted-foreground min-w-0 truncate text-sm max-md:order-5 max-md:col-span-2">
              {c.direccion ?? ""}
            </span>
            {puedeEditar && (
              <Button
                type="button"
                variant="outline"
                aria-label={`Editar a ${c.nombre}`}
                onClick={() => setEditando(c.id)}
              >
                <Pencil aria-hidden /> Editar
              </Button>
            )}
          </Fila>
        ),
      )}
    </ListaFilas>
  );
}
