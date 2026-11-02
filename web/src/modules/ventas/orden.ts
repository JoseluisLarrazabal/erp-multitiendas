import type { ClienteElegido } from "@/modules/clientes";
import { ordenPayloadSchema, type OrdenPayload } from "./schemas";
import type { NotaVenta } from "./venta";

// Ficha de una orden de lavandería tal como se escribe (texto). Sin red, nombre y teléfono van aquí.
export type FichaTexto = {
  prendas: string;
  casillero: string;
  fecha: string;
  nota: string;
  nombre: string;
  telefono: string;
};

export const DIAS_PROMETIDOS = 2;
const ZONA = "America/La_Paz";

// Fecha de hoy en La Paz (YYYY-MM-DD), como la valida el servidor.
const formatoLaPaz = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA });
export const hoyLaPaz = (ahora: Date = new Date()) => formatoLaPaz.format(ahora);

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const fichaInicial = (ahora: Date = new Date()): FichaTexto => ({
  prendas: "",
  casillero: "",
  fecha: sumarDias(hoyLaPaz(ahora), DIAS_PROMETIDOS),
  nota: "",
  nombre: "",
  telefono: "",
});

export type ResultadoFicha = { ok: true; orden: OrdenPayload } | { ok: false; motivo: string };

// Valida la ficha y arma p_orden. `conCliente`: hay cliente elegido (el servidor toma nombre y teléfono de él); si no,
// el nombre escrito es obligatorio.
export function armarOrden(
  f: FichaTexto,
  o: { express: boolean; conCliente: boolean; hoy: string },
): ResultadoFicha {
  const vacioANulo = (t: string) => (t.trim() === "" ? undefined : t.trim());
  if (!/^\d{1,3}$/.test(f.prendas.trim()) || Number(f.prendas) < 1)
    return { ok: false, motivo: "Indica cuántas prendas son (de 1 a 999)." };
  if (f.casillero.trim().length > 20)
    return { ok: false, motivo: "El casillero admite hasta 20 caracteres." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha) || f.fecha < o.hoy)
    return { ok: false, motivo: "La fecha prometida no puede ser anterior a hoy." };
  if (f.nota.trim().length > 500)
    return { ok: false, motivo: "La nota admite hasta 500 caracteres." };
  if (!o.conCliente) {
    if (f.nombre.trim() === "") return { ok: false, motivo: "Escribe el nombre del cliente." };
    if (f.nombre.trim().length > 200)
      return { ok: false, motivo: "El nombre admite hasta 200 caracteres." };
    if (f.telefono.trim().length > 30)
      return { ok: false, motivo: "El teléfono admite hasta 30 caracteres." };
  }
  // Sin claves undefined: la cola guarda el payload como JSON y z.json() las rechaza.
  const r = ordenPayloadSchema.safeParse(
    Object.fromEntries(
      Object.entries({
        express: o.express,
        prendas: Number(f.prendas),
        fecha_prometida: f.fecha,
        casillero: vacioANulo(f.casillero),
        nota: vacioANulo(f.nota),
        cliente_nombre: o.conCliente ? undefined : vacioANulo(f.nombre),
        cliente_telefono: o.conCliente ? undefined : vacioANulo(f.telefono),
      }).filter(([, v]) => v !== undefined),
    ),
  );
  return r.success
    ? { ok: true, orden: r.data }
    : { ok: false, motivo: "Revisa los datos de la orden." };
}

// Cliente y bloque de orden de la boleta: con cliente elegido salen de él; sin él, de lo escrito.
export function datosBoleta(
  orden: OrdenPayload,
  cliente: ClienteElegido | null,
): Pick<NotaVenta, "cliente" | "orden"> {
  return {
    cliente: cliente
      ? { nombre: cliente.nombre, documento: cliente.documento }
      : { nombre: orden.cliente_nombre ?? "", documento: null },
    orden: {
      telefono: (cliente ? cliente.telefono : orden.cliente_telefono) ?? null,
      prendas: orden.prendas,
      casillero: orden.casillero ?? null,
      express: orden.express,
      fechaPrometida: orden.fecha_prometida,
      nota: orden.nota ?? null,
    },
  };
}
