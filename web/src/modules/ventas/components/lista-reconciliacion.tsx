"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";
import { useAccion } from "@/components/panel/use-accion";
import { formatearFechaHora } from "@/lib/format/fecha";
import { textoEnviadaPor } from "@/lib/format/enviada-por";
import { formatearBs } from "@/lib/format/moneda";
import { revisarVenta, verificarPagoQr } from "../actions";
import { textoMotivo } from "../domain-panel";
import type { FilaReconciliacion } from "../lecturas-panel";

const REVISAR = "revisar";
const COBRADO = "cobrado:";

function FilaVenta({
  v,
  alResolver,
}: {
  v: FilaReconciliacion;
  alResolver: (texto: string) => void;
}) {
  const { pendiente, error, ejecutar } = useAccion();
  // Cuál botón se pulsó: el indicador de carga y el error van con él, el resto de la fila se deshabilita.
  const [cual, setCual] = useState<string | null>(null);
  const enviada = textoEnviadaPor(v.vendedorId, v.enviadaPor, v.enviadaPorNombre);
  const porRevisar = v.motivos.length > 0 && !v.revisada;
  const lanzar = (id: string, accion: Parameters<typeof ejecutar>[0], texto: string) => {
    setCual(id);
    ejecutar(accion, () => alResolver(texto));
  };
  const errorDe = (id: string) =>
    error &&
    cual === id && (
      <p role="alert" className="text-destructive w-full text-sm">
        {error}
      </p>
    );
  return (
    <li className="flex flex-col gap-3 py-4" data-testid="reco-venta">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          href={`/panel/ventas/${v.id}`}
          className="focus-visible:ring-ring rounded font-mono text-[13px] font-semibold outline-none hover:underline focus-visible:ring-3"
        >
          {v.numero}
        </Link>
        <span className="cifra text-[13px]">{formatearBs(v.total)}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        Vendida {formatearFechaHora(v.creadaEn)} · recibida {formatearFechaHora(v.recibidaEn)} ·{" "}
        {v.vendedor ?? "Vendedor desconocido"} · {enviada ?? "Sin conexión"}
      </p>

      {v.motivos.length > 0 && (
        <ul aria-label="Motivos de revisión" className="flex flex-wrap gap-1.5">
          {v.motivos.map((m) => (
            <li key={m}>
              <Etiqueta tono="aviso">{textoMotivo(m)}</Etiqueta>
            </li>
          ))}
        </ul>
      )}
      {v.motivos.length > 0 && v.revisada && (
        <p className="text-muted-foreground text-xs">Ya revisados</p>
      )}

      {v.pagosPendientes.map((p) => (
        <div
          key={p.id}
          className="border-warning-line bg-warning-soft flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
        >
          <p className="text-sm">
            QR pendiente de verificar <strong className="cifra">{formatearBs(p.monto)}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pendiente}
              onClick={() =>
                lanzar(
                  COBRADO + p.id,
                  () => verificarPagoQr({ pagoId: p.id, cobrado: true }),
                  `QR de la venta ${v.numero} marcado como cobrado.`,
                )
              }
            >
              {pendiente && cual === COBRADO + p.id && (
                <Loader2 className="animate-spin" aria-hidden />
              )}
              {pendiente && cual === COBRADO + p.id ? "Verificando…" : "QR cobrado"}
            </Button>
            <ConfirmarAccion
              etiqueta="QR no llegó"
              deshabilitado={pendiente}
              titulo={`¿El QR de ${formatearBs(p.monto)} no llegó?`}
              descripcion={`El pago de la venta ${v.numero} se marca como rechazado y deja de contar en el QR de la caja. La venta sigue completada: anúlala o devuélvela si corresponde.`}
              confirmar="QR no llegó"
              focoFinal={() => document.getElementById("reco-estado")}
              accion={async () => {
                const r = await verificarPagoQr({ pagoId: p.id, cobrado: false });
                if (r.ok) alResolver(`QR de la venta ${v.numero} marcado como no llegó.`);
                return r;
              }}
            />
          </div>
          {errorDe(COBRADO + p.id)}
        </div>
      ))}

      {porRevisar && (
        <Button
          variant="outline"
          className="self-start"
          disabled={pendiente}
          onClick={() =>
            lanzar(
              REVISAR,
              () => revisarVenta({ ventaId: v.id }),
              `Venta ${v.numero} marcada como revisada.`,
            )
          }
        >
          {pendiente && cual === REVISAR ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          {pendiente && cual === REVISAR ? "Marcando…" : "Marcar revisada"}
        </Button>
      )}
      {errorDe(REVISAR)}
    </li>
  );
}

export function ListaReconciliacion({
  ventas,
  textoVacio,
}: {
  ventas: readonly FilaReconciliacion[];
  textoVacio: string;
}) {
  const [aviso, setAviso] = useState("");
  const estado = useRef<HTMLParagraphElement>(null);
  // La fila resuelta se desmonta: el foco pasa al aviso, que persiste y se anuncia a lectores de pantalla.
  useEffect(() => {
    if (aviso) estado.current?.focus();
  }, [aviso]);
  return (
    <>
      <p
        id="reco-estado"
        ref={estado}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="text-sm font-medium outline-none empty:hidden"
      >
        {aviso}
      </p>
      {ventas.length === 0 ? (
        <EstadoVacio>{textoVacio}</EstadoVacio>
      ) : (
        <ul aria-label="Ventas a revisar" className="divide-y">
          {ventas.map((v) => (
            <FilaVenta key={v.id} v={v} alResolver={setAviso} />
          ))}
        </ul>
      )}
    </>
  );
}
