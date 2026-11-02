"use client";

import { useEffect, useState } from "react";
import { avisarRed } from "@/lib/offline/red";
import { createClient } from "@/lib/supabase/browser";
import { guardarVendedorLocal, leerVendedorLocal } from "./contexto-ventas";
import { nombreVendedor } from "./queries";

// Nombre del vendedor para la nota. Sin red usa el último guardado; sin ninguno, "Vendedor".
export function useVendedor(usuarioId: string) {
  const [vendedor, setVendedor] = useState("Vendedor");
  useEffect(() => {
    let cancelado = false;
    let delServidor = false; // el nombre fresco manda: la lectura local no lo pisa si llega después
    void leerVendedorLocal(usuarioId).then(
      (n) => n && !cancelado && !delServidor && setVendedor(n),
    );
    nombreVendedor(createClient(), usuarioId).then((r) => {
      if (!r.ok) return r.red && avisarRed(false);
      if (!r.data || cancelado) return;
      delServidor = true;
      setVendedor(r.data);
      guardarVendedorLocal(usuarioId, r.data);
    });
    return () => {
      cancelado = true;
    };
  }, [usuarioId]);
  return vendedor;
}
