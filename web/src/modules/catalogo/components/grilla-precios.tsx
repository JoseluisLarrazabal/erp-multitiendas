"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guardarGrilla } from "../actions";
import { ID_PAGINA_SIGUIENTE, type FilaPrecios, type Lista } from "../domain";
import {
  borradorBase,
  cambiosDeFila,
  celdasInvalidas,
  mensajeDeGuardado,
  type Borrador,
} from "../grilla";
import { ERROR_CONEXION } from "@/lib/supabase/errores";
import { CabeceraGrilla } from "./cabecera-grilla";
import { FilaGrilla } from "./fila-grilla";
import { useAvisoSalir } from "./use-aviso-salir";
import { useTecladoGrilla } from "./use-teclado-grilla";

type Props = {
  negocioId: string;
  filas: readonly FilaPrecios[];
  listas: readonly Lista[];
  tipoCambio: number | null;
  verCostos: boolean;
  // Hay una búsqueda con resultados: el foco arranca en la primera celda.
  enfocarPrimera: boolean;
};

const AVISO_FIN = "Fin de la página: guarda para pasar a la siguiente";

export function GrillaPrecios({
  negocioId,
  filas,
  listas,
  tipoCambio,
  verCostos,
  enfocarPrimera,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  // Solo las filas tocadas. Una fila cuyo borrador ya coincide con lo guardado no cuenta como cambiada.
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const botonGuardar = useRef<HTMLButtonElement>(null);

  const borradorDe = (f: FilaPrecios) => borradores[f.id] ?? borradorBase(f, listas);
  const cambiosDe = (f: FilaPrecios) => cambiosDeFila(f, borradorDe(f), listas);
  const modificadas = filas.filter((f) => {
    const c = cambiosDe(f);
    return c.precios || c.costo;
  });
  const sucio = modificadas.length > 0;
  const enlaceSiguiente = () => document.getElementById(ID_PAGINA_SIGUIENTE);

  const { tabla, alTeclear, enfocarCelda } = useTecladoGrilla(() => {
    // Con cambios, guardar es lo siguiente; sin ellos el botón está deshabilitado y el foco pasa a "Siguiente".
    if (sucio) {
      botonGuardar.current?.focus();
      setAviso({ tipo: "ok", texto: AVISO_FIN });
    } else enlaceSiguiente()?.focus();
  }, enfocarPrimera);

  useAvisoSalir(sucio);

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

  function guardar() {
    const malas = modificadas.filter((f) => celdasInvalidas(f, borradorDe(f), listas).length > 0);
    if (malas.length) {
      setErrores(Object.fromEntries(malas.map((f) => [f.id, "Revisa los montos marcados."])));
      setAviso({ tipo: "error", texto: "Hay montos inválidos. No se guardó nada." });
      const primera = malas[0]!;
      return enfocarCelda(
        filas.indexOf(primera),
        celdasInvalidas(primera, borradorDe(primera), listas)[0],
      );
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
        const { guardadas, fallidas } = r.data;
        setErrores(Object.fromEntries(fallidas.map((x) => [x.productoId, x.error])));
        // Lo guardado se queda en borradores: coincide con lo nuevo y deja de contar como cambiado al refrescar.
        setAviso({
          tipo: fallidas.length ? "error" : "ok",
          texto: mensajeDeGuardado(
            guardadas,
            fallidas,
            carga.some((c) => c.precios),
          ),
        });
        router.refresh();
        const primera = filas.findIndex((f) => fallidas.some((x) => x.productoId === f.id));
        const campos = fallidas.find((x) => x.productoId === filas[primera]?.id)?.campos;
        if (primera >= 0) enfocarCelda(primera, campos?.includes("precios") ? listas[0] : "costo");
        // El botón queda deshabilitado: el foco pasa a "Siguiente" para seguir con la página que sigue.
        else (enlaceSiguiente() ?? tabla.current?.parentElement)?.focus();
      } catch {
        setAviso({ tipo: "error", texto: ERROR_CONEXION });
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="bg-background/95 sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b py-2 backdrop-blur">
        <Button
          ref={botonGuardar}
          onClick={guardar}
          disabled={!sucio || pendiente}
          className="h-10"
        >
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Guardar cambios
        </Button>
        <p className="text-sm tabular-nums" aria-live="polite">
          {sucio
            ? `${modificadas.length} ${modificadas.length === 1 ? "fila modificada" : "filas modificadas"}`
            : "Sin cambios"}
        </p>
        <p role="status" className="text-sm font-medium empty:hidden">
          {aviso?.tipo === "ok" ? aviso.texto : ""}
        </p>
        <p role="alert" className="text-destructive text-sm empty:hidden">
          {aviso?.tipo === "error" ? aviso.texto : ""}
        </p>
      </div>
      <p className="text-muted-foreground text-xs md:hidden">
        Desliza hacia la derecha para ver todas las listas
      </p>
      <div
        role="region"
        aria-label="Tabla de precios, desplazable"
        tabIndex={0}
        // scroll-pl = ancho de la columna fija: el foco que llega por scroll no queda tapado por ella.
        className="bg-card focus-visible:ring-ring/50 shadow-card scroll-pl-36 overflow-x-auto rounded-xl border outline-none focus-visible:ring-3 md:scroll-pl-48"
      >
        <table
          ref={tabla}
          onKeyDown={alTeclear}
          className="w-max min-w-full border-collapse text-sm"
        >
          <caption className="sr-only">Precios por lista. Enter pasa a la fila siguiente.</caption>
          <CabeceraGrilla listas={listas} verCostos={verCostos} />
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
