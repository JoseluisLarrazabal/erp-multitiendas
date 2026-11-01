"use client";

import { useEffect } from "react";

// F2 abre el cobro y "/" lleva a la búsqueda. Con un diálogo abierto (`cobrando`) no hacen nada: el cobro y las
// confirmaciones son modales y no deben reaccionar a atajos de la pantalla de atrás.
export function useAtajos({
  cobrando,
  abrirCobro,
  campo,
}: {
  cobrando: boolean;
  abrirCobro: () => void;
  campo: React.RefObject<HTMLInputElement | null>;
}) {
  useEffect(() => {
    if (cobrando) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        abrirCobro();
      } else if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [cobrando, abrirCobro, campo]);
}
