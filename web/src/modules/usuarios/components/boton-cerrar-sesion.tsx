"use client";

import { navegarA } from "@/lib/navegar";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bloquearEscrituras } from "@/lib/offline/datos";
import { createClient } from "@/lib/supabase/browser";
import { borrarContextoLocal } from "../contexto-local";
import { borrarNegocioGuardado } from "../negocio-cliente";

// Navegación completa a /login (no soft): limpia el caché del router y suelta el service worker.
export function BotonCerrarSesion({ deshabilitado = false }: { deshabilitado?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function salir() {
    setError(null);
    setPendiente(true);
    // Una escritura tardía (catálogo, contexto) no puede reaparecer tras el borrado.
    bloquearEscrituras(true);
    try {
      // scope local: cerrar un POS no debe matar la sesión del dueño en otro equipo.
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      borrarNegocioGuardado();
      // El contexto offline se va con la sesión; la cola de ventas pendientes no se toca.
      // Tope solo contra un IndexedDB colgado: con las escrituras bloqueadas, un borrado lento igual termina antes.
      await Promise.race([borrarContextoLocal(), new Promise((r) => setTimeout(r, 10_000))]);
      navegarA("/login");
    } catch {
      bloquearEscrituras(false);
      setError("No se pudo cerrar la sesión. Revisa tu conexión.");
      setPendiente(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        className="h-10"
        onClick={() => void salir()}
        disabled={pendiente || deshabilitado}
        title={deshabilitado ? "Necesitas conexión para cerrar sesión" : undefined}
      >
        <LogOut aria-hidden />
        {pendiente ? "Cerrando…" : "Cerrar sesión"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
