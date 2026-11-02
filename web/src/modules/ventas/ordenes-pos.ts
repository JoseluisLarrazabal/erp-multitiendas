import { normalizar } from "./domain";
import type { EstadoActivo, OrdenActiva, Retiro } from "./queries-ordenes";

export const ETIQUETA_ESTADO: Record<EstadoActivo, string> = {
  recibida: "Recibida",
  en_lavado: "En lavado",
  lista: "Lista",
};

// Qué se puede hacer desde cada estado: avanzar, volver un paso, o entregar (solo desde lista).
export const PASOS: Record<
  EstadoActivo,
  { siguiente?: EstadoActivo; anterior?: EstadoActivo; entregar?: true }
> = {
  recibida: { siguiente: "en_lavado" },
  en_lavado: { siguiente: "lista", anterior: "recibida" },
  lista: { anterior: "en_lavado", entregar: true },
};

// Por número de nota o nombre del cliente, sin tildes ni mayúsculas.
export function filtrarOrdenes(ordenes: readonly OrdenActiva[], texto: string): OrdenActiva[] {
  const q = normalizar(texto);
  if (q === "") return [...ordenes];
  return ordenes.filter((o) => normalizar(`${o.numero} ${o.cliente}`).includes(q));
}

// La fecha prometida ya pasó (fechas YYYY-MM-DD, se comparan como texto).
export const estaAtrasada = (o: Pick<OrdenActiva, "fechaPrometida">, hoy: string) =>
  o.fechaPrometida < hoy;

export const fechaCorta = (fecha: string) => fecha.split("-").reverse().join("/");

// null: los datos del retiro están completos (mismas reglas que entregar_orden).
export function errorRetiro(r: Retiro): string | null {
  if (r.quien.trim() === "") return "Escribe quién retira.";
  if (r.con === "carnet" && r.documento.trim() === "")
    return "Escribe el documento de quien retira.";
  return null;
}

export const mensajeAnulacion = (reembolso: boolean) =>
  reembolso
    ? "Se devolvió el efectivo de la caja."
    : "La caja de esa orden ya cerró: si corresponde, registra una devolución en Ventas.";
