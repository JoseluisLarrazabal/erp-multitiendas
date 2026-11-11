"use client";

import { useEffect } from "react";
import { registrarError } from "@/lib/registro-errores";

// Errores de JS fuera de React (listeners, promesas sin atrapar). No renderiza nada.
export function RegistroErroresGlobal() {
  useEffect(() => {
    const alError = (e: ErrorEvent) => {
      // Aviso inofensivo del navegador, no un fallo.
      if (e.message?.startsWith("ResizeObserver loop")) return;
      registrarError("js", null, e.message || "error de script");
    };
    const alRechazo = (e: PromiseRejectionEvent) => {
      if (e.reason?.name === "AbortError") return;
      registrarError("js", null, e.reason instanceof Error ? e.reason.message : String(e.reason));
    };
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, []);
  return null;
}
