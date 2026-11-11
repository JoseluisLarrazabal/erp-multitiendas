"use client";

import { Loader2, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { avisarRed, useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import { encolarApertura } from "../cola-caja";
import { parsearMontoInicial } from "../domain";
import { abrirCaja } from "../queries";
import { aperturaSchema, type SesionCaja } from "../schemas";

// El UUID de la apertura vive en una ref: reintentar tras un fallo de red reenvía el mismo id.
const MENSAJE_COLA =
  "No se pudo guardar la apertura en este equipo. Revisa el espacio y los permisos del navegador, o recarga la página.";

// Con red abre como siempre (un rechazo se muestra aquí y no se encola). Sin red, o si la red falla al abrir, la
// apertura entra a la cola y el POS usa su UUID como caja local: las ventas siguientes ya apuntan a ella.
export function AperturaCaja({
  negocioId,
  dispositivoId,
  usuarioId,
  nombreEquipo,
  alAbrir,
  alEncolar,
}: {
  negocioId: string;
  dispositivoId: string;
  usuarioId: string;
  nombreEquipo: string;
  alAbrir: (sesion: SesionCaja) => void;
  // Tras encolar la apertura: el motor la envía sin esperar el temporizador.
  alEncolar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const intento = useRef<{ id: string; centavos: number } | null>(null);
  const sinRed = useSinRed();

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const centavos = parsearMontoInicial(texto);
    if (centavos === null || !aperturaSchema.safeParse({ montoInicial: centavos / 100 }).success)
      return setError("Escribe un monto válido, por ejemplo 100 o 100,50.");
    // Otro monto es otra apertura: id nuevo. El mismo monto reintenta con el mismo id.
    if (intento.current?.centavos !== centavos)
      intento.current = { id: crypto.randomUUID(), centavos };
    setError(null);
    setEnviando(true);
    const { id } = intento.current;
    if (!sinRed) {
      const r = await abrirCaja(createClient(), {
        id,
        negocioId,
        dispositivoId,
        montoInicial: centavos / 100,
      });
      if (r.ok) {
        avisarRed(true);
        setEnviando(false);
        return alAbrir(r.data);
      }
      if (!r.red) {
        setEnviando(false);
        return setError(r.error);
      }
      avisarRed(false);
    }
    try {
      const sesion = await encolarApertura({
        id,
        negocioId,
        dispositivoId,
        usuarioId,
        montoInicial: centavos / 100,
      });
      alEncolar();
      alAbrir(sesion);
    } catch {
      setError(MENSAJE_COLA);
    }
    setEnviando(false);
  }

  return (
    <form
      onSubmit={abrir}
      className="bg-card shadow-card mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border p-5"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Wallet className="size-4" aria-hidden /> Abrir caja · {nombreEquipo}
      </h2>
      <p className="text-muted-foreground text-[15px]">
        Cuenta el efectivo inicial del cajón y regístralo para empezar a vender.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monto-inicial">Efectivo inicial (Bs)</Label>
        <Input
          id="monto-inicial"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          className="cifra h-12 text-right text-lg md:text-lg"
          placeholder="0,00"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      {sinRed && (
        <p role="status" className="bg-secondary text-secondary-foreground rounded-lg p-3 text-sm">
          Sin red: la apertura se guarda en este equipo y se envía al volver la conexión.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="xl" disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />} Abrir caja
      </Button>
    </form>
  );
}
