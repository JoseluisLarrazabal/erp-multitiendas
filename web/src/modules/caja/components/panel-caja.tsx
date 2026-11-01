"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { formatearBs } from "@/lib/format/moneda";
import { formatearHora } from "@/lib/format/fecha";
import { createClient } from "@/lib/supabase/browser";
import {
  ETIQUETA_MOVIMIENTO,
  parsearMontoInicial,
  parsearMontoPositivo,
  type Movimiento,
  type TipoMovimiento,
} from "../domain";
import { cerrarSesion, listarMovimientos, registrarMovimiento } from "../queries";
import { movimientoSchema, type Cierre } from "../schemas";

const AYUDA_ARQUEO = "Cuenta el efectivo del cajón. El sistema compara con lo esperado al cerrar.";

// Movimientos de caja (ingreso, gasto, retiro) y cierre con arqueo. Todo en el cliente, sin server actions.
// Los UUID viven en refs: reintentar tras un corte reenvía el mismo id; otro dato es otra operación.
export function PanelCaja({
  nombreEquipo,
  sesionId,
  ventaPendiente,
  alCerrar,
  alYaCerrada,
  alVolver,
}: {
  nombreEquipo: string;
  sesionId: string | null;
  ventaPendiente: boolean;
  // El servidor confirmó el cierre: el POS pasa a pedir la apertura.
  alCerrar: () => void;
  // ERP_CAJA_CERRADA al cerrar: la caja ya estaba cerrada. El POS la vuelve a consultar; devuelve un error o null.
  alYaCerrada: () => Promise<string | null>;
  alVolver: () => void;
}) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [totalMovimientos, setTotalMovimientos] = useState(0);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoMovimiento>("gasto");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errorMov, setErrorMov] = useState<string | null>(null);
  const [avisoMov, setAvisoMov] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const intentoMov = useRef<{ clave: string; id: string } | null>(null);

  const [contado, setContado] = useState("");
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [resultado, setResultado] = useState<{ cierre: Cierre; contado: number } | null>(null);

  // `version` sube tras registrar un movimiento para releer la lista.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!sesionId) return;
    let cancelado = false;
    listarMovimientos(createClient(), sesionId).then((r) => {
      if (cancelado) return;
      if (r.ok) {
        setMovimientos(r.data.movimientos);
        setTotalMovimientos(r.data.total);
        setErrorLista(null);
      } else setErrorLista(r.error);
    });
    return () => {
      cancelado = true;
    };
  }, [sesionId, version]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (registrando || !sesionId) return;
    setAvisoMov("");
    const centavos = parsearMontoPositivo(monto);
    const datos = { tipo, monto: centavos === null ? NaN : centavos / 100, motivo };
    const v = movimientoSchema.safeParse(datos);
    if (!v.success) {
      return setErrorMov(
        centavos === null
          ? "Escribe un monto mayor a 0, por ejemplo 25 o 25,50."
          : "Escribe el motivo del movimiento (hasta 200 caracteres).",
      );
    }
    const clave = JSON.stringify(v.data);
    if (intentoMov.current?.clave !== clave)
      intentoMov.current = { clave, id: crypto.randomUUID() };
    setErrorMov(null);
    setRegistrando(true);
    const r = await registrarMovimiento(createClient(), {
      id: intentoMov.current.id,
      sesionId,
      ...v.data,
    });
    setRegistrando(false);
    if (!r.ok) return setErrorMov(r.error);
    intentoMov.current = null;
    setMonto("");
    setMotivo("");
    setAvisoMov(`${ETIQUETA_MOVIMIENTO[tipo]} registrado.`);
    setVersion((n) => n + 1);
  }

  async function cerrar() {
    if (!sesionId || cerrando) return;
    const centavos = parsearMontoInicial(contado);
    if (centavos === null) return;
    setCerrando(true);
    setErrorCierre(null);
    // Idempotente por (sesión, contado): reenviar tras un corte devuelve el resultado guardado.
    const r = await cerrarSesion(createClient(), sesionId, centavos / 100);
    setCerrando(false);
    setConfirmando(false);
    if (!r.ok) {
      if (r.codigo !== "ERP_CAJA_CERRADA") return setErrorCierre(r.error);
      // Se cerró con otro contado (p. ej. respuesta perdida y reintento): se comprueba y se lleva a la apertura.
      return setErrorCierre((await alYaCerrada()) ?? "La caja ya estaba cerrada.");
    }
    setResultado({ cierre: r.data, contado: centavos / 100 });
    alCerrar();
  }

  function pedirCierre(e: React.FormEvent) {
    e.preventDefault();
    if (ventaPendiente) return;
    if (contado.trim() === "" || parsearMontoInicial(contado) === null)
      return setErrorCierre("Escribe el efectivo contado, por ejemplo 350 o 350,50.");
    setErrorCierre(null);
    setConfirmando(true);
  }

  if (resultado)
    return <ResultadoCierre r={resultado} nombreEquipo={nombreEquipo} alVolver={alVolver} />;

  return (
    <div className="flex flex-col gap-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="h-10" onClick={alVolver}>
          <ArrowLeft aria-hidden /> Volver a vender
        </Button>
        <h2 className="text-base font-semibold">Caja · {nombreEquipo}</h2>
      </div>
      {!sesionId ? (
        <p role="alert" className="bg-secondary rounded-lg p-3 text-sm">
          Este equipo no tiene la caja abierta.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section
            aria-label="Movimientos"
            className="bg-card flex flex-col gap-3 rounded-xl border p-4"
          >
            <h3 className="text-sm font-semibold">Movimientos de caja</h3>
            <form onSubmit={registrar} className="flex flex-col gap-3" noValidate>
              <div className="grid grid-cols-[8rem_1fr] gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mov-tipo">Tipo</Label>
                  <SelectNativo
                    id="mov-tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoMovimiento)}
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="gasto">Gasto</option>
                    <option value="retiro">Retiro</option>
                  </SelectNativo>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mov-monto">Monto (Bs)</Label>
                  <Input
                    id="mov-monto"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    className="h-10 text-right tabular-nums"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mov-motivo">Motivo</Label>
                <Input
                  id="mov-motivo"
                  autoComplete="off"
                  maxLength={200}
                  className="h-10"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <p role="alert" className="text-destructive text-sm empty:hidden">
                {errorMov}
              </p>
              <p role="status" className="text-sm font-medium empty:hidden">
                {avisoMov}
              </p>
              <Button type="submit" className="h-10 self-start" disabled={registrando}>
                {registrando && <Loader2 className="animate-spin" aria-hidden />} Registrar
                movimiento
              </Button>
            </form>
            <p role="alert" className="text-destructive text-sm empty:hidden">
              {errorLista}
            </p>
            {movimientos.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin movimientos en esta sesión.</p>
            ) : (
              <ul aria-label="Movimientos registrados" className="divide-y text-sm">
                {movimientos.map((m) => (
                  <li key={m.id} className="flex items-baseline gap-2 py-2">
                    <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
                      {formatearHora(m.creadoEn)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{ETIQUETA_MOVIMIENTO[m.tipo]}</span>
                      <span className="text-muted-foreground"> · {m.motivo}</span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {formatearBs(m.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {totalMovimientos > movimientos.length && (
              <p className="text-muted-foreground text-xs">
                Mostrando {movimientos.length} de {totalMovimientos} movimientos (los más
                recientes).
              </p>
            )}
          </section>

          <section
            aria-label="Cierre de caja"
            className="bg-card flex flex-col gap-3 rounded-xl border p-4"
          >
            <h3 className="text-sm font-semibold">Cerrar caja</h3>
            <p className="text-muted-foreground text-sm">{AYUDA_ARQUEO}</p>
            <form onSubmit={pedirCierre} className="flex flex-col gap-3" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cierre-contado">Efectivo contado (Bs)</Label>
                <Input
                  id="cierre-contado"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  className="h-11 text-right tabular-nums"
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                />
              </div>
              {ventaPendiente && (
                <p role="alert" className="text-destructive text-sm">
                  Hay una venta pendiente de envío. Resuélvela antes de cerrar la caja.
                </p>
              )}
              <p role="alert" className="text-destructive text-sm empty:hidden">
                {errorCierre}
              </p>
              <Button
                type="submit"
                className="h-11 self-start"
                disabled={ventaPendiente || cerrando}
              >
                {cerrando && <Loader2 className="animate-spin" aria-hidden />} Cerrar caja
              </Button>
            </form>
          </section>
        </div>
      )}

      <AlertDialog
        open={confirmando}
        onOpenChange={(abierto) => {
          if (!abierto && !cerrando) setConfirmando(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la caja de {nombreEquipo}?</AlertDialogTitle>
            <AlertDialogDescription>
              Contaste {formatearBs((parsearMontoInicial(contado) ?? 0) / 100)}. Al cerrar no se
              pueden registrar más ventas ni movimientos en esta sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cerrando} className="h-11">
              Seguir en caja
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              disabled={cerrando}
              onClick={(e) => {
                e.preventDefault();
                void cerrar();
              }}
            >
              {cerrando && <Loader2 className="animate-spin" aria-hidden />} Cerrar caja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResultadoCierre({
  r,
  nombreEquipo,
  alVolver,
}: {
  r: { cierre: Cierre; contado: number };
  nombreEquipo: string;
  alVolver: () => void;
}) {
  const dif = Math.round(r.cierre.diferencia * 100) / 100;
  const estado = dif === 0 ? "Sin diferencia" : dif > 0 ? "Sobrante" : "Faltante";
  const fila = "flex items-baseline justify-between gap-3 py-2";
  return (
    <section
      aria-label="Resultado del cierre"
      className="bg-card mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border p-4"
    >
      <h2 className="text-base font-semibold">Caja cerrada · {nombreEquipo}</h2>
      <dl className="divide-y text-sm">
        <div className={fila}>
          <dt>Efectivo esperado</dt>
          <dd className="font-medium tabular-nums" data-testid="cierre-esperado">
            {formatearBs(r.cierre.monto_esperado)}
          </dd>
        </div>
        <div className={fila}>
          <dt>Efectivo contado</dt>
          <dd className="font-medium tabular-nums">{formatearBs(r.contado)}</dd>
        </div>
        <div className={fila}>
          <dt>{estado}</dt>
          <dd
            className={`text-lg font-bold tabular-nums ${dif === 0 ? "" : "text-destructive"}`}
            data-testid="cierre-diferencia"
          >
            {formatearBs(dif)}
          </dd>
        </div>
        <div className={fila}>
          <dt>Cobrado por QR (neto)</dt>
          <dd className="font-medium tabular-nums" data-testid="cierre-qr">
            {formatearBs(r.cierre.total_qr)}
          </dd>
        </div>
      </dl>
      <Button type="button" className="h-11" onClick={alVolver}>
        Listo
      </Button>
    </section>
  );
}
