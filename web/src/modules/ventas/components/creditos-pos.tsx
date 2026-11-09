"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearBs } from "@/lib/format/moneda";
import { useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import { SelectorCliente, type ClienteElegido } from "@/modules/clientes";
import {
  cargarCuentas,
  existePagoCuota,
  fechaCorta,
  type Cuenta,
  type PagoCuotaPayload,
} from "@/modules/creditos";
import {
  cobrarCuota,
  cuotaSinConfirmar,
  fijarCuotaSinConfirmar,
  MENSAJE_CUOTA_SIN_CONFIRMAR,
} from "../cobro-cuota";
import { aCentavos, bs, parsearMonto, textoMonto } from "../domain";
import type { EstadoEnvio } from "../use-envio";
import { Cobro } from "./cobro";

// Modo "Cuotas" del POS (RF-CRE-04): busca al cliente, lista sus créditos con saldo y cobra una cuota por la caja abierta.
// Necesita conexión: lee y cobra directo contra el servidor, nunca por la cola offline.
export function CreditosPos({
  negocioId,
  equipoId,
  cajaId,
}: {
  negocioId: string;
  equipoId: string;
  cajaId: string | null;
}) {
  const sinRed = useSinRed();
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [elegida, setElegida] = useState<Cuenta | null>(null);
  const [montoTexto, setMontoTexto] = useState("");
  // Monto (centavos) ya pedido: con él se abre el cobro. Un cobro sin confirmar reabre con lo que se envió.
  const [monto, setMonto] = useState<number | null>(null);
  const [estado, setEstado] = useState<EstadoEnvio>({ t: "libre" });
  // Un id por intento: un cobro nuevo estrena id; reintentar el mismo (sin confirmar) conserva el suyo.
  const intento = useRef<{ id: string; clave: string } | null>(null);

  const cargar = useCallback(
    async (c: ClienteElegido | null) => {
      setCuentas(null);
      setError(null);
      if (!c) return;
      const r = await cargarCuentas(createClient(), negocioId, c.id);
      if (r.ok) setCuentas(r.data);
      else setError(r.error);
    },
    [negocioId],
  );

  if (sinRed)
    return (
      <p role="status" className="bg-secondary rounded-lg p-3 text-sm">
        Cobrar cuotas necesita conexión: no se puede cobrar ni consultar saldos sin red.
      </p>
    );

  const sin = elegida ? cuotaSinConfirmar(elegida.creditoId) : undefined;
  const congelado = sin ? { efectivo: aCentavos(sin.efectivo), qr: aCentavos(sin.qr) } : undefined;
  const cerrarCobro = () => {
    setElegida(null);
    setMonto(null);
    setEstado({ t: "libre" });
  };

  function abrir(c: Cuenta) {
    setAviso(null);
    setEstado({ t: "libre" });
    setElegida(c);
    const previo = cuotaSinConfirmar(c.creditoId);
    if (previo) {
      setMonto(aCentavos(previo.efectivo + previo.qr));
      return;
    }
    setMonto(null);
    setMontoTexto(textoMonto(aCentavos(Math.min(c.proximoMonto || c.saldo, c.saldo))));
  }

  async function confirmar(c: { efectivo: number; qr: number }) {
    if (!elegida || !cajaId || estado.t === "enviando" || estado.t === "verificando") return;
    const creditoId = elegida.creditoId;
    const previo = cuotaSinConfirmar(creditoId);
    const payload: PagoCuotaPayload = previo ?? {
      id: (intento.current?.clave === creditoId ? intento.current.id : null) ?? crypto.randomUUID(),
      credito_id: creditoId,
      dispositivo_id: equipoId,
      caja_sesion_id: cajaId,
      efectivo: c.efectivo / 100,
      qr: c.qr / 100,
    };
    intento.current = { id: payload.id, clave: creditoId };
    setEstado({ t: "enviando" });
    const s = await cobrarCuota(createClient(), payload, {
      alVerificar: () => setEstado({ t: "verificando" }),
    });
    if (s.t === "sin-confirmar") {
      fijarCuotaSinConfirmar(creditoId, payload);
      return setEstado({ t: "rechazada", mensaje: MENSAJE_CUOTA_SIN_CONFIRMAR });
    }
    if (s.t === "rechazada") {
      fijarCuotaSinConfirmar(creditoId, null);
      intento.current = null; // el servidor no guardó nada: el próximo intento estrena id
      return setEstado({ t: "rechazada", mensaje: s.error });
    }
    fijarCuotaSinConfirmar(creditoId, null);
    intento.current = null;
    cerrarCobro();
    setAviso(
      `Cuota cobrada: ${bs(aCentavos(payload.efectivo + payload.qr))} a ${elegida.clienteNombre}.`,
    );
    void cargar(cliente);
  }

  // "Descartar y verificar": ¿quedó registrado el cobro sin confirmar? Si sí, se da por cobrado; si no, se limpia.
  async function verificar() {
    if (!elegida || !sin) return;
    setEstado({ t: "verificando" });
    const r = await existePagoCuota(createClient(), sin.id);
    if (!r.ok)
      return setEstado({
        t: "rechazada",
        mensaje: `No se pudo verificar (${r.error}). No des el recibo por válido; intenta de nuevo.`,
      });
    fijarCuotaSinConfirmar(elegida.creditoId, null);
    intento.current = null;
    const nombre = elegida.clienteNombre;
    cerrarCobro();
    setAviso(
      r.data
        ? `El cobro de ${bs(aCentavos(sin.efectivo + sin.qr))} a ${nombre} sí quedó registrado.`
        : "No se registró: la cuota no se cobró. Puedes cobrar de nuevo.",
    );
    void cargar(cliente);
  }

  const saldoMax = elegida ? aCentavos(elegida.saldo) : 0;
  const montoPedido = parsearMonto(montoTexto);
  const montoValido = montoPedido !== null && montoPedido > 0 && montoPedido <= saldoMax;

  return (
    <section aria-label="Cobrar cuotas" className="flex flex-col gap-3">
      <div className="bg-card flex max-w-xl flex-col gap-2 rounded-xl border p-3">
        <p className="text-sm font-medium">Cliente con crédito</p>
        <SelectorCliente
          negocioId={negocioId}
          obligatorio
          valor={cliente}
          alCambiar={(c) => {
            setCliente(c);
            setAviso(null);
            void cargar(c);
          }}
        />
      </div>
      <div role="status" className="flex flex-col gap-3 empty:hidden">
        {aviso && <p className="bg-secondary rounded-lg p-3 text-sm font-medium">{aviso}</p>}
        {cliente && cuentas === null && !error && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando créditos…
          </p>
        )}
        {cuentas?.length === 0 && (
          <p className="text-muted-foreground py-2 text-sm">
            {cliente?.nombre} no tiene créditos con saldo.
          </p>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="border-destructive text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm"
        >
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => void cargar(cliente)}
          >
            Reintentar
          </Button>
        </div>
      )}
      <ul
        aria-label="Créditos con saldo"
        className="divide-border bg-card divide-y rounded-xl border empty:hidden"
      >
        {cuentas?.map((c) => (
          <li
            key={c.creditoId}
            aria-label={`Crédito ${c.ventaNumero ?? "saldo inicial"} de ${c.clienteNombre}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate text-sm font-semibold">
                {c.ventaNumero ? `Venta ${c.ventaNumero}` : "Saldo inicial"}
              </p>
              <p className="text-muted-foreground text-xs tabular-nums">
                Saldo {formatearBs(c.saldo)}
                {c.proximaVence &&
                  ` · próxima cuota ${formatearBs(c.proximoMonto)} (${fechaCorta(c.proximaVence)})`}
              </p>
              {c.cuotasVencidas > 0 && (
                <p className="text-destructive text-xs tabular-nums">
                  {c.cuotasVencidas} {c.cuotasVencidas === 1 ? "cuota vencida" : "cuotas vencidas"}:{" "}
                  {formatearBs(c.montoVencido)}, {c.diasAtraso}{" "}
                  {c.diasAtraso === 1 ? "día" : "días"} de atraso
                </p>
              )}
            </div>
            <Button
              type="button"
              className="h-10"
              disabled={!cajaId}
              title={!cajaId ? "Abre la caja para cobrar" : undefined}
              aria-label={`Cobrar cuota de ${c.clienteNombre} (${c.ventaNumero ?? "saldo inicial"})`}
              onClick={() => abrir(c)}
            >
              Cobrar cuota
            </Button>
          </li>
        ))}
      </ul>

      {elegida && monto === null && (
        <AlertDialog open onOpenChange={(abierto) => !abierto && cerrarCobro()}>
          <AlertDialogContent className="w-[calc(100%-1rem)] data-[size=default]:max-w-sm">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (montoValido) setMonto(montoPedido);
              }}
            >
              <AlertDialogTitle>Cobrar cuota</AlertDialogTitle>
              <p className="text-sm tabular-nums">
                {elegida.clienteNombre} · saldo {formatearBs(elegida.saldo)}
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cuota-monto">Monto a cobrar (Bs)</Label>
                <Input
                  id="cuota-monto"
                  autoFocus
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-11 text-right text-lg tabular-nums"
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <p role="status" className="text-muted-foreground text-xs empty:hidden">
                  {montoTexto.trim() !== "" && !montoValido
                    ? `Escribe un monto mayor a 0 y hasta el saldo (${formatearBs(elegida.saldo)}).`
                    : "Un pago parcial se aplica a la cuota más vieja."}
                </p>
              </div>
              <div className="flex gap-2">
                <AlertDialogCancel className="h-12">Volver</AlertDialogCancel>
                <Button
                  type="submit"
                  className="h-12 flex-1 aria-disabled:opacity-50"
                  aria-disabled={!montoValido}
                >
                  Continuar
                </Button>
              </div>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {elegida && monto !== null && (
        <Cobro
          total={monto}
          titulo="Cobrar cuota"
          detalle={`${elegida.clienteNombre} · ${elegida.ventaNumero ? `venta ${elegida.ventaNumero}` : "saldo inicial"} · saldo ${formatearBs(elegida.saldo)}.`}
          congelado={congelado}
          alVerificar={() => void verificar()}
          estado={estado}
          alCerrar={() => {
            if (estado.t !== "enviando" && estado.t !== "verificando") cerrarCobro();
          }}
          alConfirmar={(c) => void confirmar(c)}
        />
      )}
    </section>
  );
}
