"use client";

import { Loader2, Search, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import { normalizarDocumento, type ClienteElegido } from "../domain";
import { buscarClientes, crearCliente } from "../queries";

// Cliente general = null. Busca por nombre o documento; crea rápido con guardar_cliente.
export function SelectorCliente({
  negocioId,
  obligatorio,
  valor,
  alCambiar,
}: {
  negocioId: string;
  obligatorio: boolean;
  valor: ClienteElegido | null;
  alCambiar: (c: ClienteElegido | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ClienteElegido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", ci_nit: "", telefono: "" });
  const [error, setError] = useState<string | null>(null);
  // Aviso de documento repetido: aparte de `error` porque la búsqueda que sigue lo borraría al responder.
  const [duplicado, setDuplicado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  // Buscar y crear clientes necesita el servidor; sin red se vende a cliente general (RF-VEN-14).
  const sinRed = useSinRed();

  useEffect(() => {
    if (!abierto || creando) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarClientes(createClient(), negocioId, q);
      if (cancelado) return;
      setBuscando(false);
      if (r.ok) {
        setResultados(r.data);
        setError(null);
      } else setError(r.error);
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
      setBuscando(false);
    };
  }, [q, abierto, creando, negocioId]);

  function elegir(c: ClienteElegido | null) {
    alCambiar(c);
    setAbierto(false);
    setCreando(false);
    setQ("");
    setError(null);
    setDuplicado(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    const r = await crearCliente(createClient(), negocioId, nuevo);
    setGuardando(false);
    if (r.ok) {
      setNuevo({ nombre: "", ci_nit: "", telefono: "" });
      return elegir(r.data);
    }
    // Duplicado: pasa a la búsqueda por documento para elegir el existente.
    if (r.codigo === "ERP_CLIENTE_DUPLICADO") {
      setDuplicado(r.error);
      setCreando(false);
      setQ(normalizarDocumento(nuevo.ci_nit));
    } else setError(r.error);
  }

  if (!abierto)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground shrink-0">Cliente:</span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {valor
            ? `${valor.nombre}${valor.documento ? ` · ${valor.documento}` : ""}`
            : obligatorio
              ? "Falta elegir"
              : "General"}
        </span>
        {valor && !obligatorio && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label="Quitar cliente"
            onClick={() => elegir(null)}
          >
            <X />
          </Button>
        )}
        <Button
          type="button"
          variant={obligatorio && !valor ? "default" : "outline"}
          className="h-10"
          disabled={sinRed}
          title={sinRed ? "Buscar o crear clientes necesita conexión" : undefined}
          onClick={() => {
            setAbierto(true);
            setTimeout(() => entrada.current?.focus(), 0);
          }}
        >
          {valor ? "Cambiar" : "Elegir"}
        </Button>
        {sinRed && (
          <span role="status" className="text-muted-foreground w-full text-xs">
            Elegir cliente necesita conexión.
          </span>
        )}
      </div>
    );

  return (
    <div className="bg-muted flex flex-col gap-2 rounded-lg p-2.5">
      {creando ? (
        <form onSubmit={guardar} className="flex flex-col gap-2">
          <Input
            aria-label="Nombre del cliente"
            placeholder="Nombre"
            autoFocus
            className="h-10"
            autoComplete="off"
            spellCheck={false}
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="CI o NIT"
              placeholder="CI o NIT"
              className="h-10"
              autoComplete="off"
              spellCheck={false}
              value={nuevo.ci_nit}
              onChange={(e) => setNuevo({ ...nuevo, ci_nit: e.target.value })}
            />
            <Input
              aria-label="Teléfono"
              placeholder="Teléfono"
              inputMode="tel"
              className="h-10"
              value={nuevo.telefono}
              onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="h-10 flex-1" disabled={guardando}>
              {guardando && <Loader2 className="animate-spin" aria-hidden />} Guardar cliente
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setCreando(false)}
            >
              Volver
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              ref={entrada}
              aria-label="Buscar cliente"
              placeholder="Nombre o documento"
              className="h-10 pl-8"
              autoComplete="off"
              spellCheck={false}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setDuplicado(null);
              }}
            />
          </div>
          {buscando && <p className="text-muted-foreground text-xs">Buscando…</p>}
          <ul aria-label="Clientes encontrados" className="flex flex-col">
            {resultados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="hover:bg-card min-h-10 w-full rounded-md px-2 py-2 text-left text-sm"
                  onClick={() => elegir(c)}
                >
                  {c.nombre}
                  {c.documento && <span className="text-muted-foreground"> · {c.documento}</span>}
                </button>
              </li>
            ))}
          </ul>
          {q.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-muted-foreground text-xs">Sin resultados.</p>
          )}
        </>
      )}
      {(duplicado ?? error) && (
        <p role="alert" className="text-destructive text-xs">
          {duplicado ?? error}
        </p>
      )}
      <div className="flex gap-2">
        {!creando && (
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={() => {
              setCreando(true);
              setDuplicado(null);
            }}
          >
            <UserPlus /> Nuevo cliente
          </Button>
        )}
        {!obligatorio && !creando && (
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={() => elegir(null)}
          >
            Cliente general
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-10"
          onClick={() => {
            setAbierto(false);
            setCreando(false);
            setError(null);
            setDuplicado(null);
          }}
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
}
