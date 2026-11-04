"use client";

import { useEffect, useState } from "react";
import { formatearBs } from "@/lib/format/moneda";
import { formatearHora } from "@/lib/format/fecha";
import { estaDesactualizado, PARALELO_URL } from "../dolar-paralelo";

const CADA_MS = 5 * 60_000;

type Lectura = { valor: number; leidoEn: string } | null | undefined; // undefined = cargando

// Nunca lanza. Ante una falla (red, offline, 401, forma rara) conserva la última lectura buena; sin ninguna, null ("sin datos").
export function useDolarParalelo(): Lectura {
  const [lectura, setLectura] = useState<Lectura>(undefined);
  useEffect(() => {
    let vivo = true;
    const leer = () =>
      fetch("/api/dolar-paralelo")
        .then((r) => r.json())
        .then((j) => {
          const ok = j?.disponible === true && typeof j.valor === "number" && j.leidoEn;
          if (vivo)
            setLectura((prev) =>
              ok ? { valor: j.valor, leidoEn: String(j.leidoEn) } : (prev ?? null),
            );
        })
        .catch(() => vivo && setLectura((prev) => prev ?? null));
    void leer();
    const id = setInterval(() => {
      if (document.hidden) return;
      void leer();
    }, CADA_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);
  return lectura;
}

export function DolarParalelo() {
  const l = useDolarParalelo();
  return (
    <p className="text-muted-foreground text-xs whitespace-nowrap print:hidden">
      {l === undefined ? (
        "Paralelo…"
      ) : l === null ? (
        "Paralelo: sin datos"
      ) : (
        <>
          <span className="text-foreground font-medium tabular-nums">
            Paralelo {formatearBs(l.valor)}
          </span>
          <span className="max-sm:hidden">
            {" · "}
            {formatearHora(l.leidoEn)}
            {estaDesactualizado(l.leidoEn) && " (desactualizado)"}
          </span>
        </>
      )}
      {" · "}
      <a
        href={PARALELO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-visible:ring-ring underline outline-none focus-visible:ring-2"
      >
        paralelo.bo
      </a>
    </p>
  );
}
