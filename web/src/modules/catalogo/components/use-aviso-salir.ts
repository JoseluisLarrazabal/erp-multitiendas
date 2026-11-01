import { useEffect } from "react";

const AVISO_SALIR = "Tienes cambios sin guardar. Si sales, se pierden.";

// Con cambios sin guardar, pide confirmar antes de salir: recarga o cierre (beforeunload) y enlaces internos
// (paginación, menú).
export function useAvisoSalir(sucio: boolean) {
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
}
