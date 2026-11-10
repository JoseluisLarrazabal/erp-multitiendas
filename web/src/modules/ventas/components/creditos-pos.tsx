"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearDia } from "@/lib/format/fecha";
import { formatearBs } from "@/lib/format/moneda";
import { useSinRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import { SelectorCliente, type ClienteElegido } from "@/modules/clientes";
import { cargarCuentas, existePagoCuota, pagoCuotaSchema, type Cuenta } from "@/modules/creditos";
import {
  alcanceCuotas,
  cobrarCuota,
  cuotaSinConfirmar,
  cuotasSinConfirmar,
  esCuotaRepetida,
  fijarCuotaSinConfirmar,
  MENSAJE_CUOTA_REPETIDA,
  MENSAJE_CUOTA_SIN_CONFIRMAR,
  MENSAJE_OTRA_CUOTA,
  puedeDescartarCuota,
  PRUEBAN_NO_REGISTRADO,
  type CuotaPendiente,
} from "../cobro-cuota";
import { aCentavos, bs, parsearMonto, textoMonto } from "../domain";
import { MENSAJE_EN_VUELO, MENSAJE_NO_GUARDADO, type EstadoEnvio } from "../use-envio";
import { Cobro } from "./cobro";

// Crédito en cobro: el de la lista o, tras recargar con un cobro sin confirmar, solo lo que se guardó de él.
type Elegida = { creditoId: string; clienteNombre: string; etiqueta: string; saldo: number | null };

// Modo "Cuotas" del POS (RF-CRE-04): busca al cliente, lista sus créditos con saldo y cobra una cuota por la caja abierta.
// Necesita conexión: lee y cobra directo contra el servidor, nunca por la cola offline.
export function CreditosPos({
  negocioId,
  equipoId,
  cajaId,
  alCambiarPendientes,
  alCajaCerrada,
}: {
  negocioId: string;
  equipoId: string;
  cajaId: string | null;
  // Avisa al POS si queda alguna cuota sin confirmar (bloquea cambiar de equipo y cerrar la caja).
  alCambiarPendientes: (hay: boolean) => void;
  // La base dice que la caja está cerrada: el POS la vuelve a comprobar (igual que al cobrar una venta).
  alCajaCerrada: () => Promise<void>;
}) {
  const sinRed = useSinRed();
  // Cobros sin confirmar de este equipo (localStorage, también tras recargar): se leen una vez y el estado se
  // actualiza junto con el almacenamiento.
  const alcance = alcanceCuotas(negocioId, equipoId);
  const [pendientes, setPendientes] = useState(() => cuotasSinConfirmar(alcance));
  // `idBorrar`: el id que esta pestaña cree tener al quitar la entrada (si lo guardado es otro, no se toca).
  function fijar(creditoId: string, p: CuotaPendiente | null, idBorrar?: string) {
    const guardado = fijarCuotaSinConfirmar(alcance, creditoId, p, idBorrar);
    const todas = cuotasSinConfirmar(alcance);
    setPendientes(todas);
    alCambiarPendientes(todas.length > 0);
    return guardado;
  }
  // Otra pestaña del mismo equipo escribe en la misma clave: la memoria vuelve a reflejar lo que hay guardado.
  const alCambiarRef = useRef(alCambiarPendientes);
  useEffect(() => {
    alCambiarRef.current = alCambiarPendientes;
  });
  useEffect(() => {
    const f = (e: StorageEvent) => {
      if (e.key !== alcance && e.key !== null) return;
      const todas = cuotasSinConfirmar(alcance);
      setPendientes(todas);
      alCambiarRef.current(todas.length > 0);
    };
    window.addEventListener("storage", f);
    return () => window.removeEventListener("storage", f);
  }, [alcance]);
  const pendienteDe = (creditoId: string) =>
    pendientes.find((p) => p.payload.credito_id === creditoId);
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [elegida, setElegida] = useState<Elegida | null>(null);
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
      const r = await cargarCuentas(createClient(), negocioId, { clienteId: c.id });
      if (r.ok) setCuentas(r.data.cuentas);
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

  // Mientras se envía, el pendiente guardado de antemano no es un fallo: solo se presenta como "sin confirmar" si el envío no cierra.
  const enviando = estado.t === "enviando";
  const sin = elegida && !enviando ? pendienteDe(elegida.creditoId) : undefined;
  const sinConfirmar = enviando
    ? pendientes.filter((p) => p.payload.credito_id !== elegida?.creditoId)
    : pendientes;
  const congelado = sin
    ? { efectivo: aCentavos(sin.payload.efectivo), qr: aCentavos(sin.payload.qr) }
    : undefined;
  const cerrarCobro = () => {
    setElegida(null);
    setMonto(null);
    setEstado({ t: "libre" });
  };

  function abrir(c: Cuenta) {
    setAviso(null);
    setEstado({ t: "libre" });
    setElegida({
      creditoId: c.creditoId,
      clienteNombre: c.clienteNombre,
      etiqueta: c.ventaNumero ? `venta ${c.ventaNumero}` : "saldo inicial",
      saldo: c.saldo,
    });
    const previo = pendienteDe(c.creditoId);
    if (previo) {
      setMonto(aCentavos(previo.payload.efectivo + previo.payload.qr));
      return;
    }
    setMonto(null);
    setMontoTexto(textoMonto(aCentavos(Math.min(c.proximoMonto || c.saldo, c.saldo))));
  }

  async function confirmar(c: { efectivo: number; qr: number }) {
    if (!elegida || !cajaId || estado.t === "enviando" || estado.t === "verificando") return;
    const creditoId = elegida.creditoId;
    const previo = pendienteDe(creditoId);
    const armado = pagoCuotaSchema.safeParse(
      previo?.payload ?? {
        id:
          (intento.current?.clave === creditoId ? intento.current.id : null) ?? crypto.randomUUID(),
        credito_id: creditoId,
        dispositivo_id: equipoId,
        caja_sesion_id: cajaId,
        efectivo: c.efectivo / 100,
        qr: c.qr / 100,
      },
    );
    if (!armado.success)
      return setEstado({
        t: "rechazada",
        mensaje: "No se pudo armar el cobro. Revisa los montos.",
      });
    const payload = armado.data;
    intento.current = { id: payload.id, clave: creditoId };
    // Antes de enviar el cobro queda en este equipo: si la app muere a mitad del envío, reaparece para verificarlo.
    const entrada = () => ({
      payload,
      cliente: elegida.clienteNombre,
      detalle: elegida.etiqueta,
      guardadoEn: new Date().toISOString(),
    });
    if (!fijar(creditoId, entrada())) {
      // Distinguir un fallo de escritura de otra cuota (otro id) ya guardada para este crédito por otra pestaña.
      const enAlmacen = cuotaSinConfirmar(alcance, creditoId);
      if (enAlmacen && enAlmacen.payload.id !== payload.id)
        return setEstado({ t: "rechazada", mensaje: MENSAJE_OTRA_CUOTA });
      return setEstado({ t: "rechazada", mensaje: MENSAJE_NO_GUARDADO });
    }
    setEstado({ t: "enviando" });
    const s = await cobrarCuota(createClient(), payload, {
      alVerificar: () => setEstado({ t: "verificando" }),
    });
    if (s.t === "sin-confirmar") {
      // El último envío fue ahora: desde aquí cuenta la espera antes de poder descartar.
      fijar(creditoId, entrada());
      return setEstado({ t: "rechazada", mensaje: MENSAJE_CUOTA_SIN_CONFIRMAR });
    }
    if (s.t === "rechazada" && esCuotaRepetida(s.codigo)) {
      // Un intento anterior con este id SÍ se registró (con otro monto): se trata como cobrado.
      fijar(creditoId, null, payload.id);
      intento.current = null;
      cerrarCobro();
      setAviso(MENSAJE_CUOTA_REPETIDA);
      void cargar(cliente);
      return;
    }
    if (s.t === "rechazada") {
      // Un permiso u otro rechazo no dicen qué pasó con un intento anterior: la entrada pendiente solo sale por la verificación o
      // por un ERP que prueba que no se registró. Sin entrada previa no hay nada que conservar.
      if (!previo || (s.codigo && PRUEBAN_NO_REGISTRADO.includes(s.codigo))) {
        fijar(creditoId, null, payload.id);
        intento.current = null; // el servidor no guardó nada: el próximo intento estrena id
      }
      setEstado({ t: "rechazada", mensaje: s.error });
      // Caja cerrada: el POS vuelve a comprobar la sesión del equipo, como al cobrar una venta.
      if (s.codigo === "ERP_CAJA_CERRADA") {
        cerrarCobro();
        await alCajaCerrada();
      }
      return;
    }
    fijar(creditoId, null, payload.id);
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
    const r = await existePagoCuota(createClient(), sin.payload.id);
    if (!r.ok)
      return setEstado({
        t: "rechazada",
        mensaje: `No se pudo verificar (${r.error}). No des el recibo por válido; intenta de nuevo.`,
      });
    // Sin rastro en el servidor pero recién enviado: su transacción aún puede estar en vuelo. No se descarta.
    if (!r.data && !puedeDescartarCuota(sin))
      return setEstado({ t: "rechazada", mensaje: MENSAJE_EN_VUELO });
    fijar(elegida.creditoId, null, sin.payload.id);
    intento.current = null;
    const nombre = elegida.clienteNombre;
    cerrarCobro();
    setAviso(
      r.data
        ? `El cobro de ${bs(aCentavos(sin.payload.efectivo + sin.payload.qr))} a ${nombre} sí quedó registrado.`
        : "No se registró: la cuota no se cobró. Puedes cobrar de nuevo.",
    );
    void cargar(cliente);
  }

  const saldoMax = elegida?.saldo != null ? aCentavos(elegida.saldo) : 0;
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
      {sinConfirmar.length > 0 && (
        <ul
          aria-label="Cobros sin confirmar"
          className="border-destructive divide-border bg-card divide-y rounded-xl border"
        >
          {sinConfirmar.map((p) => (
            <li
              key={p.payload.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 basis-56">
                Cobro sin confirmar de {bs(aCentavos(p.payload.efectivo + p.payload.qr))} a{" "}
                <span className="font-medium">{p.cliente}</span> ({p.detalle}): no des el recibo por
                válido hasta saber qué pasó.
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={!cajaId}
                onClick={() => {
                  setAviso(null);
                  setEstado({ t: "libre" });
                  setElegida({
                    creditoId: p.payload.credito_id,
                    clienteNombre: p.cliente,
                    etiqueta: p.detalle,
                    saldo: null,
                  });
                  setMonto(aCentavos(p.payload.efectivo + p.payload.qr));
                }}
              >
                Reintentar o verificar
              </Button>
            </li>
          ))}
        </ul>
      )}
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
                  ` · próxima cuota ${formatearBs(c.proximoMonto)} (${formatearDia(c.proximaVence)})`}
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
                {elegida.clienteNombre} · saldo {formatearBs(elegida.saldo ?? 0)}
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
                    ? `Escribe un monto mayor a 0 y hasta el saldo (${formatearBs(elegida.saldo ?? 0)}).`
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
          detalle={`${elegida.clienteNombre} · ${elegida.etiqueta}${elegida.saldo !== null ? ` · saldo ${formatearBs(elegida.saldo)}` : ""}.`}
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
