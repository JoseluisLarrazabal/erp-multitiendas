"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { paginaConteoAccion, registrarConteo } from "../actions";
import { MAX_ITEMS_CONTEO, PAGINA_CONTEO, parsearCantidad, type Ubicacion } from "../domain";
import type { FilaConteo } from "../queries";
import { BusquedaConteo } from "./busqueda-conteo";
import { PaginacionConteo } from "./paginacion-conteo";
import { ListaConteo, type Borrador } from "./lista-conteo";
import { ConteoRevision } from "./conteo-revision";
import { SelectUbicacion } from "./select-ubicacion";
import { useCarga } from "./use-carga";
import { useOperacion } from "./use-operacion";

export type ItemContado = { producto: FilaConteo; contada: number };

export function FormConteo({
  negocioId,
  ubicaciones,
}: {
  negocioId: string;
  ubicaciones: readonly Ubicacion[];
}) {
  const { pendiente, error, enviar } = useOperacion();
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  // Lo tecleado vive aquí y no en la página: sobrevive al buscar y al paginar.
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [malos, setMalos] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const datos = useCarga(`${negocioId}|${ubicacionId}|${q}|${pagina}`, () =>
    paginaConteoAccion({ negocioId, ubicacionId, q, pagina }),
  );
  const contados = Object.values(borradores).filter((b) => b.texto.trim() !== "");
  const filas = datos.datos?.filas ?? [];
  const paginas = Math.max(1, Math.ceil((datos.datos?.total ?? 0) / PAGINA_CONTEO));

  function escribir(producto: FilaConteo, texto: string) {
    setExito(null);
    setMalos((m) => new Set([...m].filter((id) => id !== producto.id)));
    setBorradores((b) => ({ ...b, [producto.id]: { producto, texto } }));
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    setQ(busqueda.trim());
    setPagina(1);
  }

  function revisar() {
    const invalidos = contados.filter(
      (b) => parsearCantidad(b.texto, b.producto.unidad, { admiteCero: true }) === null,
    );
    if (invalidos.length) {
      setMalos(new Set(invalidos.map((b) => b.producto.id)));
      return setAviso(
        "Hay cantidades inválidas. Usa números enteros, o con coma si el producto es en kg.",
      );
    }
    if (contados.length === 0)
      return setAviso("Ingresa la cantidad contada de al menos un producto.");
    if (contados.length > MAX_ITEMS_CONTEO)
      return setAviso(
        `Un conteo admite hasta ${MAX_ITEMS_CONTEO} productos. Confirma este y haz otro.`,
      );
    setAviso(null);
    setRevisando(true);
  }

  const items: ItemContado[] = contados.map((b) => ({
    producto: b.producto,
    contada: parsearCantidad(b.texto, b.producto.unidad, { admiteCero: true })!,
  }));

  function confirmar(motivo: string, series: Record<string, string[]>) {
    let ajustes = 0;
    enviar(
      async (id) => {
        const r = await registrarConteo({
          operacionId: id,
          negocioId,
          ubicacionId,
          motivo,
          items: contados.map((b) => ({
            productoId: b.producto.id,
            cantidad: b.texto,
            serieIds: series[b.producto.id] ?? null,
          })),
        });
        if (!r.ok) return r;
        ajustes = r.data.ajustes;
        return { ok: true, data: null };
      },
      () => {
        setBorradores({});
        setRevisando(false);
        setPagina(1);
        setExito(`Conteo registrado: ${ajustes} ajuste(s) generado(s).`);
      },
    );
  }

  if (revisando) {
    return (
      <ConteoRevision
        negocioId={negocioId}
        ubicacionId={ubicacionId}
        items={items}
        pendiente={pendiente}
        error={error}
        alVolver={() => setRevisando(false)}
        alConfirmar={confirmar}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex min-w-48 flex-col gap-1.5">
          <Label htmlFor="cont-ubicacion">Ubicación a contar</Label>
          <SelectUbicacion
            ubicaciones={ubicaciones}
            id="cont-ubicacion"
            value={ubicacionId}
            disabled={contados.length > 0}
            onChange={(e) => {
              setUbicacionId(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        <BusquedaConteo valor={busqueda} alCambiar={setBusqueda} alBuscar={buscar} />
      </div>
      {contados.length > 0 && (
        <p className="text-muted-foreground text-xs">
          La ubicación queda fija mientras haya cantidades ingresadas.{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-4"
            onClick={() => {
              setBorradores({});
              setMalos(new Set());
            }}
          >
            Descartar conteo
          </button>
        </p>
      )}
      {datos.error && (
        <p role="alert" className="text-destructive text-sm">
          {datos.error}
        </p>
      )}
      {datos.cargando && (
        <p role="status" className="text-muted-foreground text-sm">
          Cargando productos…
        </p>
      )}
      {datos.datos && filas.length === 0 && (
        <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
          {q ? "Ningún producto coincide con la búsqueda." : "Aún no hay productos para contar."}
        </p>
      )}
      {filas.length > 0 && (
        <ListaConteo filas={filas} borradores={borradores} malos={malos} alEscribir={escribir} />
      )}
      {datos.datos && datos.datos.total > PAGINA_CONTEO && (
        <PaginacionConteo pagina={pagina} paginas={paginas} alCambiar={setPagina} />
      )}
      <div className="flex flex-col gap-2">
        <div>
          <Button className="h-10" onClick={revisar} disabled={pendiente}>
            Revisar diferencias ({contados.length})
          </Button>
        </div>
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {aviso ?? error}
        </p>
        <p role="status" className="text-sm font-medium">
          {exito}
        </p>
      </div>
    </div>
  );
}
