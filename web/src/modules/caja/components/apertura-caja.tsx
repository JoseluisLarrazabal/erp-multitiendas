"use client";

import { Loader2, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/browser";
import { parsearMontoInicial } from "../domain";
import { abrirCaja } from "../queries";
import { aperturaSchema, type SesionCaja } from "../schemas";

// El UUID de la apertura vive en una ref: reintentar tras un fallo de red reenvía el mismo id.
export function AperturaCaja({
  negocioId,
  dispositivoId,
  nombreEquipo,
  alAbrir,
}: {
  negocioId: string;
  dispositivoId: string;
  nombreEquipo: string;
  alAbrir: (sesion: SesionCaja) => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const intento = useRef<{ id: string; centavos: number } | null>(null);

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
    const r = await abrirCaja(createClient(), {
      id: intento.current.id,
      negocioId,
      dispositivoId,
      montoInicial: centavos / 100,
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    alAbrir(r.data);
  }

  return (
    <form
      onSubmit={abrir}
      className="bg-card mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border p-4"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Wallet className="size-4" aria-hidden /> Abrir caja · {nombreEquipo}
      </h2>
      <p className="text-muted-foreground text-sm">
        Cuenta el efectivo inicial del cajón y regístralo para empezar a vender.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monto-inicial">Efectivo inicial (Bs)</Label>
        <Input
          id="monto-inicial"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          className="h-11 text-right tabular-nums"
          placeholder="0,00"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11" disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" aria-hidden />} Abrir caja
      </Button>
    </form>
  );
}
