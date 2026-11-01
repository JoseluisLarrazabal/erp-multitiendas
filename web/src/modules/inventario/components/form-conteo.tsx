"use client";

import { useState, type FormEvent } from "react";
import { Label } from "@/components/ui/label";
import { paginaConteoAccion, registrarConteo } from "../actions";
import { MAX_ITEMS_CONTEO, parsearCantidad, type Ubicacion } from "../domain";
import type { FilaConteo } from "../queries";
import { BusquedaConteo } from "./busqueda-conteo";
import { type Borrador } from "./lista-conteo";
import { PieConteo } from "./pie-conteo";
import { ResultadosConteo } from "./resultados-conteo";
import { ConteoRevision } from "./conteo-revision";
import { SelectUbicacion } from "./select-ubicacion";
import { useFocoConteo } from "./use-foco-conteo";
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
  const foco = useFocoConteo(datos, revisando);

  function escribir(producto: FilaConteo, texto: string) {
    setExito(null);
    setMalos((m) => new Set([...m].filter((id) => id !== producto.id)));
    setBorradores((b) => ({ ...b, [producto.id]: { producto, texto } }));
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    const nueva = busqueda.trim();
    foco.trasBuscar();
    // Misma búsqueda: la clave no cambia y no recargaría. Así reintenta tras un error o con productos recién cambiados.
    if (nueva === q && pagina === 1) datos.recargar();
    setQ(nueva);
    setPagina(1);
  }

  function revisar() {
    const invalidos = contados.filter(
      (b) => parsearCantidad(b.texto, b.producto.unidad, { admiteCero: true }) === null,
    );
    if (invalidos.length) {
      setMalos(new Set(invalidos.map((b) => b.producto.id)));
      // Solo las filas de la página visible tienen campo; las de otras páginas quedan marcadas al volver.
      const primero = invalidos.find((b) => document.getElementById(`cont-cant-${b.producto.id}`));
      if (primero) document.getElementById(`cont-cant-${primero.producto.id}`)?.focus();
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
        foco.alSalirDeRevision("cont-exito");
        setRevisando(false);
        setPagina(1);
        datos.recargar(); // "Sistema" debe mostrar lo recién contado
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
        alVolver={() => {
          foco.alSalirDeRevision("cont-revisar");
          setRevisando(false);
        }}
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
      <ResultadosConteo
        carga={datos}
        hayBusqueda={q !== ""}
        pagina={pagina}
        borradores={borradores}
        malos={malos}
        alEscribir={escribir}
        alCambiarPagina={setPagina}
      />
      <PieConteo
        contados={contados.length}
        pendiente={pendiente}
        aviso={aviso ?? error}
        exito={exito}
        alRevisar={revisar}
      />
    </div>
  );
}
