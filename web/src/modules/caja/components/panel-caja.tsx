"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { FilaCola } from "@/lib/offline/cola";
import { avisarRed, useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import {
  ETIQUETA_MOVIMIENTO,
  parsearMontoInicial,
  parsearMontoPositivo,
  type Movimiento,
  type TipoMovimiento,
} from "../domain";
import {
  encolarMovimiento,
  hayAperturaEnCola,
  movimientosDeSesion,
  textoMontoCola,
} from "../cola-caja";
import { cerrarSesion, listarMovimientos, registrarMovimiento } from "../queries";
import { movimientoSchema, type Cierre } from "../schemas";

const MENSAJE_COLA =
  "No se pudo guardar el movimiento en este equipo. Revisa el espacio y los permisos del navegador, o recarga la página.";
const AYUDA_ARQUEO = "Cuenta el efectivo del cajón. El sistema compara con lo esperado al cerrar.";

// Movimientos de caja (ingreso, gasto, retiro) y cierre con arqueo. Todo en el cliente, sin server actions.
// Los UUID viven en refs: reintentar tras un corte reenvía el mismo id; otro dato es otra operación.
export function PanelCaja({
  negocioId,
  dispositivoId,
  usuarioId,
  nombreEquipo,
  sesionId,
  filas,
  ventaPendiente,
  rechazadas,
  lecturaColaFallida,
  alEncolar,
  alCerrar,
  alYaCerrada,
  alVolver,
}: {
  negocioId: string;
  dispositivoId: string;
  usuarioId: string;
  nombreEquipo: string;
  sesionId: string | null;
  // Contenido de la cola (la suscripción es la del POS).
  filas: readonly FilaCola[];
  ventaPendiente: boolean;
  // Ventas y movimientos rechazados de este equipo (de esta caja y de anteriores): no bloquean el cierre, se avisan (M-11).
  rechazadas: { cantidad: number; totalVentas: number; anteriores: number };
  // No se pudo leer la cola de ventas de este equipo: no se sabe si hay algo sin enviar.
  lecturaColaFallida: boolean;
  // Tras encolar un movimiento: el motor lo envía sin esperar el temporizador.
  alEncolar: () => void;
  // El servidor confirmó el cierre: el POS pasa a pedir la apertura.
  alCerrar: () => void;
  // ERP_CAJA_CERRADA al cerrar: la caja ya estaba cerrada. El POS la vuelve a consultar; devuelve un error o null.
  alYaCerrada: () => Promise<string | null>;
  alVolver: () => void;
}) {
  const sinRed = useSinRed();
  // Movimientos hechos sin conexión que aún no llegaron: se ven aunque la lista del servidor no esté.
  const enCola = useMemo(
    () => (sesionId ? movimientosDeSesion(filas, sesionId) : []),
    [filas, sesionId],
  );
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
    if (!sesionId || sinRed) return;
    let cancelado = false;
    listarMovimientos(createClient(), sesionId).then((r) => {
      if (cancelado) return;
      if (r.ok) {
        setMovimientos(r.data.movimientos);
        setTotalMovimientos(r.data.total);
        setErrorLista(null);
      } else {
        if (r.red) avisarRed(false);
        setErrorLista(r.error);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [sesionId, version, sinRed, enCola.length]);

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
    const id = intentoMov.current.id;
    // Con la apertura de esta caja aún en la cola el servidor no la conoce: el movimiento va por la cola.
    let enviadoSinRed = sinRed || (await hayAperturaEnCola(dispositivoId));
    if (!enviadoSinRed) {
      const r = await registrarMovimiento(createClient(), { id, sesionId, ...v.data });
      if (!r.ok) {
        if (!r.red) {
          setRegistrando(false);
          return setErrorMov(r.error);
        }
        avisarRed(false);
        enviadoSinRed = true;
      } else avisarRed(true);
    }
    if (enviadoSinRed) {
      try {
        await encolarMovimiento({
          negocioId,
          dispositivoId,
          usuarioId,
          id,
          sesion_id: sesionId,
          ...v.data,
        });
      } catch {
        setRegistrando(false);
        return setErrorMov(MENSAJE_COLA);
      }
      alEncolar();
    }
    setRegistrando(false);
    intentoMov.current = null;
    setMonto("");
    setMotivo("");
    setAvisoMov(
      `${ETIQUETA_MOVIMIENTO[tipo]} ${enviadoSinRed ? "guardado sin conexión; se enviará al volver la red" : "registrado"}.`,
    );
    setVersion((n) => n + 1);
  }

  async function cerrar() {
    if (!sesionId || cerrando || sinRed) return;
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
    if (ventaPendiente || sinRed) return;
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
        <Button type="button" variant="outline" className="h-11" onClick={alVolver}>
          <ArrowLeft aria-hidden /> Volver a vender
        </Button>
        <h2 className="text-lg font-semibold">Caja · {nombreEquipo}</h2>
      </div>
      {!sesionId ? (
        <p
          role="alert"
          className="border-warning-line bg-warning-soft text-warning rounded-lg border p-3 text-[15px] font-medium"
        >
          Este equipo no tiene la caja abierta.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section
            aria-label="Movimientos"
            className="bg-card shadow-card flex flex-col gap-3 rounded-xl border p-4"
          >
            <h3 className="text-base font-semibold">Movimientos de caja</h3>
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
                    className="cifra h-11 text-right"
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
                  className="h-11"
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
              <Button type="submit" size="lg" className="self-start" disabled={registrando}>
                {registrando && <Loader2 className="animate-spin" aria-hidden />} Registrar
                movimiento
              </Button>
            </form>
            <p role="alert" className="text-destructive text-sm empty:hidden">
              {errorLista}
            </p>
            {sinRed && <p className="text-muted-foreground text-sm">Disponible con conexión.</p>}
            {enCola.length > 0 && (
              <ul aria-label="Movimientos sin enviar" className="divide-y text-sm">
                {enCola.map((m) => (
                  <li key={m.id} className="flex items-baseline gap-2 py-2">
                    <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
                      {formatearHora(m.creadaEn)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{ETIQUETA_MOVIMIENTO[m.tipo]}</span>
                      <span className="text-muted-foreground"> · {m.motivo} · sin enviar</span>
                    </span>
                    <span className="cifra">{textoMontoCola(m)}</span>
                  </li>
                ))}
              </ul>
            )}
            {sinRed ? null : movimientos.length === 0 ? (
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
                    <span className="cifra">
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {formatearBs(m.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {totalMovimientos > movimientos.length && (
              <p className="text-muted-foreground text-sm">
                Mostrando {movimientos.length} de {totalMovimientos} movimientos (los más
                recientes).
              </p>
            )}
          </section>

          <section
            aria-label="Cierre de caja"
            className="bg-card shadow-card flex flex-col gap-3 rounded-xl border p-4"
          >
            <h3 className="text-base font-semibold">Cerrar caja</h3>
            <p className="text-muted-foreground text-sm">{AYUDA_ARQUEO}</p>
            <form onSubmit={pedirCierre} className="flex flex-col gap-3" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cierre-contado">Efectivo contado (Bs)</Label>
                <Input
                  id="cierre-contado"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  className="cifra h-12 text-right text-xl md:text-xl"
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                />
              </div>
              {ventaPendiente && (
                <p role="alert" className="text-destructive text-sm font-medium">
                  {lecturaColaFallida
                    ? "No se pudo leer la cola de ventas de este equipo, así que no se sabe si hay ventas sin enviar. Recarga la página antes de cerrar la caja."
                    : "Hay operaciones sin enviar, una apertura de caja rechazada o cobros sin confirmar en este equipo. Resuélvelos antes de cerrar la caja."}
                </p>
              )}
              {rechazadas.cantidad > 0 && (
                <p
                  role="status"
                  className="border-warning-line bg-warning-soft text-warning rounded-lg border p-3 text-sm font-medium"
                >
                  {`Hay ${rechazadas.cantidad} ${rechazadas.cantidad === 1 ? "operación rechazada" : "operaciones rechazadas"} sin resolver${rechazadas.totalVentas > 0 ? ` (ventas por ${formatearBs(rechazadas.totalVentas)})` : ""}. El esperado no las cuenta. Avisa a un encargado para que las reintente o las descarte.`}
                </p>
              )}
              {rechazadas.anteriores > 0 && (
                <p
                  role="status"
                  className="border-warning-line bg-warning-soft text-warning rounded-lg border p-3 text-sm font-medium"
                >
                  {`Además hay ${rechazadas.anteriores} ${rechazadas.anteriores === 1 ? "operación rechazada" : "operaciones rechazadas"} de cajas anteriores sin resolver en este equipo.`}
                </p>
              )}
              {sinRed && (
                <p role="status" className="text-muted-foreground text-sm">
                  Cerrar la caja necesita conexión.
                </p>
              )}
              <p role="alert" className="text-destructive text-sm empty:hidden">
                {errorCierre}
              </p>
              <Button
                type="submit"
                size="xl"
                className="self-start"
                disabled={ventaPendiente || cerrando || sinRed}
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
      className="bg-card shadow-card mx-auto flex w-full max-w-md flex-col gap-3 rounded-xl border p-5"
    >
      <h2 className="text-lg font-semibold">Caja cerrada · {nombreEquipo}</h2>
      <dl className="divide-y text-sm">
        <div className={fila}>
          <dt>Efectivo esperado</dt>
          <dd className="cifra" data-testid="cierre-esperado">
            {formatearBs(r.cierre.monto_esperado)}
          </dd>
        </div>
        <div className={fila}>
          <dt>Efectivo contado</dt>
          <dd className="cifra">{formatearBs(r.contado)}</dd>
        </div>
        <div className={fila}>
          <dt>{estado}</dt>
          <dd
            className={`cifra text-xl ${dif === 0 ? "" : "text-destructive"}`}
            data-testid="cierre-diferencia"
          >
            {formatearBs(dif)}
          </dd>
        </div>
        <div className={fila}>
          <dt>Cobrado por QR (neto)</dt>
          <dd className="cifra" data-testid="cierre-qr">
            {formatearBs(r.cierre.total_qr)}
          </dd>
        </div>
      </dl>
      <Button type="button" size="xl" onClick={alVolver}>
        Listo
      </Button>
    </section>
  );
}
