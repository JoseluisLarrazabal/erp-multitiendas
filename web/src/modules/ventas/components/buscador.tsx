"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  bs,
  ETIQUETA_LISTA,
  formatearCantidad,
  LISTAS,
  motivoNoVendible,
  type ProductoPos,
} from "../domain";

export function CampoBusqueda({
  valor,
  alCambiar,
  alEnter,
  referencia,
  modoConsulta,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  alEnter: () => void;
  referencia: React.RefObject<HTMLInputElement | null>;
  modoConsulta: boolean;
}) {
  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        ref={referencia}
        type="search"
        role="searchbox"
        aria-label="Buscar producto"
        placeholder={
          modoConsulta ? "Consultar precio y stock…" : "Código, nombre o marca (Enter agrega)"
        }
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-12 pl-9 text-base"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            alEnter();
          }
        }}
      />
    </div>
  );
}

const cantidad = (n: number) => formatearCantidad(Math.round(n * 1000));

export function ListaResultados({
  productos,
  ubicaciones,
  ubicacionId,
  consulta,
  tipoNegocio,
  alAgregar,
}: {
  productos: readonly ProductoPos[];
  ubicaciones: readonly { id: string; nombre: string }[];
  ubicacionId: string;
  consulta: boolean;
  tipoNegocio: string;
  alAgregar: (p: ProductoPos) => void;
}) {
  return (
    <ul
      aria-label="Resultados"
      className="divide-border bg-card divide-y overflow-hidden rounded-xl border"
    >
      {productos.map((p) => {
        const stock = p.stockPorUbicacion[ubicacionId] ?? 0;
        const motivo = motivoNoVendible(p, tipoNegocio);
        return (
          <li key={p.id} className="flex items-start gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.nombre}</p>
              <p className="text-muted-foreground text-xs">
                {p.codigo}
                {p.codigoBarras ? ` · ${p.codigoBarras}` : ""}
              </p>
              {consulta ? (
                <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                  <dl className="flex flex-wrap gap-x-3">
                    {LISTAS.filter((l) => p.precios[l] !== null).map((l) => (
                      <div key={l} className="flex gap-1">
                        <dt className="text-muted-foreground">{ETIQUETA_LISTA[l]}</dt>
                        <dd className="font-medium tabular-nums">{bs(p.precios[l] ?? 0)}</dd>
                      </div>
                    ))}
                    {motivo && <dd className="text-destructive">{motivo}</dd>}
                  </dl>
                  <dl className="flex flex-wrap gap-x-3">
                    {ubicaciones.map((u) => (
                      <div key={u.id} className="flex gap-1">
                        <dt className="text-muted-foreground">{u.nombre}</dt>
                        <dd className="font-medium tabular-nums">
                          {cantidad(p.stockPorUbicacion[u.id] ?? 0)}
                        </dd>
                      </div>
                    ))}
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Total</dt>
                      <dd className="font-medium tabular-nums">{cantidad(p.stockTotal)}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  Stock aquí:{" "}
                  <span
                    className={
                      stock <= 0 ? "text-destructive font-medium" : "text-foreground font-medium"
                    }
                  >
                    {cantidad(stock)}
                  </span>
                  {p.controlaSerie && " · con serie"}
                </p>
              )}
            </div>
            {!consulta &&
              (motivo === null ? (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums">
                    {bs(p.precios.contado ?? 0)}
                  </span>
                  <Button
                    type="button"
                    className="h-10 px-3"
                    aria-label={`Agregar ${p.nombre}`}
                    onClick={() => alAgregar(p)}
                  >
                    <Plus /> Agregar
                  </Button>
                </div>
              ) : (
                <span className="text-destructive max-w-32 shrink-0 text-right text-xs font-medium">
                  {motivo}
                </span>
              ))}
          </li>
        );
      })}
    </ul>
  );
}
