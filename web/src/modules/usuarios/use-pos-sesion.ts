"use client";

import { navegarA } from "@/lib/navegar";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { esErrorTransitorio, esSinSesion } from "@/lib/supabase/errores";
import { elegirNegocioActivo, type NegocioUsuario } from "./domain";
import { leerNegocioGuardado } from "./negocio-cliente";
import { listarMisNegocios, permisosDeRol } from "./queries";

export type SesionPos =
  | { fase: "verificando" }
  | { fase: "sin-conexion" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; negocios: NegocioUsuario[]; activoId: string; permisos: string[] };

const ERROR_AUTH = "No pudimos verificar tu sesión.";

// /pos es estático: no hay servidor que decida, así que la guarda vive en el cliente.
// Solo va a /login si no hay sesión o es inválida; cualquier otro fallo de Auth es `error` y no navega
// (si no, /login ↔ /pos harían bucle). Sin red abre con lo que haya: la venta se guarda en la cola y la
// RLS decide al sincronizar.
// shortcut: sin red no se muestra el negocio ni los permisos, porque no se cachean; cuando la cola offline
// guarde el snapshot en IndexedDB (fase 3), leerlos de ahí.
export function usePosSesion(): {
  sesion: SesionPos;
  cambiarActivo: (id: string) => Promise<string | null>;
  reintentar: () => void;
} {
  const [sesion, setSesion] = useState<SesionPos>({ fase: "verificando" });
  const [intento, setIntento] = useState(0);
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  // Al volver la red se vuelve a verificar, sin recargar.
  useEffect(() => {
    window.addEventListener("online", reintentar);
    return () => window.removeEventListener("online", reintentar);
  }, [reintentar]);

  useEffect(() => {
    let cancelado = false;
    const publicar = (s: SesionPos) => {
      if (!cancelado) setSesion(s);
    };

    async function verificar() {
      if (!navigator.onLine) return publicar({ fase: "sin-conexion" });
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        if (esSinSesion(error)) return navegarA("/login");
        if (esErrorTransitorio(error) && !navigator.onLine)
          return publicar({ fase: "sin-conexion" });
        return publicar({ fase: "error", mensaje: ERROR_AUTH });
      }

      const negocios = await listarMisNegocios(supabase, data.user.id);
      if (!negocios.ok) return publicar({ fase: "error", mensaje: negocios.error });
      const activo = elegirNegocioActivo(negocios.data, leerNegocioGuardado());
      if (!activo) return navegarA("/sin-acceso");
      const permisos = await permisosDeRol(supabase, activo.tipo, activo.rol);
      if (!permisos.ok) return publicar({ fase: "error", mensaje: permisos.error });
      publicar({
        fase: "lista",
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

  return { sesion, cambiarActivo, reintentar };
}
