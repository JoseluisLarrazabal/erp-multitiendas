"use client";

import { Banknote, Loader2, QrCode } from "lucide-react";
import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSinRed } from "@/lib/offline/red";
import { bs, calcularCobro, parsearMonto, textoMonto } from "../domain";
import type { EstadoEnvio } from "../use-envio";

// Cobro (RF-VEN-02): efectivo y QR combinables. El pago enviado es el monto aplicado; el vuelto es solo de pantalla.
// Es un AlertDialog (Escape, foco atrapado, aria-modal). Mientras envía no se cierra.
export function Cobro({
  total: totalVenta,
  titulo = "Cobrar venta",
  detalle,
  anticipo = 0,
  congelado,
  alVerificar,
  estado,
  alConfirmar,
  alCerrar,
}: {
  total: number;
  titulo?: string;
  // Texto aclaratorio bajo el total (p. ej. el crédito: total de la venta, inicial y cuotas).
  detalle?: string;
  // Reserva: anticipo ya recibido (centavos). Se cobra solo el saldo.
  anticipo?: number;
  // Cobro de reserva sin confirmar: lo enviado (centavos) queda fijo y solo se puede reintentar idéntico o verificar.
  congelado?: { efectivo: number; qr: number };
  alVerificar?: () => void;
  estado: EstadoEnvio;
  alConfirmar: (c: {
    efectivo: number;
    qr: number;
    qrConfirmado: boolean;
    recibido: number;
  }) => void;
  alCerrar: () => void;
}) {
  const total = totalVenta - anticipo;
  const [qrTexto, setQrTexto] = useState(
    congelado && congelado.qr > 0 ? textoMonto(congelado.qr) : "",
  );
  const [recibidoTexto, setRecibidoTexto] = useState(
    textoMonto(congelado ? congelado.efectivo : total),
  );
  const [recibidoEditado, setRecibidoEditado] = useState(false);
  const [qrOk, setQrOk] = useState(!!congelado && congelado.qr > 0);
  // Sin conexión el QR no se puede comprobar: se cobra como pendiente de verificar, sin casilla.
  const sinRed = useSinRed();
  const primero = useRef<HTMLInputElement>(null);

  const qr = qrTexto.trim() === "" ? 0 : parsearMonto(qrTexto);
  const recibido = parsearMonto(recibidoTexto);
  const calculo =
    qr === null || recibido === null ? null : calcularCobro(total, qr, recibido, qrOk || sinRed);
  const aplicado = qr === null ? total : Math.max(total - qr, 0);
  const ocupado = estado.t === "enviando" || estado.t === "verificando";

  // Otro monto de QR es otro pago: la confirmación de que llegó se pide de nuevo.
  function cambiarQr(v: string) {
    setQrTexto(v);
    setQrOk(false);
    const n = v.trim() === "" ? 0 : parsearMonto(v);
    if (!recibidoEditado && n !== null) setRecibidoTexto(textoMonto(Math.max(total - n, 0)));
  }

  return (
    <AlertDialog
      open
      onOpenChange={(abierto) => {
        if (!abierto && !ocupado) alCerrar();
      }}
    >
      <AlertDialogContent
        // Teclado y ratón: al efectivo. En táctil, el foco por defecto (el diálogo) para no abrir el teclado.
        initialFocus={() => (window.matchMedia("(pointer: fine)").matches ? primero.current : true)}
        className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto data-[size=default]:max-w-md data-[size=default]:sm:max-w-md"
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (calculo?.ok && !ocupado)
              alConfirmar({
                efectivo: calculo.efectivo,
                qr: calculo.qr,
                qrConfirmado: qrOk && !sinRed,
                recibido: recibido ?? 0,
              });
          }}
        >
          <div className="flex items-baseline justify-between">
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <p className="text-2xl font-bold tabular-nums">{bs(total)}</p>
          </div>
          {detalle && (
            <p className="bg-muted rounded-lg px-3 py-2 text-sm tabular-nums">{detalle}</p>
          )}
          {anticipo > 0 && (
            <p className="bg-muted rounded-lg px-3 py-2 text-sm tabular-nums">
              Total {bs(totalVenta)} menos el anticipo de la reserva {bs(anticipo)}.
            </p>
          )}

          <fieldset disabled={ocupado || !!congelado} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cobro-qr">
                <QrCode className="size-4" aria-hidden /> Pago por QR (Bs)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cobro-qr"
                  inputMode="decimal"
                  placeholder="0,00"
                  autoComplete="off"
                  className="h-11 text-right text-lg tabular-nums"
                  value={qrTexto}
                  onChange={(e) => cambiarQr(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => cambiarQr(textoMonto(total))}
                >
                  Todo QR
                </Button>
              </div>
              {qr !== null && qr > 0 && sinRed && (
                <p className="bg-muted rounded-lg px-3 py-2 text-sm">
                  QR pendiente de verificar: sin conexión no se puede confirmar. Queda marcado para
                  que el encargado lo revise.
                </p>
              )}
              {qr !== null && qr > 0 && !sinRed && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5"
                    checked={qrOk}
                    onChange={(e) => setQrOk(e.target.checked)}
                  />
                  <span>Confirmo que recibí {bs(qr)} por QR en mi cuenta.</span>
                </label>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cobro-efectivo">
                <Banknote className="size-4" aria-hidden /> Efectivo recibido (Bs)
              </Label>
              <Input
                id="cobro-efectivo"
                ref={primero}
                inputMode="decimal"
                autoComplete="off"
                className="h-11 text-right text-lg tabular-nums"
                value={recibidoTexto}
                onChange={(e) => {
                  setRecibidoTexto(e.target.value);
                  setRecibidoEditado(true);
                }}
                onFocus={(e) => e.currentTarget.select()}
              />
              <p className="text-muted-foreground text-xs tabular-nums">
                Efectivo a cobrar: {bs(aplicado)}
              </p>
            </div>
          </fieldset>

          <p
            className="bg-muted flex items-baseline justify-between rounded-lg px-3 py-2 text-sm"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>Vuelto</span>
            <span className="text-xl font-bold tabular-nums">
              {calculo?.ok ? bs(calculo.vuelto) : "—"}
            </span>
          </p>

          <p role="status" className="text-muted-foreground text-xs empty:hidden">
            {calculo && !calculo.ok ? calculo.error : null}
          </p>
          {congelado && (
            <p className="bg-muted rounded-lg px-3 py-2 text-sm">
              Cobro sin confirmar: los montos quedaron fijos ({bs(congelado.efectivo)} en efectivo
              {congelado.qr > 0 ? ` y ${bs(congelado.qr)} por QR` : ""}). Reintenta o verifica si
              quedó registrado.
            </p>
          )}
          {estado.t === "rechazada" && (
            <p
              role="alert"
              className="border-destructive text-destructive rounded-lg border p-2.5 text-sm"
            >
              {estado.mensaje}
            </p>
          )}

          <div className="flex gap-2">
            <AlertDialogCancel className="h-12" disabled={ocupado}>
              Volver
            </AlertDialogCancel>
            {congelado && (
              <Button
                type="button"
                variant="outline"
                className="h-12"
                disabled={ocupado}
                onClick={alVerificar}
              >
                Descartar y verificar
              </Button>
            )}
            {/* aria-disabled y no disabled: al enviar el foco no se pierde; la guarda real está en onSubmit. */}
            <Button
              type="submit"
              className="h-12 flex-1 text-base aria-disabled:opacity-50"
              aria-disabled={!calculo?.ok || ocupado}
            >
              {ocupado && <Loader2 className="animate-spin" aria-hidden />}{" "}
              {estado.t === "verificando"
                ? "Verificando el cobro…"
                : ocupado
                  ? "Enviando…"
                  : congelado
                    ? "Reintentar cobro"
                    : "Confirmar cobro"}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
