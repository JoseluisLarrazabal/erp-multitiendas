"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Campo } from "@/components/panel/campo";
import { formatearBs } from "@/lib/format/moneda";
import { ERROR_CONEXION } from "@/lib/supabase/errores";
import { devolverVenta, type Devuelto } from "../actions";
import { aMilesimas, formatearCantidad } from "../domain";
import { cantidadADevolver } from "../domain-panel";
import type { ItemVenta } from "../lecturas-panel";

export type EquipoAbierto = { dispositivoId: string; nombre: string; sesionId: string };

// Devolución parcial o total. El UUID se genera una vez por intento: un doble envío con los mismos datos devuelve la
// misma devolución; cambiar cualquier dato es otro intento.
export function FormDevolucion({
  ventaId,
  items,
  equipos,
  aviso,
}: {
  ventaId: string;
  items: readonly ItemVenta[];
  equipos: readonly EquipoAbierto[];
  // Pasadas 24 h: texto de RN-08 (la RPC igual decide).
  aviso: string | null;
}) {
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [equipoId, setEquipoId] = useState(equipos[0]?.dispositivoId ?? "");
  const [medio, setMedio] = useState<"efectivo" | "qr">("efectivo");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<Devuelto | null>(null);
  const intento = useRef<{ clave: string; id: string } | null>(null);

  const equipo = equipos.find((e) => e.dispositivoId === equipoId) ?? equipos[0];
  const quedan = items.filter((i) => aMilesimas(i.cantidad) - aMilesimas(i.devuelta) > 0);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando || !equipo) return;
    setHecho(null);
    const nuevos: Record<string, string> = {};
    const lineas: { ventaItemId: string; cantidad: number }[] = [];
    for (const i of quedan) {
      const texto = (cantidades[i.id] ?? "").trim();
      if (texto === "") continue;
      const queda = aMilesimas(i.cantidad) - aMilesimas(i.devuelta);
      const c = cantidadADevolver(texto, i.unidad, queda);
      if (c === null)
        nuevos[i.id] =
          i.unidad === "kg"
            ? `Escribe hasta ${formatearCantidad(queda)} kg, con coma y 3 decimales como máximo.`
            : `Escribe un entero de 1 a ${formatearCantidad(queda)}.`;
      else lineas.push({ ventaItemId: i.id, cantidad: c });
    }
    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      return setGeneral(null);
    }
    setErrores({});
    if (lineas.length === 0)
      return setGeneral("Escribe la cantidad a devolver de al menos una línea.");
    if (motivo.trim() === "") return setGeneral("Escribe el motivo de la devolución.");
    setGeneral(null);

    const datos = {
      ventaId,
      dispositivoId: equipo.dispositivoId,
      cajaSesionId: equipo.sesionId,
      medio,
      motivo: motivo.trim(),
      items: lineas,
    };
    const clave = JSON.stringify(datos);
    if (intento.current?.clave !== clave) intento.current = { clave, id: crypto.randomUUID() };
    setEnviando(true);
    try {
      const r = await devolverVenta({ id: intento.current.id, ...datos });
      if (!r.ok) return setGeneral(r.error);
      intento.current = null;
      setHecho(r.data);
      setCantidades({});
      setMotivo("");
    } catch {
      setGeneral(ERROR_CONEXION);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate aria-label="Devolver venta" className="flex flex-col gap-4">
      {aviso && (
        <p role="note" className="bg-secondary rounded-lg p-3 text-sm">
          {aviso}
        </p>
      )}
      {quedan.length === 0 ? (
        <p className="text-muted-foreground text-sm">No queda nada por devolver en esta venta.</p>
      ) : (
        <ul aria-label="Líneas a devolver" className="divide-y rounded-lg border">
          {quedan.map((i) => {
            const queda = aMilesimas(i.cantidad) - aMilesimas(i.devuelta);
            const id = `dev-${i.id}`;
            return (
              <li key={i.id} className="grid grid-cols-[1fr_7rem] items-start gap-x-3 gap-y-1 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.nombre}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {i.codigo} · vendido {formatearCantidad(aMilesimas(i.cantidad))} · queda{" "}
                    {formatearCantidad(queda)}
                    {i.unidad === "kg" ? " kg" : ""}
                  </p>
                </div>
                <div>
                  <label htmlFor={id} className="sr-only">
                    Cantidad a devolver de {i.nombre}
                  </label>
                  <Input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    className="h-10 text-right tabular-nums"
                    value={cantidades[i.id] ?? ""}
                    aria-invalid={errores[i.id] ? true : undefined}
                    aria-describedby={errores[i.id] ? `${id}-error` : undefined}
                    onChange={(e) => setCantidades({ ...cantidades, [i.id]: e.target.value })}
                  />
                </div>
                {errores[i.id] && (
                  <p id={`${id}-error`} className="text-destructive col-span-2 text-xs">
                    {errores[i.id]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="dev-equipo"
          etiqueta="Caja que devuelve"
          ayuda="El efectivo sale de la caja abierta de este equipo."
        >
          <SelectNativo
            id="dev-equipo"
            value={equipo?.dispositivoId ?? ""}
            onChange={(e) => setEquipoId(e.target.value)}
          >
            {equipos.map((e) => (
              <option key={e.dispositivoId} value={e.dispositivoId}>
                {e.nombre}
              </option>
            ))}
          </SelectNativo>
        </Campo>
        <Campo
          id="dev-medio"
          etiqueta="Medio preferido"
          ayuda="El sistema reparte según lo cobrado en cada medio: lo pagado por QR vuelve por QR."
        >
          <SelectNativo
            id="dev-medio"
            value={medio}
            onChange={(e) => setMedio(e.target.value as "efectivo" | "qr")}
          >
            <option value="efectivo">Efectivo</option>
            <option value="qr">QR</option>
          </SelectNativo>
        </Campo>
      </div>
      <Campo id="dev-motivo" etiqueta="Motivo de la devolución">
        <Input
          id="dev-motivo"
          autoComplete="off"
          maxLength={200}
          className="h-10"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Campo>

      <p role="alert" className="text-destructive text-sm empty:hidden">
        {general}
      </p>
      <div role="status" className="text-sm font-medium empty:hidden">
        {hecho &&
          (Number.isNaN(hecho.monto)
            ? "Devolución registrada."
            : `Devolución registrada: ${formatearBs(hecho.monto)} en total, ${formatearBs(hecho.montoEfectivo)} en efectivo y ${formatearBs(Math.round((hecho.monto - hecho.montoEfectivo) * 100) / 100)} por QR.`)}
      </div>
      <Button type="submit" className="h-10 self-start" disabled={enviando || quedan.length === 0}>
        {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}{" "}
        Devolver
      </Button>
    </form>
  );
}
