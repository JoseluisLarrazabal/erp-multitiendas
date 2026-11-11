"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
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
    return <EstadoVacio>El carrito está vacío. Escanea un código o busca un producto.</EstadoVacio>;
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
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1 min-[360px]:flex-nowrap">
              <div className="min-w-0 basis-full min-[360px]:flex-1 min-[360px]:basis-0">
                <p className="text-[15px] font-semibold break-words">{l.producto.nombre}</p>
                <p className="text-muted-foreground text-sm">
                  {l.producto.codigo} · lista {bs(precioLista)}
                  {l.producto.unidad === "kg" && " / kg"}
                </p>
              </div>
              <p className="cifra ml-auto text-base min-[360px]:ml-0">
                {total === null ? "—" : bs(total)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Quitar ${l.producto.nombre}`}
                disabled={bloqueado}
                onClick={() => despachar({ tipo: "quitar", id: l.id })}
              >
                <Trash2 className="size-5" />
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
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-muted-foreground font-medium">{etiquetaCantidad}</span>
                <Input
                  aria-label={`${etiquetaCantidad} de ${l.producto.nombre}`}
                  inputMode={l.producto.unidad === "kg" ? "decimal" : "numeric"}
                  className="cifra h-11 text-right"
                  value={l.cantidadTexto}
                  disabled={bloqueado || l.producto.controlaSerie}
                  aria-invalid={error?.startsWith("Cantidad") || undefined}
                  onChange={(e) => cambiar({ cantidadTexto: e.target.value })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-muted-foreground font-medium">Precio</span>
                <Input
                  aria-label={`Precio de ${l.producto.nombre}`}
                  inputMode="decimal"
                  className="cifra h-11 text-right"
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
                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="text-muted-foreground font-medium">Descuento</span>
                  <Input
                    aria-label={`Descuento de ${l.producto.nombre}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="cifra h-11 text-right"
                    value={l.descuentoTexto}
                    disabled={bloqueado}
                    onChange={(e) => cambiar({ descuentoTexto: e.target.value })}
                  />
                </label>
              )}
              {listas.length > 1 && !listaFija && (
                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="text-muted-foreground font-medium">Lista</span>
                  <SelectNativo
                    aria-label={`Lista de ${l.producto.nombre}`}
                    className="h-11"
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
              <p role="alert" className="text-destructive text-sm font-medium">
                {error}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
