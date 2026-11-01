import { useEffect, useRef, type KeyboardEvent } from "react";

// Navegación con teclado de la grilla de precios. Cada input lleva data-fila y data-celda (la lista o "costo").
// Enter baja a la siguiente fila con esa celda habilitada (como una hoja de cálculo); en la última llama a
// `alFinal`. Con `enfocarAlMontar` el foco arranca en la primera celda (escanear y escribir el precio), solo con
// puntero fino: en un móvil abriría el teclado sin que nadie lo pida.
export function useTecladoGrilla(alFinal: () => void, enfocarAlMontar: boolean) {
  const tabla = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (enfocarAlMontar && window.matchMedia("(pointer: fine)").matches)
      enfocar(tabla.current?.querySelector<HTMLInputElement>('[data-fila="0"]:not(:disabled)'));
  }, [enfocarAlMontar]);

  function alTeclear(e: KeyboardEvent<HTMLTableElement>) {
    const el = e.target as HTMLInputElement;
    if (e.key !== "Enter" || el.tagName !== "INPUT" || !el.dataset.celda) return;
    e.preventDefault();
    const columna = [
      ...(tabla.current?.querySelectorAll<HTMLInputElement>(
        `[data-celda="${el.dataset.celda}"]:not(:disabled)`,
      ) ?? []),
    ];
    const siguiente = columna[columna.indexOf(el) + 1];
    if (siguiente) enfocar(siguiente);
    else alFinal();
  }

  // Lleva el foco (y la vista) a una celda; sin `celda`, a la primera habilitada de la fila.
  function enfocarCelda(fila: number, celda?: string) {
    const selector = `[data-fila="${fila}"]${celda ? `[data-celda="${celda}"]` : ""}:not(:disabled)`;
    enfocar(tabla.current?.querySelector<HTMLInputElement>(selector));
  }

  return { tabla, alTeclear, enfocarCelda };
}

function enfocar(el: HTMLInputElement | null | undefined) {
  el?.focus();
  el?.select();
}
