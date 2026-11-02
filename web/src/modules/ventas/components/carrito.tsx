"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import {
  listasDisponibles,
  type AccionCarrito,
  type LineaResuelta,
  type Permisos,
} from "../carrito";
import { brutoLinea, bs, ETIQUETA_LISTA, textoMonto, type Lista } from "../domain";
import { SelectorSerie } from "./selector-serie";

type Cambios = Extract<AccionCarrito, { tipo: "cambiar" }>["cambios"];

export function CarritoLineas({
  lineas,
  permisos,
  ubicacionId,
  despachar,
  bloqueado,
  listaFija = false,
}: {
  // Lavandería: la lista la fija el interruptor Express de la orden, no cada línea.
  listaFija?: boolean;
  lineas: readonly LineaResuelta[];
  permisos: Permisos;
  ubicacionId: string;
  despachar: (a: AccionCarrito) => void;
  bloqueado: boolean;
}) {
  const puedeBajar = permisos.puedeDescontar && permisos.tope > 0;
  const usadas = new Set(lineas.map((l) => l.linea.serieId).filter((s): s is string => s !== null));
  if (lineas.length === 0)
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        El carrito está vacío. Escanea un código o busca un producto.
      </p>
    );
  return (
    <ul aria-label="Carrito" className="divide-border divide-y">
      {lineas.map(({ linea: l, entrada, precioLista, error }) => {
        const cambiar = (cambios: Cambios) => despachar({ tipo: "cambiar", id: l.id, cambios });
        const listas = listasDisponibles(l.producto);
        // El nombre accesible empieza por el texto visible de la etiqueta.
        const etiquetaCantidad = l.producto.unidad === "kg" ? "Kg" : "Cantidad";
        const total = entrada
          ? brutoLinea(entrada.cantidadMilesimas, entrada.precio) - entrada.descuento
          : null;
        return (
          <li key={l.id} className="flex flex-col gap-2 py-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.producto.nombre}</p>
                <p className="text-muted-foreground text-xs">
                  {l.producto.codigo} · lista {bs(precioLista)}
                  {l.producto.unidad === "kg" && " / kg"}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {total === null ? "—" : bs(total)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label={`Quitar ${l.producto.nombre}`}
                disabled={bloqueado}
                onClick={() => despachar({ tipo: "quitar", id: l.id })}
              >
                <Trash2 />
              </Button>
            </div>
            <div
              // Bajo `sm` (390 px) cuatro columnas recortan el select de lista: van de a dos.
              className="grid grid-cols-2 gap-2 sm:[grid-template-columns:var(--columnas)]"
              style={
                {
                  "--columnas": `5rem repeat(${1 + (puedeBajar ? 1 : 0) + (listas.length > 1 && !listaFija ? 1 : 0)}, minmax(0, 1fr))`,
                } as React.CSSProperties
              }
            >
              <label className="flex flex-col gap-0.5 text-xs">
                <span className="text-muted-foreground">{etiquetaCantidad}</span>
                <Input
                  aria-label={`${etiquetaCantidad} de ${l.producto.nombre}`}
                  inputMode={l.producto.unidad === "kg" ? "decimal" : "numeric"}
                  className="h-10 text-right tabular-nums"
                  value={l.cantidadTexto}
                  disabled={bloqueado || l.producto.controlaSerie}
                  aria-invalid={error?.startsWith("Cantidad") || undefined}
                  onChange={(e) => cambiar({ cantidadTexto: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs">
                <span className="text-muted-foreground">Precio</span>
                <Input
                  aria-label={`Precio de ${l.producto.nombre}`}
                  inputMode="decimal"
                  className="h-10 text-right tabular-nums"
                  value={l.precioTexto}
                  disabled={bloqueado}
                  aria-invalid={
                    error?.startsWith("Precio") || error?.startsWith("Bajo") || undefined
                  }
                  onChange={(e) => cambiar({ precioTexto: e.target.value })}
                  onBlur={() => entrada && cambiar({ precioTexto: textoMonto(entrada.precio) })}
                />
              </label>
              {puedeBajar && (
                <label className="flex flex-col gap-0.5 text-xs">
                  <span className="text-muted-foreground">Descuento</span>
                  <Input
                    aria-label={`Descuento de ${l.producto.nombre}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="h-10 text-right tabular-nums"
                    value={l.descuentoTexto}
                    disabled={bloqueado}
                    onChange={(e) => cambiar({ descuentoTexto: e.target.value })}
                  />
                </label>
              )}
              {listas.length > 1 && !listaFija && (
                <label className="flex flex-col gap-0.5 text-xs">
                  <span className="text-muted-foreground">Lista</span>
                  <SelectNativo
                    aria-label={`Lista de ${l.producto.nombre}`}
                    className="h-10"
                    value={l.lista}
                    disabled={bloqueado}
                    onChange={(e) =>
                      despachar({ tipo: "lista", id: l.id, lista: e.target.value as Lista })
                    }
                  >
                    {listas.map((x) => (
                      <option key={x} value={x}>
                        {ETIQUETA_LISTA[x]}
                      </option>
                    ))}
                  </SelectNativo>
                </label>
              )}
            </div>
            {l.producto.controlaSerie && (
              <SelectorSerie
                productoId={l.producto.id}
                ubicacionId={ubicacionId}
                valor={l.serieId}
                usadas={usadas}
                alElegir={(id, texto) => cambiar({ serieId: id, serieTexto: texto })}
              />
            )}
            {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
