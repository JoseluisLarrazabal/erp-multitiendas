"use client";

import { useCallback, useEffect, useState } from "react";
import { cajaAbierta, type SesionCaja } from "@/modules/caja";
import { createClient } from "@/lib/supabase/browser";
import { guardarEquipo, leerEquipoGuardado } from "./equipo-local";
import { cargarNegocio, listarEquipos, type DatosNegocio, type Equipo } from "./queries";

export type FasePosCaja =
  | { t: "cargando" }
  | { t: "error"; mensaje: string }
  | { t: "sin-permiso"; mensaje: string }
  | { t: "sin-equipos" }
  | { t: "elegir"; equipos: Equipo[] }
  | { t: "abrir"; equipo: Equipo }
  // cajaId null: el servidor dijo que la caja se cerró con la venta en curso; se vuelve a abrir sin perder el carrito.
  | { t: "lista"; equipo: Equipo; cajaId: string | null };

// Negocio -> equipo (guardado por negocio en localStorage) -> sesión de caja abierta del equipo.
export function usePosCaja(negocioId: string, permisos: readonly string[]) {
  const [fase, setFase] = useState<FasePosCaja>({ t: "cargando" });
  const [negocio, setNegocio] = useState<DatosNegocio | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [intento, setIntento] = useState(0);
  const reintentar = useCallback(() => {
    setFase({ t: "cargando" });
    setIntento((n) => n + 1);
  }, []);

  const resolverEquipo = useCallback(async (equipo: Equipo): Promise<FasePosCaja> => {
    const r = await cajaAbierta(createClient(), equipo.id);
    if (!r.ok) return { t: "error", mensaje: r.error };
    return r.data ? { t: "lista", equipo, cajaId: r.data.id } : { t: "abrir", equipo };
  }, []);

  const puedeVender = permisos.includes("vender");
  const puedeCaja = permisos.includes("caja");
  useEffect(() => {
    let cancelado = false;
    const publicar = (f: FasePosCaja) => !cancelado && setFase(f);
    async function cargar() {
      if (!puedeVender)
        return publicar({ t: "sin-permiso", mensaje: "Tu rol no puede vender en este negocio." });
      if (!puedeCaja)
        return publicar({
          t: "sin-permiso",
          mensaje:
            "Tu rol no tiene permiso de caja: sin caja abierta no se puede vender. Pídelo a un encargado.",
        });
      const supabase = createClient();
      const [n, e] = await Promise.all([
        cargarNegocio(supabase, negocioId),
        listarEquipos(supabase, negocioId),
      ]);
      if (cancelado) return;
      if (!n.ok) return publicar({ t: "error", mensaje: n.error });
      if (!e.ok) return publicar({ t: "error", mensaje: e.error });
      setNegocio(n.data);
      setEquipos(e.data);
      if (e.data.length === 0) return publicar({ t: "sin-equipos" });
      const guardado =
        e.data.find((x) => x.id === leerEquipoGuardado(negocioId)) ??
        (e.data.length === 1 ? e.data[0] : undefined);
      publicar(guardado ? await resolverEquipo(guardado) : { t: "elegir", equipos: e.data });
    }
    cargar().catch(() => publicar({ t: "error", mensaje: "No se pudo cargar el punto de venta." }));
    return () => {
      cancelado = true;
    };
  }, [negocioId, puedeVender, puedeCaja, intento, resolverEquipo]);

  async function elegir(id: string) {
    const equipo = equipos.find((x) => x.id === id);
    if (!equipo) return;
    guardarEquipo(negocioId, id);
    setFase({ t: "cargando" });
    setFase(await resolverEquipo(equipo));
  }

  function cambiarEquipo() {
    guardarEquipo(negocioId, null);
    setFase({ t: "elegir", equipos });
  }

  const alAbrirCaja = (sesion: SesionCaja) =>
    setFase((f) =>
      f.t === "abrir"
        ? { t: "lista", equipo: f.equipo, cajaId: sesion.id }
        : f.t === "lista" && f.cajaId === null
          ? { ...f, cajaId: sesion.id }
          : f,
    );

  // ERP_CAJA_CERRADA es cierto: la caja no está abierta. Se busca la sesión vigente (otra pestaña pudo abrirla); sin
  // ella, `cajaId` queda null y la pantalla pide abrirla sin desmontar la venta. Si la lectura falla no se sabe
  // nada: se conserva el `cajaId` previo y se devuelve el error para que la venta avise y se pueda reintentar.
  const verificarCaja = useCallback(async (equipoId: string): Promise<string | null> => {
    const r = await cajaAbierta(createClient(), equipoId);
    if (!r.ok) return r.error;
    const cajaId = r.data?.id ?? null;
    setFase((f) => (f.t === "lista" && f.equipo.id === equipoId ? { ...f, cajaId } : f));
    return null;
  }, []);

  // El servidor confirmó el cierre: no hay que volver a preguntarle.
  const cajaCerrada = useCallback((equipoId: string) => {
    setFase((f) => (f.t === "lista" && f.equipo.id === equipoId ? { ...f, cajaId: null } : f));
  }, []);

  // Tras un rechazo por topes o permisos: el tope de descuento puede haber cambiado.
  const recargarNegocio = useCallback(async () => {
    const r = await cargarNegocio(createClient(), negocioId);
    if (r.ok) setNegocio(r.data);
  }, [negocioId]);

  return {
    fase,
    negocio,
    reintentar,
    elegir,
    cambiarEquipo,
    alAbrirCaja,
    verificarCaja,
    cajaCerrada,
    recargarNegocio,
  };
}
