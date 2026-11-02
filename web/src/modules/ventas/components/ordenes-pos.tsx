"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
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
import { MENSAJE_RED } from "@/lib/erp-errores";
import { formatearBs } from "@/lib/format/moneda";
import { useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import type { Resultado } from "@/modules/usuarios";
import { hoyLaPaz } from "../orden";
import {
  errorRetiro,
  estaAtrasada,
  ETIQUETA_ESTADO,
  fechaCorta,
  filtrarOrdenes,
  mensajeAnulacion,
  PASOS,
} from "../ordenes-pos";
import {
  anularOrden,
  cambiarEstadoOrden,
  cargarOrdenesActivas,
  entregarOrden,
  type EstadoActivo,
  type OrdenActiva,
  type Retiro,
} from "../queries-ordenes";

type Dialogo = { tipo: "entregar" | "anular"; orden: OrdenActiva };

// Pestaña "Órdenes" del POS de lavandería: las órdenes activas del negocio, con sus estados, la entrega y la anulación.
// Necesita conexión: lee y escribe directo contra el servidor.
export function OrdenesPos({
  negocioId,
  permisos,
}: {
  negocioId: string;
  permisos: readonly string[];
}) {
  const sinRed = useSinRed();
  const [ordenes, setOrdenes] = useState<OrdenActiva[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const puedeEstado = permisos.includes("cambiar_estado_orden");
  const puedeAnular = permisos.includes("anular");

  const aplicar = useCallback((r: Awaited<ReturnType<typeof cargarOrdenesActivas>>) => {
    if (r.ok) {
      setOrdenes(r.data);
      setError(null);
    } else setError(r.error);
  }, []);
  const cargar = useCallback(
    async () => aplicar(await cargarOrdenesActivas(createClient(), negocioId)),
    [aplicar, negocioId],
  );
  useEffect(() => {
    if (sinRed) return;
    let cancelado = false;
    void cargarOrdenesActivas(createClient(), negocioId).then((r) => !cancelado && aplicar(r));
    return () => {
      cancelado = true;
    };
  }, [sinRed, negocioId, aplicar]);

  const visibles = useMemo(() => filtrarOrdenes(ordenes ?? [], busqueda), [ordenes, busqueda]);
  const hoy = hoyLaPaz();

  // La fila o el botón pulsado puede desaparecer al recargar: el foco pasa a la búsqueda.
  const enfocarBusqueda = () =>
    setTimeout(() => document.getElementById("buscar-orden")?.focus(), 0);

  async function cambiar(o: OrdenActiva, estado: EstadoActivo) {
    setOcupada(o.id);
    setAviso(null);
    const r = await cambiarEstadoOrden(createClient(), o.id, estado);
    setOcupada(null);
    // Recargar antes: la carga limpia el error.
    await cargar();
    if (r.ok) {
      setAviso(`Orden ${o.numero}: ${ETIQUETA_ESTADO[estado]}.`);
      enfocarBusqueda();
    } else setError(r.error);
  }

  if (sinRed)
    return (
      <p role="status" className="bg-secondary rounded-lg p-3 text-sm">
        Las órdenes necesitan conexión.
      </p>
    );

  return (
    <section aria-label="Órdenes activas" className="flex flex-col gap-3">
      <div className="relative max-w-md">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id="buscar-orden"
          type="search"
          name="busqueda"
          enterKeyHint="search"
          aria-label="Buscar orden"
          placeholder="Número o cliente"
          className="h-10 pl-8"
          autoComplete="off"
          spellCheck={false}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      <div role="status" className="flex flex-col gap-3 empty:hidden">
        {aviso && <p className="bg-secondary rounded-lg p-3 text-sm font-medium">{aviso}</p>}
        {ordenes === null && !error && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando órdenes…
          </p>
        )}
        {ordenes !== null && visibles.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {busqueda.trim() ? "Ninguna orden coincide." : "No hay órdenes activas."}
          </p>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="border-destructive text-destructive flex items-center gap-3 rounded-lg border p-3 text-sm"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" className="h-10" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}
      <ul
        aria-label="Órdenes"
        className="divide-border bg-card divide-y rounded-xl border empty:hidden"
      >
        {visibles.map((o) => {
          const pasos = PASOS[o.estado];
          const atrasada = estaAtrasada(o, hoy);
          return (
            <li
              key={o.id}
              aria-label={`Orden ${o.numero}`}
              aria-busy={ocupada === o.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-semibold tabular-nums">
                  {o.numero}
                  {o.express && (
                    <span className="bg-primary text-primary-foreground ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
                      Express
                    </span>
                  )}
                </p>
                <p className="truncate text-sm">{o.cliente}</p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {o.prendas} {o.prendas === 1 ? "prenda" : "prendas"}
                  {o.casillero && ` · Casillero ${o.casillero}`} · {formatearBs(o.total)}
                </p>
              </div>
              <div className="text-sm tabular-nums">
                <p className="font-medium">{ETIQUETA_ESTADO[o.estado]}</p>
                <p className={atrasada ? "text-destructive font-medium" : "text-muted-foreground"}>
                  Prometida {fechaCorta(o.fechaPrometida)}
                  {atrasada && " · atrasada"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {puedeEstado && pasos.anterior && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={ocupada !== null}
                    aria-label={`Volver a ${ETIQUETA_ESTADO[pasos.anterior]} ${o.numero}`}
                    onClick={() => void cambiar(o, pasos.anterior!)}
                  >
                    Volver a {ETIQUETA_ESTADO[pasos.anterior]}
                  </Button>
                )}
                {puedeEstado && pasos.siguiente && (
                  <Button
                    type="button"
                    className="h-10"
                    disabled={ocupada !== null}
                    aria-label={`Pasar a ${ETIQUETA_ESTADO[pasos.siguiente]} ${o.numero}`}
                    onClick={() => void cambiar(o, pasos.siguiente!)}
                  >
                    Pasar a {ETIQUETA_ESTADO[pasos.siguiente]}
                  </Button>
                )}
                {puedeEstado && pasos.entregar && (
                  <Button
                    type="button"
                    className="h-10"
                    disabled={ocupada !== null}
                    aria-label={`Entregar ${o.numero}`}
                    onClick={() => setDialogo({ tipo: "entregar", orden: o })}
                  >
                    Entregar
                  </Button>
                )}
                {puedeAnular && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive h-10"
                    disabled={ocupada !== null}
                    aria-label={`Anular ${o.numero}`}
                    onClick={() => setDialogo({ tipo: "anular", orden: o })}
                  >
                    Anular
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {dialogo?.tipo === "entregar" && (
        <DialogoEntrega
          orden={dialogo.orden}
          alCerrar={() => setDialogo(null)}
          alExito={() => {
            setAviso(`Orden ${dialogo.orden.numero} entregada.`);
            enfocarBusqueda();
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === "anular" && (
        <DialogoAnulacion
          orden={dialogo.orden}
          alCerrar={() => setDialogo(null)}
          alExito={(reembolso) => {
            setAviso(`Orden ${dialogo.orden.numero} anulada. ${mensajeAnulacion(reembolso)}`);
            enfocarBusqueda();
            void cargar();
          }}
        />
      )}
    </section>
  );
}

// Diálogo con formulario: el error de la acción queda dentro y el diálogo sigue abierto.
function DialogoOrden({
  titulo,
  descripcion,
  confirmar,
  destructiva,
  validar,
  enviar,
  alCerrar,
  children,
}: {
  titulo: string;
  descripcion: string;
  confirmar: string;
  destructiva?: boolean;
  validar: () => { campo: string; mensaje: string } | null;
  enviar: () => Promise<Resultado<unknown>>;
  alCerrar: () => void;
  children: (campoInvalido: string | null, errorId: string) => React.ReactNode;
}) {
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | null>(null);
  const errorId = useId();

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (pendiente) return;
    const invalido = validar();
    if (invalido) {
      setError(invalido.mensaje);
      setCampo(invalido.campo);
      const form = e.currentTarget as HTMLFormElement;
      return void setTimeout(
        () => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        0,
      );
    }
    setPendiente(true);
    setError(null);
    setCampo(null);
    try {
      const r = await enviar();
      if (r.ok) return alCerrar();
      setError(r.error);
    } catch {
      setError(MENSAJE_RED);
    }
    setPendiente(false);
  }

  return (
    <AlertDialog open onOpenChange={(abierto) => !abierto && !pendiente && alCerrar()}>
      <AlertDialogContent>
        <form onSubmit={(e) => void alEnviar(e)} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{titulo}</AlertDialogTitle>
            <AlertDialogDescription>{descripcion}</AlertDialogDescription>
          </AlertDialogHeader>
          {children(campo, errorId)}
          <p id={errorId} role="alert" className="text-destructive min-h-5 text-sm">
            {error}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              variant={destructiva ? "destructive" : "default"}
              disabled={pendiente}
            >
              {pendiente && <Loader2 className="animate-spin" aria-hidden />}
              {confirmar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DialogoEntrega({
  orden,
  alCerrar,
  alExito,
}: {
  orden: OrdenActiva;
  alCerrar: () => void;
  alExito: () => void;
}) {
  const [retiro, setRetiro] = useState<Retiro>({ quien: "", con: "boleta", documento: "" });
  return (
    <DialogoOrden
      titulo={`Entregar ${orden.numero}`}
      descripcion={`${orden.cliente} · ${orden.prendas} ${orden.prendas === 1 ? "prenda" : "prendas"}. Anota quién retira.`}
      confirmar="Entregar"
      validar={() => {
        const mensaje = errorRetiro(retiro);
        return mensaje
          ? { mensaje, campo: retiro.quien.trim() === "" ? "quien" : "documento" }
          : null;
      }}
      enviar={async () => {
        const r = await entregarOrden(createClient(), orden.id, {
          ...retiro,
          quien: retiro.quien.trim(),
          documento: retiro.documento.trim(),
        });
        if (r.ok) alExito();
        return r;
      }}
      alCerrar={alCerrar}
    >
      {(campoInvalido, errorId) => (
        <>
          <Label className="flex-col items-stretch gap-1">
            Quién retira
            <Input
              className="h-10"
              name="quien"
              autoComplete="off"
              maxLength={120}
              autoFocus
              aria-invalid={campoInvalido === "quien"}
              aria-describedby={campoInvalido === "quien" ? errorId : undefined}
              value={retiro.quien}
              onChange={(e) => setRetiro({ ...retiro, quien: e.target.value })}
            />
          </Label>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 font-medium">Documento de retiro</legend>
            {(["boleta", "carnet"] as const).map((c) => (
              <Label key={c} className="min-h-10 font-normal">
                <input
                  type="radio"
                  name="retiro-con"
                  className="size-4"
                  checked={retiro.con === c}
                  onChange={() => setRetiro({ ...retiro, con: c })}
                />
                {c === "boleta" ? "Con boleta" : "Con carnet"}
              </Label>
            ))}
          </fieldset>
          {retiro.con === "carnet" && (
            <Label className="flex-col items-stretch gap-1">
              Documento
              <Input
                className="h-10"
                name="documento"
                autoComplete="off"
                maxLength={30}
                aria-invalid={campoInvalido === "documento"}
                aria-describedby={campoInvalido === "documento" ? errorId : undefined}
                value={retiro.documento}
                onChange={(e) => setRetiro({ ...retiro, documento: e.target.value })}
              />
            </Label>
          )}
        </>
      )}
    </DialogoOrden>
  );
}

function DialogoAnulacion({
  orden,
  alCerrar,
  alExito,
}: {
  orden: OrdenActiva;
  alCerrar: () => void;
  alExito: (reembolso: boolean) => void;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <DialogoOrden
      titulo={`¿Anular la orden ${orden.numero}?`}
      descripcion="La orden se cancela. Si su caja sigue abierta, el efectivo vuelve a ella. No se puede deshacer."
      confirmar="Anular orden"
      destructiva
      validar={() =>
        motivo.trim() === ""
          ? { campo: "motivo", mensaje: "Escribe el motivo de la anulación." }
          : null
      }
      enviar={async () => {
        const r = await anularOrden(createClient(), orden.id, motivo.trim());
        if (r.ok) alExito(r.data.reembolso);
        return r;
      }}
      alCerrar={alCerrar}
    >
      {(campoInvalido, errorId) => (
        <Label className="flex-col items-stretch gap-1">
          Motivo
          <Input
            className="h-10"
            name="motivo"
            autoComplete="off"
            maxLength={200}
            autoFocus
            aria-invalid={campoInvalido === "motivo"}
            aria-describedby={campoInvalido === "motivo" ? errorId : undefined}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Label>
      )}
    </DialogoOrden>
  );
}
