import { z } from "zod";
import { leerFiltros } from "@/lib/filtros";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s));

// Alta rápida desde el POS (guardar_cliente): solo nombre es obligatorio.
export const clienteRapidoSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  ci_nit: textoOpcional(30),
  telefono: textoOpcional(30),
});
export type ClienteRapido = z.infer<typeof clienteRapidoSchema>;

// Alta o edición desde el panel. `id` presente = edición (reemplaza los cuatro campos).
export const clientePanelSchema = z.object({
  negocioId: z.guid(),
  id: z.guid().optional(),
  nombre: z.string().trim().min(1).max(200),
  ci_nit: textoOpcional(30),
  telefono: textoOpcional(30),
  direccion: textoOpcional(300),
});

export const PAGINA_CLIENTES = 25;
const camposFiltros = {
  q: z.string().trim().max(80),
  pagina: z.coerce.number().int().min(1).max(10_000),
};
export type FiltrosClientes = { q: string; pagina: number };
export const leerFiltrosClientes = (crudo: Parameters<typeof leerFiltros>[2]) =>
  leerFiltros(camposFiltros, { q: "", pagina: 1 }, crudo);
