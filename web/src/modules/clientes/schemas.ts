import { z } from "zod";

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
