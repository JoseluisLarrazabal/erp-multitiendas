"use client";

import { navegarA } from "@/lib/navegar";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/browser";
import { ERROR_CONEXION, ERROR_CREDENCIALES, mensajeErrorLogin } from "../login";
import { borrarContextoLocal } from "../contexto-local";
import { loginSchema } from "../schemas";

const sinSuscripcion = () => () => {};

export function LoginForm() {
  // false en el servidor y durante la hidratación, true después: enviar antes haría un POST nativo a /login.
  const hidratado = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  // Llegar a /login es haber salido (expulsión del proxy, del panel o sesión caducada): el contexto de la cuenta anterior
  // no debe sobrevivir. La cola de ventas no se toca.
  useEffect(() => {
    void borrarContextoLocal();
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const invalido = error !== null;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      correo: datos.get("correo"),
      contrasena: datos.get("contrasena"),
    });
    if (!parsed.success) return setError(ERROR_CREDENCIALES);

    setError(null);
    setEnviando(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: parsed.data.correo,
        password: parsed.data.contrasena,
      });
      if (error) {
        setError(mensajeErrorLogin(error));
        setEnviando(false);
        return;
      }
      // Navegación completa: la primera pestaña queda controlada por el service worker y `/` decide el destino.
      navegarA("/");
    } catch {
      setError(ERROR_CONEXION);
      setEnviando(false);
    }
  }

  return (
    // method=post como red de seguridad: con el botón deshabilitado hasta hidratar, Enter tampoco envía.
    <form method="post" onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="correo">Correo</Label>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className="h-12"
          aria-invalid={invalido}
          aria-describedby={invalido ? "login-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          className="h-12"
          aria-invalid={invalido}
          aria-describedby={invalido ? "login-error" : undefined}
        />
      </div>
      <p id="login-error" role="alert" className="text-destructive min-h-5 text-sm font-medium">
        {error}
      </p>
      <Button type="submit" size="xl" disabled={enviando || !hidratado}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />}
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
