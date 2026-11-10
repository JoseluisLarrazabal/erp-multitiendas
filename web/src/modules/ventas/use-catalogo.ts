"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { avisarRed, leerSinRed, useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import { guardarCatalogoLocal, leerCatalogoLocal } from "./contexto-ventas";
import { crearIndice, descontarStock, type ProductoPos } from "./domain";
import { cargarCatalogo, cargarMarcas } from "./queries";
import type { Catalogo, VentaPayload } from "./schemas";

export type EstadoCatalogo =
  { t: "cargando" } | { t: "error"; mensaje: string } | { t: "listo"; catalogo: Catalogo };

const REFRESCO_MS = 5 * 60 * 1000;
const SIN_CATALOGO =
  "Sin conexión y sin catálogo guardado en este equipo. Conéctate una vez para bajarlo.";

// El catálogo entero vive en memoria (RNF-01). `recargar` devuelve el mapa nuevo para refrescar el carrito. Cada carga
// buena se guarda en IndexedDB (diferido) para abrir sin red; `desde` es cuándo se bajó el que se está usando.
export function useCatalogo(negocioId: string, ubicacionId: string, usuarioId: string) {
  const [estado, setEstado] = useState<EstadoCatalogo>({ t: "cargando" });
  const [marcas, setMarcas] = useState<ReadonlyMap<string, string>>(new Map());
  const [desde, setDesde] = useState<number | null>(null);
  const ultimaCarga = useRef(0);
  // Las marcas son opcionales: si su carga quedó incompleta, la siguiente recarga del catálogo las pide otra vez.
  const marcasCargadas = useRef(false);
  const actual = useRef<{
    catalogo: Catalogo | null;
    marcas: ReadonlyMap<string, string>;
    desde: number;
  }>({
    catalogo: null,
    marcas: new Map(),
    desde: 0,
  });
  const persistir = useCallback(() => {
    guardarCatalogoLocal(usuarioId, negocioId, ubicacionId, () => {
      const a = actual.current;
      return a.catalogo ? { catalogo: a.catalogo, marcas: a.marcas, guardadoEn: a.desde } : null;
    });
  }, [usuarioId, negocioId, ubicacionId]);
  const guardarMarcas = useCallback(
    (r: Awaited<ReturnType<typeof cargarMarcas>>) => {
      marcasCargadas.current = r.completas;
      actual.current.marcas = r.marcas;
      setMarcas(r.marcas);
      persistir();
    },
    [persistir],
  );
  const publicar = useCallback((catalogo: Catalogo, cuando: number) => {
    actual.current.catalogo = catalogo;
    actual.current.desde = cuando;
    setDesde(cuando);
    setEstado({ t: "listo", catalogo });
  }, []);

  // Lo último que se bajó con red. false: no hay copia (o no se pudo leer).
  const usarGuardado = useCallback(async (): Promise<boolean> => {
    const g = await leerCatalogoLocal(usuarioId, negocioId, ubicacionId);
    if (!g) return false;
    ultimaCarga.current = g.guardadoEn;
    marcasCargadas.current = false;
    actual.current.marcas = new Map(g.marcas);
    setMarcas(actual.current.marcas);
    publicar(g.catalogo, g.guardadoEn);
    return true;
  }, [usuarioId, negocioId, ubicacionId, publicar]);

  const recargar = useCallback(async (): Promise<Map<string, ProductoPos> | null> => {
    const r = await cargarCatalogo(createClient(), ubicacionId);
    if (!r.ok) {
      if (r.red) avisarRed(false);
      setEstado((e) => (e.t === "listo" ? e : { t: "error", mensaje: r.error }));
      return null;
    }
    avisarRed(true);
    ultimaCarga.current = Date.now();
    publicar(r.data, ultimaCarga.current);
    persistir();
    if (!marcasCargadas.current) void cargarMarcas(createClient(), negocioId).then(guardarMarcas);
    return new Map(r.data.productos.map((p) => [p.id, p]));
  }, [ubicacionId, negocioId, guardarMarcas, publicar, persistir]);

  // Tras una venta propia no se baja el catálogo entero (930 KB con 2.000 productos): se descuenta el stock local y se
  // guarda en IndexedDB para que el snapshot lo refleje.
  // shortcut: las ventas de otros equipos y las entradas de stock llegan con la recarga en segundo plano, que solo
  // corre en la venta siguiente a 5 min de la última carga; si el stock ajeno debe verse antes, sondear por `version`.
  const registrarVenta = useCallback(
    (items: VentaPayload["items"]) => {
      const a = actual.current;
      if (a.catalogo)
        a.catalogo = {
          ...a.catalogo,
          productos: descontarStock(a.catalogo.productos, ubicacionId, items),
        };
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
      persistir();
      if (!leerSinRed() && Date.now() - ultimaCarga.current > REFRESCO_MS) void recargar();
    },
    [ubicacionId, recargar, persistir],
  );

  // Al volver la red se baja el catálogo nuevo sin tocar el carrito.
  const sinRed = useSinRed();
  const estabaSinRed = useRef(sinRed);
  useEffect(() => {
    const volvio = estabaSinRed.current && !sinRed;
    estabaSinRed.current = sinRed;
    if (volvio) void recargar();
  }, [sinRed, recargar]);

  // El equipo que queda abierto todo el día: al volver a la pestaña se baja el catálogo si ya pasó el intervalo.
  useEffect(() => {
    function alVolver() {
      if (
        document.visibilityState === "visible" &&
        !leerSinRed() &&
        Date.now() - ultimaCarga.current > REFRESCO_MS
      )
        void recargar();
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [recargar]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const sinCopia = () => !cancelado && setEstado({ t: "error", mensaje: SIN_CATALOGO });
      if (!navigator.onLine) return (await usarGuardado()) || sinCopia();
      const supabase = createClient();
      const r = await cargarCatalogo(supabase, ubicacionId);
      if (cancelado) return;
      if (!r.ok) {
        if (!r.red) return setEstado({ t: "error", mensaje: r.error });
        avisarRed(false);
        return (await usarGuardado()) || sinCopia();
      }
      avisarRed(true);
      ultimaCarga.current = Date.now();
      publicar(r.data, ultimaCarga.current);
      persistir();
      const m = await cargarMarcas(supabase, negocioId);
      if (!cancelado) guardarMarcas(m);
    })();
    return () => {
      cancelado = true;
    };
  }, [ubicacionId, negocioId, guardarMarcas, usarGuardado, publicar, persistir]);

  const catalogo = estado.t === "listo" ? estado.catalogo : null;
  const indice = useMemo(
    () => (catalogo ? crearIndice(catalogo.productos, marcas) : null),
    [catalogo, marcas],
  );
  return { estado, catalogo, indice, recargar, registrarVenta, desde };
}
