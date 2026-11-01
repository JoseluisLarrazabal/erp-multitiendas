"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guardarGrilla } from "../actions";
import { ETIQUETA_LISTA, type FilaPrecios, type Lista } from "../domain";
import { borradorBase, cambiosDeFila, celdasInvalidas, type Borrador } from "../grilla";
import { ERROR_CONEXION } from "@/lib/supabase/errores";
import { FilaGrilla } from "./fila-grilla";

type Props = {
  negocioId: string;
  filas: readonly FilaPrecios[];
  listas: readonly Lista[];
  tipoCambio: number | null;
  verCostos: boolean;
};

const AVISO_SALIR = "Tienes cambios sin guardar. Si sales, se pierden.";

export function GrillaPrecios({ negocioId, filas, listas, tipoCambio, verCostos }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  // Solo las filas tocadas. Una fila cuyo borrador ya coincide con lo guardado no cuenta como cambiada.
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const tabla = useRef<HTMLTableElement>(null);

  const borradorDe = (f: FilaPrecios) => borradores[f.id] ?? borradorBase(f, listas);
  const cambiosDe = (f: FilaPrecios) => cambiosDeFila(f, borradorDe(f), listas);
  const modificadas = filas.filter((f) => {
    const c = cambiosDe(f);
    return c.precios || c.costo;
  });
  const sucio = modificadas.length > 0;

  // Salir con cambios sin guardar: recarga o cierre (beforeunload) y enlaces internos (paginación, menú).
  useEffect(() => {
    if (!sucio) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    const alEnlace = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank") return;
      if (!window.confirm(AVISO_SALIR)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", alSalir);
    document.addEventListener("click", alEnlace, true);
    return () => {
      window.removeEventListener("beforeunload", alSalir);
      document.removeEventListener("click", alEnlace, true);
    };
  }, [sucio]);

  function cambiar(f: FilaPrecios, cambio: Partial<Borrador> & { lista?: string; texto?: string }) {
    const actual = borradorDe(f);
    const siguiente: Borrador = {
      moneda: cambio.moneda ?? actual.moneda,
      costo: cambio.costo ?? actual.costo,
      precios: cambio.lista
        ? { ...actual.precios, [cambio.lista]: cambio.texto ?? "" }
        : actual.precios,
    };
    setBorradores((b) => ({ ...b, [f.id]: siguiente }));
    setErrores((e) => {
      const resto = { ...e };
      delete resto[f.id];
      return resto;
    });
    setAviso(null);
  }

  // Enter baja a la fila siguiente en la misma columna (como una hoja de cálculo).
  function alTeclear(e: KeyboardEvent<HTMLTableElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== "Enter" || el.tagName !== "INPUT" || !el.dataset.celda) return;
    e.preventDefault();
    const siguiente = tabla.current?.querySelector<HTMLInputElement>(
      `[data-fila="${Number(el.dataset.fila) + 1}"][data-celda="${el.dataset.celda}"]:not(:disabled)`,
    );
    siguiente?.focus();
    siguiente?.select();
  }

  function guardar() {
    const malas = Object.fromEntries(
      modificadas
        .filter((f) => celdasInvalidas(borradorDe(f), listas).length > 0)
        .map((f) => [f.id, "Revisa los montos marcados."]),
    );
    if (Object.keys(malas).length) {
      setErrores(malas);
      return setAviso({ tipo: "error", texto: "Hay montos inválidos. No se guardó nada." });
    }
    const carga = modificadas.map((f) => {
      const b = borradorDe(f);
      const c = cambiosDe(f);
      return {
        productoId: f.id,
        // Todas las listas de la fila: la moneda es una sola, y así no queda ninguna en la moneda anterior.
        precios: c.precios
          ? {
              moneda: b.moneda,
              precios: Object.fromEntries(listas.map((l) => [l, b.precios[l] ?? ""])),
            }
          : null,
        costo: c.costo ? b.costo : null,
      };
    });
    setAviso(null);
    iniciar(async () => {
      try {
        const r = await guardarGrilla({ negocioId, filas: carga });
        if (!r.ok) return setAviso({ tipo: "error", texto: r.error });
        const fallidas = Object.fromEntries(r.data.fallidas.map((x) => [x.productoId, x.error]));
        setErrores(fallidas);
        // Las guardadas se quedan en borradores: coinciden con lo nuevo y dejan de contar como cambiadas al refrescar.
        setAviso(
          r.data.fallidas.length
            ? {
                tipo: "error",
                texto: `Se guardaron ${r.data.guardados} filas. ${r.data.fallidas.length} no se guardaron: están señaladas, con lo que escribiste.`,
              }
            : {
                tipo: "ok",
                texto: `Se guardaron ${r.data.guardados} ${r.data.guardados === 1 ? "fila" : "filas"}.`,
              },
        );
        router.refresh();
      } catch {
        setAviso({ tipo: "error", texto: ERROR_CONEXION });
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="bg-background/95 sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b py-2 backdrop-blur">
        <Button onClick={guardar} disabled={!sucio || pendiente} className="h-10">
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Guardar cambios
        </Button>
        <p className="text-sm tabular-nums" aria-live="polite">
          {sucio
            ? `${modificadas.length} ${modificadas.length === 1 ? "fila modificada" : "filas modificadas"}`
            : "Sin cambios"}
        </p>
        <p
          role={aviso?.tipo === "error" ? "alert" : "status"}
          className={aviso?.tipo === "error" ? "text-destructive text-sm" : "text-sm font-medium"}
        >
          {aviso?.texto}
        </p>
      </div>
      <div
        className="bg-card overflow-x-auto rounded-xl border shadow-[0_2px_5px_#34345a0d]"
        tabIndex={-1}
      >
        <table
          ref={tabla}
          onKeyDown={alTeclear}
          className="w-max min-w-full border-collapse text-sm"
        >
          <caption className="sr-only">Precios por lista. Enter pasa a la fila siguiente.</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs font-semibold">
              <th scope="col" className="bg-card sticky left-0 z-10 px-2 py-2.5">
                Producto
              </th>
              <th scope="col" className="px-2 py-2.5">
                Moneda
              </th>
              {listas.map((l) => (
                <th key={l} scope="col" className="px-2 py-2.5 text-right">
                  {ETIQUETA_LISTA[l]}
                </th>
              ))}
              {verCostos && (
                <th scope="col" className="px-2 py-2.5 text-right">
                  Costo (Bs)
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <FilaGrilla
                key={f.id}
                fila={f}
                indice={i}
                listas={listas}
                borrador={borradorDe(f)}
                cambios={cambiosDe(f)}
                error={errores[f.id]}
                tipoCambio={tipoCambio}
                verCostos={verCostos}
                alCambiar={(c) => cambiar(f, c)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
