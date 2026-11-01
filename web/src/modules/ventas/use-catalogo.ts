"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { crearIndice, descontarStock, type ProductoPos } from "./domain";
import { cargarCatalogo, cargarMarcas } from "./queries";
import type { Catalogo, VentaPayload } from "./schemas";

export type EstadoCatalogo =
  { t: "cargando" } | { t: "error"; mensaje: string } | { t: "listo"; catalogo: Catalogo };

const REFRESCO_MS = 5 * 60 * 1000;

// El catálogo entero vive en memoria (RNF-01). `recargar` devuelve el mapa nuevo para refrescar el carrito.
export function useCatalogo(negocioId: string, ubicacionId: string) {
  const [estado, setEstado] = useState<EstadoCatalogo>({ t: "cargando" });
  const [marcas, setMarcas] = useState<ReadonlyMap<string, string>>(new Map());
  const ultimaCarga = useRef(0);
  // Las marcas son opcionales: si su carga falló (mapa vacío), la siguiente recarga del catálogo las pide otra vez.
  const marcasCargadas = useRef(false);
  const guardarMarcas = useCallback((m: Map<string, string>) => {
    marcasCargadas.current = m.size > 0;
    setMarcas(m);
  }, []);

  const recargar = useCallback(async (): Promise<Map<string, ProductoPos> | null> => {
    const r = await cargarCatalogo(createClient(), ubicacionId);
    if (!r.ok) {
      setEstado((e) => (e.t === "listo" ? e : { t: "error", mensaje: r.error }));
      return null;
    }
    ultimaCarga.current = Date.now();
    setEstado({ t: "listo", catalogo: r.data });
    if (!marcasCargadas.current) void cargarMarcas(createClient(), negocioId).then(guardarMarcas);
    return new Map(r.data.productos.map((p) => [p.id, p]));
  }, [ubicacionId, negocioId, guardarMarcas]);

  // Tras una venta propia no se baja el catálogo entero (930 KB con 2.000 productos): se descuenta el stock local.
  // shortcut: las ventas de otros equipos y las entradas de stock llegan con la recarga en segundo plano, que solo
  // corre en la venta siguiente a 5 min de la última carga; si el stock ajeno debe verse antes, sondear por `version`.
  const registrarVenta = useCallback(
    (items: VentaPayload["items"]) => {
      setEstado((e) =>
        e.t === "listo"
          ? {
              t: "listo",
              catalogo: {
                ...e.catalogo,
                productos: descontarStock(e.catalogo.productos, ubicacionId, items),
              },
            }
          : e,
      );
      if (Date.now() - ultimaCarga.current > REFRESCO_MS) void recargar();
    },
    [ubicacionId, recargar],
  );

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const r = await cargarCatalogo(supabase, ubicacionId);
      if (cancelado) return;
      if (!r.ok) return setEstado({ t: "error", mensaje: r.error });
      ultimaCarga.current = Date.now();
      setEstado({ t: "listo", catalogo: r.data });
      const m = await cargarMarcas(supabase, negocioId);
      if (!cancelado) guardarMarcas(m);
    })();
    return () => {
      cancelado = true;
    };
  }, [ubicacionId, negocioId, guardarMarcas]);

  const catalogo = estado.t === "listo" ? estado.catalogo : null;
  const indice = useMemo(
    () => (catalogo ? crearIndice(catalogo.productos, marcas) : null),
    [catalogo, marcas],
  );
  return { estado, catalogo, indice, recargar, registrarVenta };
}
