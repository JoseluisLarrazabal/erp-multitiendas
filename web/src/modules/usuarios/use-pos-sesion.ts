"use client";

import { navegarA } from "@/lib/navegar";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { esErrorTransitorio, esSinSesion } from "@/lib/supabase/errores";
import { conservarLista, negocioDeRecheck, type NegocioUsuario } from "./domain";
import { leerNegocioGuardado } from "./negocio-cliente";
import { listarMisNegocios, permisosDeRol } from "./queries";

export type SesionPos =
  | { fase: "verificando" }
  | { fase: "sin-conexion" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "lista";
      usuarioId: string;
      negocios: NegocioUsuario[];
      activoId: string;
      permisos: string[];
      // Un re-chequeo de fondo encontró la sesión perdida (o de otra cuenta) con la venta en pantalla: no se navega
      // (se perdería el carrito o una venta pendiente); la barra avisa y pide volver a entrar con la misma cuenta.
      caducada?: boolean;
    };

const ERROR_AUTH = "No pudimos verificar tu sesión.";

// /pos es estático: no hay servidor que decida, así que la guarda vive en el cliente.
// Solo va a /login si no hay sesión o es inválida; cualquier otro fallo de Auth es `error` y no navega
// (si no, /login ↔ /pos harían bucle). Con la sesión ya `lista`, un re-chequeo de fondo nunca la reemplaza por
// un error ni navega: conserva la pantalla y, si la sesión se perdió de verdad, marca `caducada`. Sin red abre con lo que haya: la venta se guarda en la cola y la
// RLS decide al sincronizar.
// shortcut: sin red no se muestra el negocio ni los permisos, porque no se cachean; cuando la cola offline
// guarde el snapshot en IndexedDB (fase 3), leerlos de ahí.
export function usePosSesion(): {
  sesion: SesionPos;
  cambiarActivo: (id: string) => Promise<string | null>;
  reintentar: () => void;
  refrescarPermisos: () => Promise<void>;
} {
  const [sesion, setSesion] = useState<SesionPos>({ fase: "verificando" });
  const [intento, setIntento] = useState(0);
  // Cuenta y negocio de la sesión ya lista (null si aún no lo está): el re-chequeo de fondo los conserva.
  const vista = useRef<{ usuarioId: string; activoId: string } | null>(null);
  useEffect(() => {
    vista.current =
      sesion.fase === "lista" ? { usuarioId: sesion.usuarioId, activoId: sesion.activoId } : null;
  }, [sesion]);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  // Al volver la red o la pestaña se vuelve a verificar, sin recargar (tras iniciar sesión en otra pestaña).
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible") reintentar();
    };
    window.addEventListener("online", reintentar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("online", reintentar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [reintentar]);

  useEffect(() => {
    let cancelado = false;
    const publicar = (s: SesionPos) => {
      if (!cancelado) setSesion((actual) => conservarLista(actual, s));
    };

    async function verificar() {
      if (!navigator.onLine) return publicar({ fase: "sin-conexion" });
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      const ya = vista.current;
      if (error) {
        if (esSinSesion(error)) {
          if (!ya) return navegarA("/login");
          return setSesion((s) => (s.fase === "lista" ? { ...s, caducada: true } : s));
        }
        if (esErrorTransitorio(error) && !navigator.onLine)
          return publicar({ fase: "sin-conexion" });
        return publicar({ fase: "error", mensaje: ERROR_AUTH });
      }

      // Otra cuenta inició sesión (otra pestaña): la venta en pantalla es de la anterior y la RLS ya no la vería.
      // No se sustituye la sesión; sigue `caducada` hasta volver a entrar con la misma cuenta.
      if (ya && data.user.id !== ya.usuarioId)
        return setSesion((s) => (s.fase === "lista" ? { ...s, caducada: true } : s));

      const negocios = await listarMisNegocios(supabase, data.user.id);
      if (!negocios.ok) return publicar({ fase: "error", mensaje: negocios.error });
      const activo = negocioDeRecheck(negocios.data, ya?.activoId ?? null, leerNegocioGuardado());
      if (!activo) return navegarA("/sin-acceso");
      const permisos = await permisosDeRol(supabase, activo.tipo, activo.rol);
      if (!permisos.ok) return publicar({ fase: "error", mensaje: permisos.error });
      publicar({
        fase: "lista",
        usuarioId: data.user.id,
        negocios: negocios.data,
        activoId: activo.negocioId,
        permisos: permisos.data,
      });
    }

    verificar().catch((e: unknown) =>
      publicar(
        e instanceof TypeError || !navigator.onLine
          ? { fase: "sin-conexion" }
          : { fase: "error", mensaje: ERROR_AUTH },
      ),
    );
    return () => {
      cancelado = true;
    };
  }, [intento]);

  // Lee los permisos del negocio nuevo antes de nada; si falla devuelve el error y no cambia el estado.
  // La preferencia (cookie) la guarda el selector solo si esto devuelve null.
  async function cambiarActivo(id: string): Promise<string | null> {
    if (sesion.fase !== "lista") return "Sesión no disponible.";
    const nuevo = sesion.negocios.find((n) => n.negocioId === id);
    if (!nuevo) return "No tienes acceso a ese negocio.";
    const permisos = await permisosDeRol(createClient(), nuevo.tipo, nuevo.rol);
    if (!permisos.ok) return permisos.error;
    setSesion({ ...sesion, activoId: id, permisos: permisos.data });
    return null;
  }

  // Tras un rechazo por permisos: vuelve a leer los del negocio activo. Si falla, deja los que había.
  async function refrescarPermisos(): Promise<void> {
    if (sesion.fase !== "lista") return;
    const activo = sesion.negocios.find((n) => n.negocioId === sesion.activoId);
    if (!activo) return;
    const permisos = await permisosDeRol(createClient(), activo.tipo, activo.rol);
    if (!permisos.ok) return;
    setSesion((s) =>
      s.fase === "lista" && s.activoId === activo.negocioId ? { ...s, permisos: permisos.data } : s,
    );
  }

  return { sesion, cambiarActivo, reintentar, refrescarPermisos };
}
