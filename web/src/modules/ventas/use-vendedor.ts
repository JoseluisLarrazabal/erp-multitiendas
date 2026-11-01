"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { nombreVendedor } from "./queries";

// Nombre del vendedor para la nota. Mientras carga (o si falla) se usa "Vendedor".
export function useVendedor(usuarioId: string) {
  const [vendedor, setVendedor] = useState("Vendedor");
  useEffect(() => {
    let cancelado = false;
    nombreVendedor(createClient(), usuarioId).then((n) => !cancelado && setVendedor(n));
    return () => {
      cancelado = true;
    };
  }, [usuarioId]);
  return vendedor;
}
