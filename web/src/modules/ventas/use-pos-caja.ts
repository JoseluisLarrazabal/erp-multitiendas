"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  aperturaEnCola,
  cajaAbierta,
  guardarCajaLocal,
  leerCajaLocal,
  type SesionCaja,
} from "@/modules/caja";
import { avisarRed, leerSinRed, useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import {
  guardarEquiposLocal,
  guardarNegocioLocal,
  leerEquiposLocal,
  leerNegocioLocal,
} from "./contexto-ventas";
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

const SIN_DATOS =
  "Sin conexión y sin datos guardados de este negocio. Conéctate una vez para cargarlos.";

// Negocio -> equipo (guardado por negocio en localStorage) -> sesión de caja abierta del equipo. Cada carga buena se
// guarda en IndexedDB; sin red (o si la red falla) se usa lo guardado. Al volver la red se refresca sin remontar la venta.
export function usePosCaja(negocioId: string, permisos: readonly string[], usuarioId: string) {
  const [fase, setFase] = useState<FasePosCaja>({ t: "cargando" });
  const [negocio, setNegocio] = useState<DatosNegocio | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [intento, setIntento] = useState(0);
  const reintentar = useCallback(() => {
    setFase({ t: "cargando" });
    setIntento((n) => n + 1);
  }, []);

  // Si el equipo tiene una apertura sin enviar manda la local; si no, el servidor; sin red, la sesión guardada.
  const resolverEquipo = useCallback(
    async (equipo: Equipo): Promise<FasePosCaja> => {
      const lista = (s: SesionCaja): FasePosCaja => ({ t: "lista", equipo, cajaId: s.id });
      const guardada = async (): Promise<FasePosCaja> => {
        const c = await leerCajaLocal(usuarioId, equipo.id);
        return c ? lista(c) : { t: "abrir", equipo };
      };
      const local = await aperturaEnCola(equipo.id).catch(() => null);
      if (local) {
        guardarCajaLocal(usuarioId, equipo.id, local);
        return lista(local);
      }
      if (!navigator.onLine) return guardada();
      const r = await cajaAbierta(createClient(), equipo.id);
      if (!r.ok) {
        if (!r.red) return { t: "error", mensaje: r.error };
        avisarRed(false);
        return guardada();
      }
      avisarRed(true);
      guardarCajaLocal(usuarioId, equipo.id, r.data);
      return r.data ? lista(r.data) : { t: "abrir", equipo };
    },
    [usuarioId],
  );

  // Negocio y equipos: del servidor (y se guardan) o, sin red, de lo guardado. `error` solo si no hay de dónde sacarlos.
  const leerDatos = useCallback(async (): Promise<
    { negocio: DatosNegocio; equipos: Equipo[] } | { error: string }
  > => {
    const guardados = async () => {
      const [n, e] = await Promise.all([
        leerNegocioLocal(usuarioId, negocioId),
        leerEquiposLocal(usuarioId, negocioId),
      ]);
      return n && e ? { negocio: n, equipos: e } : { error: SIN_DATOS };
    };
    if (!navigator.onLine) return guardados();
    const supabase = createClient();
    const [n, e] = await Promise.all([
      cargarNegocio(supabase, negocioId),
      listarEquipos(supabase, negocioId),
    ]);
    if (n.ok && e.ok) {
      avisarRed(true);
      guardarNegocioLocal(usuarioId, negocioId, n.data);
      // `ultimoNumero` del servidor entra al contador sin red: se guarda en cada carga.
      guardarEquiposLocal(usuarioId, negocioId, e.data);
      return { negocio: n.data, equipos: e.data };
    }
    if ((!n.ok && n.red) || (!e.ok && e.red)) {
      avisarRed(false);
      return guardados();
    }
    return { error: !n.ok ? n.error : !e.ok ? e.error : "" };
  }, [usuarioId, negocioId]);

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
      const d = await leerDatos();
      if (cancelado) return;
      if ("error" in d) return publicar({ t: "error", mensaje: d.error });
      setNegocio(d.negocio);
      setEquipos(d.equipos);
      if (d.equipos.length === 0) return publicar({ t: "sin-equipos" });
      const guardado =
        d.equipos.find((x) => x.id === leerEquipoGuardado(negocioId)) ??
        (d.equipos.length === 1 ? d.equipos[0] : undefined);
      publicar(guardado ? await resolverEquipo(guardado) : { t: "elegir", equipos: d.equipos });
    }
    cargar().catch(() => publicar({ t: "error", mensaje: "No se pudo cargar el punto de venta." }));
    return () => {
      cancelado = true;
    };
  }, [negocioId, puedeVender, puedeCaja, intento, resolverEquipo, leerDatos]);

  // Al volver la red: refresca negocio, equipos y caja sin pasar por "cargando", así la venta en curso (carrito) no se
  // remonta. Si algo falla se conserva lo que hay.
  const sinRed = useSinRed();
  const estabaSinRed = useRef(sinRed);
  const faseActual = useRef(fase);
  useEffect(() => {
    faseActual.current = fase;
  }, [fase]);
  useEffect(() => {
    const volvio = estabaSinRed.current && !sinRed;
    estabaSinRed.current = sinRed;
    if (!volvio) return;
    let cancelado = false;
    (async () => {
      const d = await leerDatos();
      if (cancelado || "error" in d || leerSinRed()) return;
      setNegocio(d.negocio);
      setEquipos(d.equipos);
      const f = faseActual.current;
      if (f.t !== "lista" && f.t !== "abrir") return;
      const equipo = d.equipos.find((x) => x.id === f.equipo.id);
      if (!equipo) return;
      const r = await resolverEquipo(equipo);
      if (cancelado || (r.t !== "lista" && r.t !== "abrir")) return;
      setFase((a) =>
        (a.t !== "lista" && a.t !== "abrir") || a.equipo.id !== equipo.id
          ? a
          : r.t === "lista"
            ? r
            : a.t === "lista"
              ? { ...a, equipo, cajaId: null }
              : r,
      );
    })().catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [sinRed, leerDatos, resolverEquipo]);

  async function elegir(id: string) {
    const equipo = equipos.find((x) => x.id === id);
    if (!equipo) return;
    guardarEquipo(negocioId, id);
    setFase({ t: "cargando" });
    setFase(await resolverEquipo(equipo));
  }

  // Cambiar de equipo suelta el guardado y necesita la lista del servidor para el siguiente: sin red no se hace.
  function cambiarEquipo() {
    if (leerSinRed()) return;
    guardarEquipo(negocioId, null);
    setFase({ t: "elegir", equipos });
  }

  const alAbrirCaja = (sesion: SesionCaja) => {
    if (fase.t === "abrir" || fase.t === "lista")
      guardarCajaLocal(usuarioId, fase.equipo.id, sesion);
    setFase((f) =>
      f.t === "abrir"
        ? { t: "lista", equipo: f.equipo, cajaId: sesion.id }
        : f.t === "lista" && f.cajaId === null
          ? { ...f, cajaId: sesion.id }
          : f,
    );
  };

  // ERP_CAJA_CERRADA es cierto: la caja no está abierta. Se busca la sesión vigente (otra pestaña pudo abrirla); sin
  // ella, `cajaId` queda null y la pantalla pide abrirla sin desmontar la venta. Si la lectura falla no se sabe
  // nada: se conserva el `cajaId` previo y se devuelve el error para que la venta avise y se pueda reintentar.
  const verificarCaja = useCallback(
    async (equipoId: string): Promise<string | null> => {
      // Una apertura aún en la cola es la caja del equipo aunque el servidor todavía no la conozca.
      const local = await aperturaEnCola(equipoId).catch(() => null);
      if (local) {
        guardarCajaLocal(usuarioId, equipoId, local);
        setFase((f) =>
          f.t === "lista" && f.equipo.id === equipoId ? { ...f, cajaId: local.id } : f,
        );
        return null;
      }
      const r = await cajaAbierta(createClient(), equipoId);
      if (!r.ok) return r.error;
      guardarCajaLocal(usuarioId, equipoId, r.data);
      const cajaId = r.data?.id ?? null;
      setFase((f) => (f.t === "lista" && f.equipo.id === equipoId ? { ...f, cajaId } : f));
      return null;
    },
    [usuarioId],
  );

  // El servidor confirmó el cierre: no hay que volver a preguntarle, y el contexto deja de recordar la caja.
  const cajaCerrada = useCallback(
    (equipoId: string) => {
      guardarCajaLocal(usuarioId, equipoId, null);
      setFase((f) => (f.t === "lista" && f.equipo.id === equipoId ? { ...f, cajaId: null } : f));
    },
    [usuarioId],
  );

  // Tras un rechazo por topes o permisos: el tope de descuento puede haber cambiado.
  const recargarNegocio = useCallback(async () => {
    const r = await cargarNegocio(createClient(), negocioId);
    if (!r.ok) return;
    guardarNegocioLocal(usuarioId, negocioId, r.data);
    setNegocio(r.data);
  }, [negocioId, usuarioId]);

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
