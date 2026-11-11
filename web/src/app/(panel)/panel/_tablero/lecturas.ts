import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { leerLotesPorVencer } from "@/modules/inventario/panel";
import { listarOrdenes } from "@/modules/ventas/panel";

export const DIAS_POR_VENCER = 7;

// El aviso y el bloque de lotes leen lo mismo: se pide una sola vez por carga.
export const lotesProximos = cache(async (negocioId: string) =>
  leerLotesPorVencer(await createClient(), negocioId, DIAS_POR_VENCER),
);

// Las órdenes listas de más de DIAS_SIN_RECOGER días: también las lee el aviso y el bloque de órdenes.
export const ordenesSinRecoger = cache(async (negocioId: string) =>
  listarOrdenes(await createClient(), negocioId, { q: "", estado: "sin_recoger", desde: "" }, 50),
);
